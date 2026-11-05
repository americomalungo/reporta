import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { EnvModule } from './config/env/env.module';
import { EnvService } from './config/env/env.service';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    EnvModule,
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
