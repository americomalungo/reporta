// env.validation.ts
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
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

  /** Identificador da conta Cloudflare usada pelo R2. */
  @IsString()
  @IsNotEmpty()
  R2_ACCOUNT_ID!: string;

  /** Chave de acesso do utilizador R2. */
  @IsString()
  @IsNotEmpty()
  R2_ACCESS_KEY_ID!: string;

  /** Segredo da chave de acesso do utilizador R2. */
  @IsString()
  @IsNotEmpty()
  R2_SECRET_ACCESS_KEY!: string;

  /** Nome do bucket R2 criado para as imagens de incidentes. */
  @IsString()
  @IsNotEmpty()
  R2_BUCKET!: string;

  /** URL pública base usada para construir os endereços das imagens. */
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  R2_PUBLIC_URL!: string;
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
