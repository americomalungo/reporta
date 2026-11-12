import { Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '@/generated/prisma';
import type { NotificationType } from '@/src/common/types/incidents.types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dados para criar uma notificação in-app.
 */
export interface NewNotification {
  /**
   * Identificador do utilizador destinatário.
   */
  userId: string;

  /**
   * Título apresentado na notificação.
   */
  title: string;

  /**
   * Texto apresentado na notificação.
   */
  body: string;

  /**
   * Tipo da notificação.
   */
  type: NotificationType;

  /**
   * Identificador opcional do incidente associado.
   */
  incidentId?: string | null;

  /**
   * Dados JSON opcionais da notificação.
   */
  data?: Prisma.InputJsonValue;
}

/**
 * Cursor para continuar a listagem de notificações de um utilizador.
 */
export interface NotificationListCursor {
  /**
   * Data de criação da última notificação devolvida.
   */
  createdAt: Date;

  /**
   * Identificador da última notificação devolvida.
   */
  id: string;
}

/**
 * Repositório responsável pela persistência e consulta das notificações.
 */
@Injectable()
export class NotificationRepository {
  /**
   * Cria um repositório de notificações.
   * @param {PrismaService} prismaService cliente Prisma da aplicação
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Cria várias notificações e devolve os registos persistidos.
   * @param {NewNotification[]} items notificações a criar
   * @returns {Promise<Notification[]>} notificações criadas com os respetivos ids
   */
  createMany(items: NewNotification[]): Promise<Notification[]> {
    if (items.length === 0) {
      return Promise.resolve([]);
    }

    return this.prismaService.notification.createManyAndReturn({
      data: items,
    });
  }

  /**
   * Lista notificações de um utilizador por ordem cronológica decrescente.
   * @param {string} userId id do utilizador
   * @param {{ cursor?: NotificationListCursor; limit: number; unreadOnly: boolean }} options cursor, limite e filtro de leitura
   * @returns {Promise<Notification[]>} até limit + 1 notificações para detetar continuação
   */
  listByUser(
    userId: string,
    options: {
      cursor?: NotificationListCursor;
      limit: number;
      unreadOnly: boolean;
    },
  ): Promise<Notification[]> {
    const conditions: Prisma.NotificationWhereInput[] = [];

    if (options.unreadOnly) {
      conditions.push({ isRead: false });
    }

    if (options.cursor) {
      conditions.push({
        OR: [
          { createdAt: { lt: options.cursor.createdAt } },
          {
            createdAt: options.cursor.createdAt,
            id: { lt: options.cursor.id },
          },
        ],
      });
    }

    return this.prismaService.notification.findMany({
      where: {
        userId,
        AND: conditions,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });
  }

  /**
   * Conta as notificações ainda não lidas do utilizador.
   * @param {string} userId id do utilizador
   * @returns {Promise<number>} quantidade de notificações não lidas
   */
  countUnread(userId: string): Promise<number> {
    return this.prismaService.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Marca como lida uma notificação ainda não lida do utilizador.
   * @param {string} id id da notificação
   * @param {string} userId id do utilizador proprietário
   * @returns {Promise<number>} quantidade de registos atualizados
   */
  async markRead(id: string, userId: string): Promise<number> {
    const result = await this.prismaService.notification.updateMany({
      where: { id, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Verifica se a notificação pertence ao utilizador, incluindo se já foi lida.
   * @param {string} id id da notificação
   * @param {string} userId id do utilizador proprietário
   * @returns {Promise<boolean>} true quando a notificação pertence ao utilizador
   */
  async exists(id: string, userId: string): Promise<boolean> {
    const notification = await this.prismaService.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    return notification !== null;
  }

  /**
   * Marca todas as notificações não lidas do utilizador como lidas.
   * @param {string} userId id do utilizador
   * @returns {Promise<number>} quantidade de registos atualizados
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await this.prismaService.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Marca como enviado por push um conjunto de notificações.
   * @param {string[]} ids identificadores das notificações
   * @returns {Promise<number>} quantidade de registos atualizados
   */
  async markPushSent(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.prismaService.notification.updateMany({
      where: { id: { in: ids } },
      data: { pushSent: true, pushSentAt: new Date() },
    });
    return result.count;
  }
}
