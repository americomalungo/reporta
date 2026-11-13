// env.validation.ts
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Matches,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  /** Local development runtime. */
  Development = 'development',
  /** Production runtime. */
  Production = 'production',
  /** Test runtime. */
  Test = 'test',
}

/** Validated environment variables consumed by the API. */
export class EnvironmentVariables {
  /** Runtime deployment environment. */
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  /** HTTP port for the application listener. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 0;

  /** PostgreSQL connection URL. */
  @IsString()
  @IsNotEmpty()
  DATABASE_URL = '';

  /** Observe telemetry application key. */
  @IsString()
  @IsNotEmpty()
  OBSERVE_APP_KEY = '';

  /** Observe telemetry application secret. */
  @IsString()
  @IsNotEmpty()
  OBSERVE_APP_SECRET = '';

  /** Firebase project identifier. */
  @IsString()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID = '';

  /** Firebase service account private key. */
  @IsString()
  @IsNotEmpty()
  FIREBASE_PRIVATE_KEY = '';

  /** Firebase service account email. */
  @IsString()
  @IsNotEmpty()
  FIREBASE_CLIENT_EMAIL = '';

  /** Endpoint da API compatível com S3, por exemplo o endpoint regional do Backblaze B2. */
  @IsUrl({ require_tld: false })
  STORAGE_ENDPOINT = '';

  /** Região S3 do bucket, por exemplo eu-central-003. */
  @IsString()
  @IsNotEmpty()
  STORAGE_REGION = '';

  /** Identificador da chave de aplicação do armazenamento. */
  @IsString()
  @IsNotEmpty()
  STORAGE_ACCESS_KEY_ID = '';

  /** Segredo da chave de aplicação do armazenamento. */
  @IsString()
  @IsNotEmpty()
  STORAGE_SECRET_ACCESS_KEY = '';

  /** Nome do bucket privado de imagens. */
  @IsString()
  @IsNotEmpty()
  STORAGE_BUCKET = '';

  /** Enables BullMQ workers and job schedules, true by default. */
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  JOBS_ENABLED = true;

  /** URI de ligação Redis/Valkey, com ou sem TLS. */
  @IsString()
  @Matches(/^rediss?:\/\//)
  REDIS_URL = '';

  /** Prefixo das chaves Redis/Valkey. */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  REDIS_KEY_PREFIX = 'reporta';

  /** Número de proxies confiáveis à frente da API. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  TRUST_PROXY_HOPS = 0;
}

/** Validates runtime environment configuration.
 * @param {Record<string, unknown>} config raw environment variables
 * @returns {EnvironmentVariables} validated and transformed values
 * @throws {Error} if any configured value is invalid
 */
export function validate(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);
  if (errors.length) {
    throw new Error(
      'Invalid environment:\n' +
        errors.flatMap((e) => Object.values(e.constraints ?? {})).join('\n'),
    );
  }
  return env;
}
