import { Global, Module } from '@nestjs/common';
import { validate } from './env.validation.js';
import { ConfigModule } from '@nestjs/config';
import { EnvService } from './env.service.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
