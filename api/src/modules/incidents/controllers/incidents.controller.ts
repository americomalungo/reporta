import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { ReturnIncidentDto } from '../dto/return-incident.dto';
import { IncidentsService } from '../services/incidents.service';

/**
 * Controller responsável pela gestão de incidentes.
 * Expõe as rotas públicas e autenticadas do feed, detalhe e remoção de incidentes.
 */
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  /**
   * Cria um novo incidente.
   * Método HTTP: POST /incidents
   * @param {CreateIncidentDto} createIncidentDto dados do incidente
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<ReturnIncidentDto>} incidente criado
   */
  @Post()
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @CurrentDbUser() dbUser: User,
  ): Promise<ReturnIncidentDto> {
    return this.incidentsService.create(createIncidentDto, dbUser);
  }

  /**
   * Lista incidentes ativos paginados.
   * Método HTTP: GET /incidents
   * @param {IncidentsQueryDto} query parâmetros de paginação e filtros do feed
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<CursorPage<ReturnIncidentDto>>} lista paginada de incidentes
   */
  @Get()
  findAll(
    @Query() query: IncidentsQueryDto,
    @CurrentDbUser() dbUser: User,
  ): Promise<CursorPage<ReturnIncidentDto>> {
    return this.incidentsService.findAll(query, dbUser.id);
  }

  /**
   * Lê um incidente específico.
   * Método HTTP: GET /incidents/:id
   * @param {string} id id do incidente
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<ReturnIncidentDto>} incidente detalhado
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentDbUser() dbUser: User,
  ): Promise<ReturnIncidentDto> {
    return this.incidentsService.findOne(
      id,
      dbUser.id,
      dbUser.role === UserRole.ADMIN,
    );
  }

  /**
   * Remove um incidente por soft-delete.
   * Método HTTP: DELETE /incidents/:id
   * @param {string} id id do incidente
   * @param {User} user utilizador autenticado carregado da base de dados
   * @returns {Promise<{ message: string }>} mensagem de confirmação
   * @throws {NotFoundException} se o incidente não existir ou não puder ser removido pelo autor
   * @throws {ForbiddenException} se o utilizador não for autor nem administrador
   * @throws {ConflictException} se um administrador tentar remover um incidente já eliminado
   */
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentDbUser() user: User,
  ): Promise<{ message: string }> {
    return this.incidentsService.remove(id, user);
  }
}
