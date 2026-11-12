import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Parâmetros para remover um token push do utilizador autenticado.
 */
export class RemovePushTokenQueryDto {
  /**
   * Token FCM a remover.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
