import { Module } from '@nestjs/common';
import { FirebaseModule } from '@/src/infrastructure/firebase/firebase.module';
import { AlertRepository } from '@/src/infrastructure/repositories/alert.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertsService } from './alerts.service';

/**
 * Módulo de despacho de alertas de proximidade.
 */
@Module({
  imports: [FirebaseModule, NotificationsModule],
  providers: [
    AlertsService,
    AlertRepository,
    IncidentsRepository,
    PushTokenRepository,
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
