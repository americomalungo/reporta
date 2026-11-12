import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '@/src/common/dto/cursor-pagination-query.dto';

/**
 * Parâmetros de consulta da lista de notificações.
 */
export class NotificationsQueryDto extends CursorPaginationQueryDto {
  /**
   * Filtra a lista para incluir apenas notificações não lidas.
   */
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  unread?: boolean;
}
