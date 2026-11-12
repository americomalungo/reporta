import { Injectable, Logger } from '@nestjs/common';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { PushSenderService } from '@/src/infrastructure/firebase/push-sender.service';
import type { NotificationDispatchInput } from '@/src/common/types/notifications.types';

/**
 * Persiste notificações e, quando pedido, envia push sem propagar falhas.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  /**
   * Cria o dispatcher de notificações.
   * @param {NotificationRepository} notificationRepository persistência de notificações
   * @param {PushTokenRepository} pushTokenRepository consulta e desativação de tokens
   * @param {PushSenderService} pushSenderService envio de mensagens pelo FCM
   */
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly pushSenderService: PushSenderService,
  ) {}

  /**
   * Cria uma notificação in-app e tenta enviar push quando solicitado.
   * @param {string} userId identificador do destinatário
   * @param {NotificationDispatchInput} input conteúdo e opções de envio
   * @returns {Promise<void>} termina sempre sem propagar falhas de persistência ou envio
   */
  async notify(
    userId: string,
    input: NotificationDispatchInput,
  ): Promise<void> {
    try {
      const [notification] = await this.notificationRepository.createMany([
        {
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          incidentId: input.incidentId,
          data: input.data,
        },
      ]);
      if (!notification || !input.push) return;

      const tokens = await this.pushTokenRepository.findActiveByUserIds([
        userId,
      ]);
      if (tokens.length === 0) return;

      const pushData: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.data ?? {})) {
        pushData[key] = String(value);
      }
      const result = await this.pushSenderService.sendToTokens(
        tokens.map((token) => token.token),
        {
          title: input.title,
          body: input.body,
          data: pushData,
        },
      );
      await this.pushTokenRepository.deactivateTokens(result.invalidTokens);
      if (result.successCount > 0) {
        await this.notificationRepository.markPushSent([notification.id]);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao despachar notificação do utilizador ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
