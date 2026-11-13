import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { PushSenderService } from '@/src/infrastructure/firebase/push-sender.service';
import type { NotificationDispatchInput } from '@/src/common/types/notifications.types';
import { JobQueue } from '@/src/infrastructure/queue/job-queue';
import { JobName } from '@/src/common/enums/queue.enums';

/** Serializes a JSON notification field into the flat string FCM payload format.
 * @param {unknown} value JSON value stored on the notification
 * @returns {string} primitive text or a JSON representation of a compound value
 */
function stringifyPushValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

/** Persists in-app notifications and queues requested push delivery. */
@Injectable()
export class NotificationDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  /** Creates the notification dispatcher.
   * @param {NotificationRepository} notificationRepository notification persistence
   * @param {PushTokenRepository} pushTokenRepository token lookup and deactivation
   * @param {PushSenderService} pushSenderService FCM delivery
   * @param {JobQueue} jobQueue provider-independent push queue
   */
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly pushSenderService: PushSenderService,
    private readonly jobQueue: JobQueue,
  ) {}

  /** Registers the notification push processor.
   * @returns {void} handler registration completion
   */
  onModuleInit(): void {
    this.jobQueue.registerHandler(
      JobName.SEND_NOTIFICATION_PUSH,
      async ({ notificationId }) => this.sendPush(notificationId),
    );
  }

  /** Persists a notification and queues its push on a best effort basis.
   * @param {string} userId recipient identifier
   * @param {NotificationDispatchInput} input notification content and options
   * @returns {Promise<void>} completion without propagating persistence or enqueue failures
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
      await this.jobQueue.enqueue(
        JobName.SEND_NOTIFICATION_PUSH,
        { notificationId: notification.id },
        { attempts: 5, backoffMs: 5000 },
      );
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao despachar notificação do utilizador ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Sends a push for a notification already persisted in the database.
   * @param {string} notificationId persisted notification identifier
   * @returns {Promise<void>} completion of push delivery
   * @throws {Error} if notification lookup, token lookup, FCM delivery, or persistence fails
   */
  async sendPush(notificationId: string): Promise<void> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (!notification) return;
    const tokens = await this.pushTokenRepository.findActiveByUserIds([
      notification.userId,
    ]);
    if (tokens.length === 0) return;

    const pushData: Record<string, string> = {};
    if (typeof notification.data === 'object' && notification.data !== null) {
      for (const [key, value] of Object.entries(notification.data)) {
        pushData[key] = stringifyPushValue(value);
      }
    }
    const result = await this.pushSenderService.sendToTokens(
      tokens.map((token) => token.token),
      {
        title: notification.title,
        body: notification.body,
        data: pushData,
      },
    );
    await this.pushTokenRepository.deactivateTokens(result.invalidTokens);
    if (result.successCount > 0) {
      await this.notificationRepository.markPushSent([notification.id]);
    }
  }
}
