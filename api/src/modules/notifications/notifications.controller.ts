import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { ReturnNotificationDto } from './dto/return-notification.dto';
import { ReturnUnreadCountDto } from './dto/return-unread-count.dto';
import { NotificationsService } from './notifications.service';

/**
 * Controller para consultar e atualizar notificações in-app.
 */
@Controller('notifications')
export class NotificationsController {
  /**
   * Cria o controller das notificações.
   * @param {NotificationsService} notificationsService serviço de notificações
   */
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Lista notificações do utilizador autenticado.
   * HTTP GET /notifications
   * @param {User} user utilizador autenticado
   * @param {NotificationsQueryDto} query parâmetros de cursor e filtro
   * @returns {Promise<CursorPage<ReturnNotificationDto>>} página de notificações
   */
  @Get()
  list(
    @CurrentDbUser() user: User,
    @Query() query: NotificationsQueryDto,
  ): Promise<CursorPage<ReturnNotificationDto>> {
    return this.notificationsService.list(user.id, query);
  }

  /**
   * Devolve a quantidade de notificações ainda não lidas.
   * HTTP GET /notifications/unread-count
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnUnreadCountDto>} total de notificações não lidas
   */
  @Get('unread-count')
  unreadCount(@CurrentDbUser() user: User): Promise<ReturnUnreadCountDto> {
    return this.notificationsService.unreadCount(user.id);
  }

  /**
   * Marca uma notificação do utilizador autenticado como lida.
   * HTTP PATCH /notifications/:id/read
   * @param {string} id id da notificação
   * @param {User} user utilizador autenticado
   * @returns {Promise<{ message: string }>} confirmação idempotente
   * @throws {NotFoundException} se a notificação não existir ou pertencer a outro utilizador
   */
  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentDbUser() user: User,
  ): Promise<{ message: string }> {
    return this.notificationsService.markRead(id, user.id);
  }

  /**
   * Marca todas as notificações do utilizador autenticado como lidas.
   * HTTP PATCH /notifications/read-all
   * @param {User} user utilizador autenticado
   * @returns {Promise<{ updated: number }>} quantidade atualizada
   */
  @Patch('read-all')
  markAllRead(@CurrentDbUser() user: User): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user.id);
  }
}
