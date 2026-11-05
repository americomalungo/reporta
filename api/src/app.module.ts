import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { EnvModule } from './config/env/env.module';
import { EnvService } from './config/env/env.service';
import { PrismaModule } from './config/database/prisma.module';
import { ConfigModule } from '@nestjs/config';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EnvModule,
    PrismaModule,
    ObserveModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        appKey: env.observeAppKey,
        appSecret: env.observeAppSecret,
        serviceId: 'api',
      }),
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
