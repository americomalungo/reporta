import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

/** Dados opcionais para restaurar um incidente. */
export class RestoreIncidentDto {
  /** Motivo opcional guardado na auditoria. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
