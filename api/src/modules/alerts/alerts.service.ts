import {
  InternalServerErrorException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import { AlertRepository } from '@/src/infrastructure/repositories/alert.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import type { Notification } from '@/src/common/types/entities.types';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { PushSenderService } from '@/src/infrastructure/firebase/push-sender.service';
import { PUSH_MAX_BATCH_ITERATIONS } from '@/src/common/constants/notifications.constants';
import { JobQueue } from '@/src/infrastructure/queue/job-queue';
import { JobName } from '@/src/common/enums/queue.enums';

/** Maximum number of alert recipients or push notifications in one database batch. */
const RECIPIENT_BATCH_SIZE = 500;
/** Número máximo de notificações enviadas ao FCM em paralelo. */
const PUSH_SEND_CONCURRENCY = 20;

/**
 * Coordena os alertas de proximidade e o respetivo envio push.
 */
@Injectable()
export class AlertsService implements OnModuleInit {
  /**
   * Cria o serviço de alertas de proximidade.
   * @param {AlertRepository} alertRepository gestão idempotente das entregas
   * @param {IncidentsRepository} incidentsRepository leitura do incidente e das coordenadas
   * @param {NotificationRepository} notificationRepository persistência in-app
   * @param {PushTokenRepository} pushTokenRepository consulta e desativação de tokens
   * @param {PushSenderService} pushSenderService envio através do FCM
   * @param {JobQueue} jobQueue queue abstraction for alert work
   */
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly incidentsRepository: IncidentsRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly pushSenderService: PushSenderService,
    private readonly jobQueue: JobQueue,
  ) {}

  /** Registers dispatch, push delivery, and recovery handlers.
   * @returns {void} handler registration completion
   */
  onModuleInit(): void {
    this.jobQueue.registerHandler(
      JobName.DISPATCH_RISK_ALERT,
      async ({ incidentId }) => {
        await this.dispatchRiskAlert(incidentId);
        await this.jobQueue.enqueue(JobName.SEND_ALERT_PUSHES, { incidentId });
      },
    );
    this.jobQueue.registerHandler(
      JobName.SEND_ALERT_PUSHES,
      async ({ incidentId }) => this.sendPendingPushes(incidentId),
    );
    this.jobQueue.registerHandler(JobName.RETRY_RISK_ALERT_PUSHES, async () =>
      this.retryPendingPushes(),
    );
  }

  /** Requeues undispatched risk incidents and incidents with pending pushes.
   * @returns {Promise<void>} completion of recovery enqueues
   * @throws {Error} if a recovery query or enqueue fails
   */
  async retryPendingPushes(): Promise<void> {
    const recoveryQueries: Array<{
      job: JobName;
      findBatch: (afterId: string | null) => Promise<string[]>;
    }> = [
      {
        job: JobName.SEND_ALERT_PUSHES,
        findBatch: (afterId) =>
          this.alertRepository.findIncidentsWithPendingPush(afterId, 500),
      },
      {
        job: JobName.DISPATCH_RISK_ALERT,
        findBatch: (afterId) =>
          this.alertRepository.findUndispatchedRiskIncidentIds(afterId, 500),
      },
    ];
    for (const query of recoveryQueries) {
      let afterId: string | null = null;
      while (true) {
        const incidentIds = await query.findBatch(afterId);
        if (incidentIds.length === 0) break;
        for (const incidentId of incidentIds) {
          if (query.job === JobName.DISPATCH_RISK_ALERT) {
            await this.jobQueue.enqueue(
              JobName.DISPATCH_RISK_ALERT,
              { incidentId },
              {
                jobId: `${JobName.DISPATCH_RISK_ALERT}-${incidentId}`,
                attempts: 5,
                backoffMs: 5000,
              },
            );
          } else {
            await this.jobQueue.enqueue(JobName.SEND_ALERT_PUSHES, {
              incidentId,
            });
          }
        }
        afterId = incidentIds.at(-1) ?? afterId;
        if (incidentIds.length < 500) break;
      }
    }
  }

  /**
   * Reclama e despacha alertas de risco para utilizadores próximos do incidente.
   * @param {string} incidentId id do incidente
   * @returns {Promise<void>} conclusão do despacho
   * @throws {InternalServerErrorException} se o incidente não tiver coordenadas disponíveis
   */
  async dispatchRiskAlert(incidentId: string): Promise<void> {
    const incident =
      await this.incidentsRepository.findRiskAlertData(incidentId);
    if (
      !incident ||
      !incident.isRisk ||
      incident.status !== IncidentStatus.ACTIVE
    ) {
      return;
    }

    const coordinates = await this.incidentsRepository.getCoordinates([
      incidentId,
    ]);
    if (coordinates.length === 0) {
      throw new InternalServerErrorException(
        'Não foi possível obter a localização do incidente para o alerta',
      );
    }

    let afterUserId: string | null = null;
    while (true) {
      const batch = await this.alertRepository.deliverBatch({
        incidentId,
        authorId: incident.authorId,
        afterUserId,
        batchSize: RECIPIENT_BATCH_SIZE,
        categoryName: incident.categoryName,
        incidentTitle: incident.title,
        categoryId: incident.categoryId,
      });

      if (batch.lastCandidateUserId === null) break;

      afterUserId = batch.lastCandidateUserId;
    }
    await this.alertRepository.markDispatchComplete(incidentId);
  }

  /** Claims and sends pending risk alert pushes in bounded batches.
   * @param {string} incidentId incident associated with notifications
   * @returns {Promise<void>} completion after the queue is empty or iteration cap
   * @throws {Error} if claiming, delivery, or persistence fails
   */
  private async sendPendingPushes(incidentId: string): Promise<void> {
    for (
      let iteration = 0;
      iteration < PUSH_MAX_BATCH_ITERATIONS;
      iteration += 1
    ) {
      const notifications: Notification[] =
        await this.notificationRepository.claimPendingRiskAlerts(
          incidentId,
          RECIPIENT_BATCH_SIZE,
        );
      if (notifications.length === 0) return;
      const tokens = await this.pushTokenRepository.findActiveByUserIds(
        notifications.map((notification) => notification.userId),
      );
      const tokensByUserId = new Map<string, string[]>();
      for (const { userId, token } of tokens) {
        const userTokens = tokensByUserId.get(userId) ?? [];
        userTokens.push(token);
        tokensByUserId.set(userId, userTokens);
      }

      const pushSentIds: string[] = [];
      for (
        let offset = 0;
        offset < notifications.length;
        offset += PUSH_SEND_CONCURRENCY
      ) {
        const notificationGroup = notifications.slice(
          offset,
          offset + PUSH_SEND_CONCURRENCY,
        );
        const groupResults = await Promise.all(
          notificationGroup.map(async (notification) => {
            const userTokens = tokensByUserId.get(notification.userId) ?? [];
            if (userTokens.length === 0) return null;

            const data: Record<string, string> = {
              incidentId: notification.incidentId ?? incidentId,
              type: NotificationType.RISK_ALERT,
            };
            if (
              typeof notification.data === 'object' &&
              notification.data !== null &&
              'zoneName' in notification.data &&
              typeof notification.data.zoneName === 'string'
            ) {
              data.zoneName = notification.data.zoneName;
            }
            const result = await this.pushSenderService.sendToTokens(
              userTokens,
              {
                title: notification.title,
                body: notification.body,
                data,
              },
            );
            await this.pushTokenRepository.deactivateTokens(
              result.invalidTokens,
            );
            return result.successCount > 0 ? notification.id : null;
          }),
        );
        pushSentIds.push(
          ...groupResults.filter((id): id is string => id !== null),
        );
      }

      await this.notificationRepository.markPushSent(pushSentIds);
    }
  }
}
