import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PushPlatform } from '@/src/common/enums/devices.enums';
import type { PushPlatform as PushPlatformType } from '@/src/common/types/devices.types';

/**
 * Dados para registar ou atualizar um token push do utilizador autenticado.
 */
export class RegisterPushTokenDto {
  /**
   * Token FCM do dispositivo.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  /**
   * Plataforma do dispositivo que utiliza o token.
   */
  @IsEnum(PushPlatform)
  platform: PushPlatformType;

  /**
   * Identificador opcional do dispositivo.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @IsOptional()
  deviceId?: string;
}
