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
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  OBSERVE_APP_KEY!: string;

  @IsString()
  @IsNotEmpty()
  OBSERVE_APP_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID!: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_PRIVATE_KEY!: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_CLIENT_EMAIL!: string;

  /** Endpoint da API compatível com S3, por exemplo o endpoint regional do Backblaze B2. */
  @IsUrl({ require_tld: false })
  STORAGE_ENDPOINT!: string;

  /** Região S3 do bucket, por exemplo eu-central-003. */
  @IsString()
  @IsNotEmpty()
  STORAGE_REGION!: string;

  /** Identificador da chave de aplicação do armazenamento. */
  @IsString()
  @IsNotEmpty()
  STORAGE_ACCESS_KEY_ID!: string;

  /** Segredo da chave de aplicação do armazenamento. */
  @IsString()
  @IsNotEmpty()
  STORAGE_SECRET_ACCESS_KEY!: string;

  /** Nome do bucket privado de imagens. */
  @IsString()
  @IsNotEmpty()
  STORAGE_BUCKET!: string;

  /** Ativa a execução automática dos jobs agendados, true por omissão. */
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  JOBS_ENABLED = true;
}

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
