import { InternalServerErrorException, Injectable, Logger } from '@nestjs/common';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import {
  AlertRepository,
} from '@/src/infrastructure/repositories/alert.repository';
import {
  IncidentsRepository,
  type IncidentRiskAlertData,
} from '@/src/infrastructure/repositories/incident.repository';
import type { Notification } from '@/src/common/types/entities.types';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { PushSenderService } from '@/src/infrastructure/firebase/push-sender.service';
import { Cron } from '@nestjs/schedule';
import { EnvService } from '@/src/infrastructure/env/env.service';

const RECIPIENT_BATCH_SIZE = 500;
/** Número máximo de notificações enviadas ao FCM em paralelo. */
const PUSH_SEND_CONCURRENCY = 20;

/**
 * Coordena os alertas de proximidade e o respetivo envio push.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  /**
   * Cria o serviço de alertas de proximidade.
   * @param {AlertRepository} alertRepository gestão idempotente das entregas
   * @param {IncidentsRepository} incidentsRepository leitura do incidente e das coordenadas
   * @param {NotificationRepository} notificationRepository persistência in-app
   * @param {PushTokenRepository} pushTokenRepository consulta e desativação de tokens
   * @param {PushSenderService} pushSenderService envio através do FCM
   */
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly incidentsRepository: IncidentsRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly pushSenderService: PushSenderService,
    private readonly env: EnvService,
  ) {}

  @Cron('*/5 * * * *', { name: 'retry-risk-alert-pushes', timeZone: 'Africa/Luanda' })
  async retryPendingPushes(): Promise<void> {
    if (!this.env.jobsEnabled) return;
    for (const findBatch of [
      (afterId: string | null) =>
        this.alertRepository.findIncidentsWithPendingPush(afterId, 500),
      (afterId: string | null) =>
        this.alertRepository.findUndispatchedRiskIncidentIds(afterId, 500),
    ]) {
      let afterId: string | null = null;
      while (true) {
        const incidentIds = await findBatch(afterId);
        if (incidentIds.length === 0) break;
        for (const incidentId of incidentIds) {
          try {
            await this.dispatchRiskAlert(incidentId);
          } catch (error: unknown) {
            this.logger.error(
              `Falha ao repetir despacho do incidente ${incidentId}`,
              error instanceof Error ? error.stack : String(error),
            );
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
    await this.sendPendingPushes(incidentId);
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
    await this.sendPendingPushes(incidentId);
  }

  private async sendPendingPushes(incidentId: string): Promise<void> {
    const notifications: Notification[] = await this.notificationRepository
      .claimPendingRiskAlerts(incidentId, RECIPIENT_BATCH_SIZE);
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
          const result = await this.pushSenderService.sendToTokens(userTokens, {
            title: notification.title,
            body: notification.body,
            data,
          });
          await this.pushTokenRepository.deactivateTokens(result.invalidTokens);
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
