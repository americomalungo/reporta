import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { User } from '@/src/common/types/entities.types';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { AdminIncidentDto } from './dto/admin-incident.dto';
import { AdminIncidentsQueryDto } from './dto/admin-incidents-query.dto';
import { RemoveIncidentDto } from './dto/remove-incident.dto';
import { RestoreIncidentDto } from './dto/restore-incident.dto';
import { ModerationService } from './moderation.service';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMIT_ADMIN } from '@/src/common/constants/rate-limit.constants';

/**
 * Endpoints administrativos para a fila e as ações sobre incidentes.
 */
@ApiTags('Admin')
@Controller('admin/incidents')
@Roles(UserRole.ADMIN)
@Throttle({ default: RATE_LIMIT_ADMIN })
export class AdminIncidentsController {
  /** Cria o controller administrativo de incidentes.
   * @param {ModerationService} moderationService coordenação de moderação
   */
  constructor(private readonly moderationService: ModerationService) {}

  /** GET /admin/incidents — lista a fila de moderação por cursor.
   * @param {AdminIncidentsQueryDto} query filtros e cursor
   * @returns {Promise<CursorPage<AdminIncidentDto>>} página da fila
   */
  @Get()
  list(
    @Query() query: AdminIncidentsQueryDto,
  ): Promise<CursorPage<AdminIncidentDto>> {
    return this.moderationService.listIncidents(query);
  }

  /** POST /admin/incidents/:id/remove — remove administrativamente um incidente.
   * @param {User} admin administrador autenticado
   * @param {string} id identificador do incidente
   * @param {RemoveIncidentDto} dto motivo
   * @returns {Promise<{ message: string }>} confirmação
   */
  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() dto: RemoveIncidentDto,
  ): Promise<{ message: string }> {
    return this.moderationService.removeIncident(admin, id, dto);
  }

  /** POST /admin/incidents/:id/restore — restaura um incidente removido ou em revisão.
   * @param {User} admin administrador autenticado
   * @param {string} id identificador do incidente
   * @param {RestoreIncidentDto} dto motivo opcional
   * @returns {Promise<{ message: string }>} confirmação
   */
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() dto: RestoreIncidentDto,
  ): Promise<{ message: string }> {
    return this.moderationService.restoreIncident(admin, id, dto);
  }
}
