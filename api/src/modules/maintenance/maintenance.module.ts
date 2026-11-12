import { Module } from '@nestjs/common';
import { MaintenanceRepository } from '@/src/infrastructure/repositories/maintenance.repository';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { NotificationsModule } from '@/src/modules/notifications/notifications.module';
import { MaintenanceService } from './maintenance.service';
import { AdminMaintenanceController } from './admin-maintenance.controller';

/** Módulo de expiração e manutenção periódica da plataforma. */
@Module({
  imports: [NotificationsModule],
  controllers: [AdminMaintenanceController],
  providers: [
    MaintenanceService,
    MaintenanceRepository,
    IncidentMediaRepository,
    UserRepository,
  ],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
