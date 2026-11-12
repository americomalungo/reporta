import { IsEnum, IsOptional } from 'class-validator';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import type { IncidentStatus as IncidentStatusType } from '@/src/common/types/incidents.types';
import { CursorPaginationQueryDto } from '@/src/common/dto/cursor-pagination-query.dto';

/**
 * Filtros por cursor da fila administrativa de incidentes.
 */
export class AdminIncidentsQueryDto extends CursorPaginationQueryDto {
  /**
   * Estado opcional do incidente.
   */
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatusType;
}
