import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
/**
 * Dados para suspender um utilizador.
 */
export class SuspendUserDto {
  /**
   * Motivo da suspensão.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason: string;
  /**
   * Duração em dias.
   */
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days: number;
}
