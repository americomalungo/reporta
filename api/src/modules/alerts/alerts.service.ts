import { InternalServerErrorException, Injectable } from '@nestjs/common';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import {
  AlertRepository,
  type AlertRecipient,
} from '@/src/infrastructure/repositories/alert.repository';
import {
  IncidentsRepository,
  type IncidentRiskAlertData,
} from '@/src/infrastructure/repositories/incident.repository';
import type { Notification } from '@/src/common/types/entities.types';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { PushSenderService } from '@/src/infrastructure/firebase/push-sender.service';

const RECIPIENT_BATCH_SIZE = 500;
/** Número máximo de notificações enviadas ao FCM em paralelo. */
const PUSH_SEND_CONCURRENCY = 20;

/**
 * Coordena os alertas de proximidade e o respetivo envio push.
 */
@Injectable()
export class AlertsService {
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
  ) {}

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

    if (!(await this.alertRepository.claimDispatch(incidentId))) {
      return;
    }

    let afterUserId: string | null = null;
    while (true) {
      const batch = await this.alertRepository.deliverBatch({
        incidentId,
        authorId: incident.authorId,
        afterUserId,
        batchSize: RECIPIENT_BATCH_SIZE,
      });

      if (batch.lastCandidateUserId === null) {
        return;
      }

      afterUserId = batch.lastCandidateUserId;
      await this.processBatch(batch.recipients, incident);
    }
  }

  /**
   * Cria notificações e envia push aos destinatários efetivamente reclamados.
   * @param {AlertRecipient[]} recipients entregas novas
   * @param {IncidentRiskAlertData} incident dados do incidente e categoria
   * @returns {Promise<void>} conclusão do processamento do lote
   * @throws {InternalServerErrorException} se uma notificação criada não corresponder a um destinatário
   */
  private async processBatch(
    recipients: AlertRecipient[],
    incident: IncidentRiskAlertData,
  ): Promise<void> {
    if (recipients.length === 0) {
      return;
    }

    const recipientByUserId = new Map(
      recipients.map((recipient) => [recipient.userId, recipient]),
    );
    const notifications: Notification[] =
      await this.notificationRepository.createMany(
        recipients.map((recipient) => ({
          userId: recipient.userId,
          type: NotificationType.RISK_ALERT,
          title: 'Alerta de risco perto de si',
          body: this.createAlertBody(
            recipient,
            incident.categoryName,
            incident.title,
          ),
          incidentId: incident.id,
          data: {
            incidentId: incident.id,
            categoryId: incident.categoryId,
            ...(recipient.distanceM === null
              ? {}
              : { distanceM: recipient.distanceM }),
            ...(recipient.zoneName === null
              ? {}
              : { zoneName: recipient.zoneName }),
          },
        })),
      );

    const tokens = await this.pushTokenRepository.findActiveByUserIds(
      recipients.map((recipient) => recipient.userId),
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
          const recipient = recipientByUserId.get(notification.userId);
          if (!recipient) {
            throw new InternalServerErrorException(
              'A notificação criada não corresponde a um destinatário do alerta',
            );
          }

          const userTokens = tokensByUserId.get(notification.userId) ?? [];
          if (userTokens.length === 0) return null;

          const result = await this.pushSenderService.sendToTokens(userTokens, {
            title: notification.title,
            body: notification.body,
            data: {
              incidentId: incident.id,
              type: NotificationType.RISK_ALERT,
              ...(recipient.zoneName === null
                ? {}
                : { zoneName: recipient.zoneName }),
            },
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

  /** Monta o texto de alerta conforme a proximidade e a zona que interseta.
   * @param {AlertRecipient} recipient destinatário e critérios correspondidos
   * @param {string} categoryName nome da categoria de risco
   * @param {string} title título do incidente
   * @returns {string} mensagem localizada para o destinatário
   */
  private createAlertBody(
    recipient: AlertRecipient,
    categoryName: string,
    title: string,
  ): string {
    if (recipient.distanceM !== null && recipient.zoneName !== null) {
      return `A categoria ${categoryName} registou o incidente "${title}", a cerca de ${Math.round(recipient.distanceM)} m, na sua zona "${recipient.zoneName}".`;
    }
    if (recipient.distanceM !== null) {
      return `A categoria ${categoryName} registou o incidente "${title}", a cerca de ${Math.round(recipient.distanceM)} m.`;
    }
    return `A categoria ${categoryName} registou o incidente "${title}" na sua zona "${recipient.zoneName ?? ''}".`;
  }
}
