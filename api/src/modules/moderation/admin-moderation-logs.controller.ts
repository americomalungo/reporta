import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { AdminModerationLogsQueryDto } from './dto/admin-moderation-logs-query.dto';
import { AdminModerationLogDto } from './dto/admin-moderation-log.dto';
import { AdminModerationLogsService } from './admin-moderation-logs.service';

/** Endpoint administrativo de pesquisa da auditoria de moderação. */
@ApiTags('Admin')
@Controller('admin/moderation-logs')
@Roles(UserRole.ADMIN)
export class AdminModerationLogsController {
  /** Cria o controller de auditoria.
   * @param {AdminModerationLogsService} service consulta paginada
   */
  constructor(private readonly service: AdminModerationLogsService) {}
  /** GET /admin/moderation-logs — lista eventos auditados.
   * @param {AdminModerationLogsQueryDto} query filtros e cursor
   * @returns {Promise<CursorPage<AdminModerationLogDto>>} página da auditoria
   */
  @Get()
  list(
    @Query() query: AdminModerationLogsQueryDto,
  ): Promise<CursorPage<AdminModerationLogDto>> {
    return this.service.list(query);
  }
}
