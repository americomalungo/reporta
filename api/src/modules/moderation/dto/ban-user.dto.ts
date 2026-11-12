import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
/**
 * Dados para banir um utilizador.
 */
export class BanUserDto {
  /**
   * Motivo do banimento.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason: string;
}
