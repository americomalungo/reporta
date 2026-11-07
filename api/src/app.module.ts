import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { EnvModule } from './config/env/env.module';
import { EnvService } from './config/env/env.service';
import { PrismaModule } from './config/database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseModule } from './config/firebase/firebase.module';
import { validate } from './config/env/env.validation';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

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
    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
