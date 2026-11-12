import { Module } from '@nestjs/common';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Módulo das notificações in-app.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRepository],
  exports: [NotificationsService, NotificationRepository],
})
export class NotificationsModule {}
