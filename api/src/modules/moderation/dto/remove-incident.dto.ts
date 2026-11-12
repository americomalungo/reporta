import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/**
 * Dados para remoção administrativa de um incidente.
 */
export class RemoveIncidentDto {
  /**
   * Motivo apresentado ao autor e guardado na auditoria.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 500)
  reason: string;
}
