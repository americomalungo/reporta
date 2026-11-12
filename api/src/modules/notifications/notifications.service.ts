import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@/src/common/types/entities.types';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { decodeCursor, encodeCursor } from '@/src/common/utils/cursor';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { ReturnNotificationDto } from './dto/return-notification.dto';

/**
 * Dados validados de um cursor da lista de notificações.
 */
interface NotificationCursor {
  /**
   * Data ISO da última notificação devolvida.
   */
  t: string;
  /**
   * Identificador da última notificação devolvida.
   */
  id: string;
}

function isNotificationCursor(value: unknown): value is NotificationCursor {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !('t' in value) ||
    !('id' in value) ||
    typeof value.t !== 'string' ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  ) {
    return false;
  }

  const timestamp = new Date(value.t);
  return (
    Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value.t
  );
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Serviço responsável pelas notificações in-app do utilizador.
 */
@Injectable()
export class NotificationsService {
  /**
   * Cria o serviço de notificações.
   * @param {NotificationRepository} notificationRepository repositório de notificações
   */
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  /**
   * Lista notificações do utilizador autenticado por cursor.
   * @param {string} userId id do utilizador autenticado
   * @param {NotificationsQueryDto} query cursor, limite e filtro de não lidas
   * @returns {Promise<CursorPage<ReturnNotificationDto>>} página de notificações
   */
  async list(
    userId: string,
    query: NotificationsQueryDto,
  ): Promise<CursorPage<ReturnNotificationDto>> {
    const limit = query.limit ?? 20;
    const cursor =
      query.cursor !== undefined
        ? decodeCursor(query.cursor, isNotificationCursor)
        : undefined;
    const notifications = await this.notificationRepository.listByUser(userId, {
      cursor: cursor
        ? { createdAt: new Date(cursor.t), id: cursor.id }
        : undefined,
      limit,
      unreadOnly: query.unread ?? false,
    });

    const hasNextPage = notifications.length > limit;
    const page = notifications.slice(0, limit);
    const lastNotification = page.at(-1);
    const nextCursor =
      hasNextPage && lastNotification
        ? encodeCursor({
            t: lastNotification.createdAt.toISOString(),
            id: lastNotification.id,
          })
        : null;

    return {
      data: page.map((notification) => this.toReturnDto(notification)),
      nextCursor,
      hasNextPage,
    };
  }

  /**
   * Conta as notificações não lidas do utilizador autenticado.
   * @param {string} userId id do utilizador autenticado
   * @returns {Promise<{ unread: number }>} quantidade por ler
   */
  async unreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await this.notificationRepository.countUnread(userId) };
  }

  /**
   * Marca como lida uma notificação pertencente ao utilizador autenticado.
   * @param {string} id id da notificação
   * @param {string} userId id do utilizador autenticado
   * @returns {Promise<{ message: string }>} confirmação idempotente
   * @throws {NotFoundException} se a notificação não existir ou pertencer a outro utilizador
   */
  async markRead(id: string, userId: string): Promise<{ message: string }> {
    const updated = await this.notificationRepository.markRead(id, userId);
    if (
      updated === 0 &&
      !(await this.notificationRepository.exists(id, userId))
    ) {
      throw new NotFoundException('Notificação não encontrada');
    }

    return { message: 'Notificação marcada como lida' };
  }

  /**
   * Marca como lidas todas as notificações não lidas do utilizador.
   * @param {string} userId id do utilizador autenticado
   * @returns {Promise<{ updated: number }>} quantidade atualizada
   */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    return {
      updated: await this.notificationRepository.markAllRead(userId),
    };
  }

  /**
   * Converte um registo de notificação para o DTO público sem dados de push.
   * @param {Notification} notification registo persistido
   * @returns {ReturnNotificationDto} notificação pronta para resposta HTTP
   */
  private toReturnDto(notification: Notification): ReturnNotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      incidentId: notification.incidentId,
      data: isJsonRecord(notification.data) ? notification.data : null,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
