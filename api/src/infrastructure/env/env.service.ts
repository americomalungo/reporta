import { ConfigService } from '@nestjs/config';
import { Environment, EnvironmentVariables } from './env.validation';
import { Injectable } from '@nestjs/common';

/** Provides validated environment values to infrastructure and modules. */
@Injectable()
export class EnvService {
  /** Creates the environment configuration accessor.
   * @param {ConfigService<EnvironmentVariables, true>} config validated Nest configuration
   */
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** HTTP port configured for the API.
   * @returns {number} listener port
   */
  get apiPort() {
    return this.config.getOrThrow('PORT', { infer: true });
  }

  /** PostgreSQL connection URL.
   * @returns {string} validated database URL
   */
  get databaseUrl() {
    return this.config.getOrThrow('DATABASE_URL', { infer: true });
  }

  /** URI Redis/Valkey utilizado por cache, rate limits e filas.
   * @returns {string} URI validado
   */
  get redisUrl(): string {
    return this.config.getOrThrow('REDIS_URL', { infer: true });
  }

  /** Prefixo configurado para todas as chaves Redis/Valkey.
   * @returns {string} prefixo sem separador final
   */
  get redisKeyPrefix(): string {
    return this.config.getOrThrow('REDIS_KEY_PREFIX', { infer: true });
  }

  /** Número de proxies confiáveis para obter o IP real do pedido.
   * @returns {number} quantidade de saltos confiáveis
   */
  get trustProxyHops(): number {
    return this.config.getOrThrow('TRUST_PROXY_HOPS', { infer: true });
  }

  /** Observe telemetry credentials.
   * @returns {{ appKey: string; appSecret: string }} configured Observe credentials
   */
  get observe() {
    return {
      appKey: this.config.getOrThrow('OBSERVE_APP_KEY', { infer: true }),
      appSecret: this.config.getOrThrow('OBSERVE_APP_SECRET', {
        infer: true,
      }),
    };
  }

  /** Firebase service account configuration.
   * @returns {{ projectId: string; privateKey: string; clientEmail: string }} Firebase credentials
   */
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

  /** Returns the private S3-compatible storage configuration.
   * @returns {{ endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket: string }} storage configuration
   */
  get storage() {
    return {
      endpoint: this.config.getOrThrow('STORAGE_ENDPOINT', { infer: true }),
      region: this.config.getOrThrow('STORAGE_REGION', { infer: true }),
      accessKeyId: this.config.getOrThrow('STORAGE_ACCESS_KEY_ID', {
        infer: true,
      }),
      secretAccessKey: this.config.getOrThrow('STORAGE_SECRET_ACCESS_KEY', {
        infer: true,
      }),
      bucket: this.config.getOrThrow('STORAGE_BUCKET', { infer: true }),
    };
  }

  /** Indicates whether workers and recurring jobs are enabled.
   * @returns {boolean} true when this process may process and schedule jobs
   */
  get jobsEnabled(): boolean {
    return this.config.getOrThrow('JOBS_ENABLED', { infer: true });
  }

  /** Indicates whether production mode is active.
   * @returns {boolean} production environment state
   */
  get isProduction() {
    return (
      this.config.get('NODE_ENV', { infer: true }) === Environment.Production
    );
  }
}
