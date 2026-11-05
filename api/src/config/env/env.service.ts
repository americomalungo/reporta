import { ConfigService } from '@nestjs/config';
import { Environment, EnvironmentVariables } from './env.validation';
import { Injectable } from '@nestjs/common';

// env.service.ts
@Injectable()
export class EnvService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get apiPort() {
    return this.config.getOrThrow('PORT', { infer: true });
  }
  get databaseUrl() {
    return this.config.getOrThrow('DATABASE_URL', { infer: true });
  }
  get observeAppKey() {
    return this.config.getOrThrow('OBSERVE_APP_KEY', { infer: true });
  }
  get observeAppSecret() {
    return this.config.getOrThrow('OBSERVE_APP_SECRET', { infer: true });
  }
  get isProduction() {
    return (
      this.config.get('NODE_ENV', { infer: true }) === Environment.Production
    );
  }
}
