import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { EnvModule } from './infrastructure/env/env.module';
import { EnvService } from './infrastructure/env/env.service';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './infrastructure/firebase/firebase.module';
import { validate } from './infrastructure/env/env.validation';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { UsersModule } from './modules/users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module';
import { RedisThrottlerStorage } from './infrastructure/rate-limit/redis-throttler.storage';
import { getRateLimitTracker } from './infrastructure/rate-limit/rate-limit.config';
import { RATE_LIMIT_DEFAULT } from './common/constants/rate-limit.constants';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

/** Root NestJS module composing infrastructure and application features. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ObserveModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        appKey: env.observe.appKey,
        appSecret: env.observe.appSecret,
        serviceId: 'api',
      }),
    }),
    EnvModule,
    FirebaseModule,
    StorageModule,
    CacheModule,
    QueueModule,
    RateLimitModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [{ name: 'default', ...RATE_LIMIT_DEFAULT }],
        getTracker: getRateLimitTracker,
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    IncidentsModule,
    NotificationsModule,
    MaintenanceModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
