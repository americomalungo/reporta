import { ConfigService } from '@nestjs/config';
import { Environment, EnvironmentVariables } from './env.validation';
import { Injectable } from '@nestjs/common';

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

  get observe() {
    return {
      appKey: this.config.getOrThrow('OBSERVE_APP_KEY', { infer: true }),
      appSecret: this.config.getOrThrow('OBSERVE_APP_SECRET', {
        infer: true,
      }),
    };
  }

  get firebase() {
    return {
      projectId: this.config.getOrThrow('FIREBASE_PROJECT_ID', {
        infer: true,
      }),
      privateKey: this.config.getOrThrow('FIREBASE_PRIVATE_KEY', {
        infer: true,
      }),
      clientEmail: this.config.getOrThrow('FIREBASE_CLIENT_EMAIL', {
        infer: true,
      }),
    };
  }

  /** Devolve as credenciais e configurações do bucket Cloudflare R2. */
  get r2() {
    return {
      accountId: this.config.getOrThrow('R2_ACCOUNT_ID', { infer: true }),
      accessKeyId: this.config.getOrThrow('R2_ACCESS_KEY_ID', {
        infer: true,
      }),
      secretAccessKey: this.config.getOrThrow('R2_SECRET_ACCESS_KEY', {
        infer: true,
      }),
      bucket: this.config.getOrThrow('R2_BUCKET', { infer: true }),
      publicUrl: this.config.getOrThrow('R2_PUBLIC_URL', { infer: true }),
    };
  }

  get isProduction() {
    return (
      this.config.get('NODE_ENV', { infer: true }) === Environment.Production
    );
  }
}
