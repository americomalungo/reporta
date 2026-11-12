import { Module } from '@nestjs/common';
import { NotificationRepository } from '@/src/infrastructure/repositories/notification.repository';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';

/**
 * Módulo das notificações in-app.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationRepository,
    PushTokenRepository,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationRepository,
  ],
})
export class NotificationsModule {}
