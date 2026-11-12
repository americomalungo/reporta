import { Module } from '@nestjs/common';
import { AuthModule } from '@/src/modules/auth/auth.module';
import { NotificationsModule } from '@/src/modules/notifications/notifications.module';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { ModerationRepository } from '@/src/infrastructure/repositories/moderation.repository';
import { ModerationService } from './moderation.service';
import { AdminIncidentsController } from './admin-incidents.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUserRepository } from '@/src/infrastructure/repositories/admin-user.repository';
import { AdminModerationLogsController } from './admin-moderation-logs.controller';
import { AdminModerationLogsService } from './admin-moderation-logs.service';
import { ModerationLogRepository } from '@/src/infrastructure/repositories/moderation-log.repository';

/**
 * Módulo das regras e operações de moderação.
 */
@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    AdminIncidentsController,
    AdminUsersController,
    AdminModerationLogsController,
  ],
  providers: [
    ModerationService,
    ModerationRepository,
    UserRepository,
    AdminUserRepository,
    AdminModerationLogsService,
    ModerationLogRepository,
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
