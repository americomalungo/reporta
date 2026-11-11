import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '@/generated/prisma';
import {
  CurrentDbUser,
  CurrentUser,
} from '@/src/common/decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { Paginated } from '@/src/common/types/pagination.types';
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
   * @param {DecodedIdToken} currentUser utilizador autenticado do Firebase
   * @returns {Promise<ReturnIncidentDto>} incidente criado
   */
  @Post()
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @CurrentUser() currentUser: DecodedIdToken,
  ): Promise<ReturnIncidentDto> {
    return this.incidentsService.create(createIncidentDto, currentUser);
  }

  /**
   * Lista incidentes ativos paginados.
   * Método HTTP: GET /incidents
   * @param {IncidentsQueryDto} query parâmetros de paginação e filtros do feed
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<Paginated<ReturnIncidentDto>>} lista paginada de incidentes
   */
  @Get()
  findAll(
    @Query() query: IncidentsQueryDto,
    @CurrentDbUser() dbUser: User,
  ): Promise<Paginated<ReturnIncidentDto>> {
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
   * @param {string} id id do incidente
   * @param {DecodedIdToken} currentUser utilizador autenticado do Firebase
   * @returns {Promise<{ message: string }>} mensagem de confirmação
   */
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: DecodedIdToken,
  ): Promise<{ message: string }> {
    return this.incidentsService.remove(id, currentUser);
  }
}
