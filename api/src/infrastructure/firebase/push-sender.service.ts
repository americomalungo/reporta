import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BatchResponse, Messaging } from 'firebase-admin/messaging';
import { FIREBASE_MESSAGING } from './firebase.constants';
import type {
  PushPayload,
  PushSendResult,
} from '@/src/common/types/push.types';

const FCM_BATCH_SIZE = 500;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Serviço que envia notificações push através do Firebase Cloud Messaging.
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  /**
   * Cria o serviço de envio FCM.
   * @param {Messaging} messaging cliente Firebase Cloud Messaging
   */
  constructor(
    @Inject(FIREBASE_MESSAGING) private readonly messaging: Messaging,
  ) {}

  /**
   * Envia uma notificação para os tokens em lotes de até 500.
   * Falhas de envio são registadas e não propagadas ao chamador.
   * @param {string[]} tokens tokens FCM destinatários
   * @param {PushPayload} payload conteúdo e dados da notificação
   * @returns {Promise<PushSendResult>} sucessos e tokens que devem ser desativados
   */
  async sendToTokens(
    tokens: string[],
    payload: PushPayload,
  ): Promise<PushSendResult> {
    let successCount = 0;
    const invalidTokens = new Set<string>();

    for (let index = 0; index < tokens.length; index += FCM_BATCH_SIZE) {
      const batch = tokens.slice(index, index + FCM_BATCH_SIZE);

      try {
        const result = await this.messaging.sendEachForMulticast({
          tokens: batch,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
        });

        successCount += result.successCount;
        this.collectInvalidTokens(batch, result, invalidTokens);
      } catch (error) {
        this.logger.error(
          `Falha ao enviar push FCM para o lote ${Math.floor(index / FCM_BATCH_SIZE) + 1}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      successCount,
      invalidTokens: [...invalidTokens],
    };
  }

  /**
   * Recolhe os tokens cuja resposta individual indica que são inválidos.
   * @param {string[]} tokens tokens correspondentes às respostas do lote
   * @param {BatchResponse} result respostas individuais do FCM
   * @param {Set<string>} invalidTokens conjunto a atualizar sem duplicados
   * @returns {void} conclusão da recolha
   */
  private collectInvalidTokens(
    tokens: string[],
    result: BatchResponse,
    invalidTokens: Set<string>,
  ): void {
    result.responses.forEach((response, index) => {
      if (
        !response.success &&
        response.error &&
        INVALID_TOKEN_CODES.has(response.error.code)
      ) {
        invalidTokens.add(tokens[index]);
      }
    });
  }
}
