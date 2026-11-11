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
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { IncidentsService } from '../services/incidents.service';

/**
 * Controller responsável pela gestão de incidentes.
 */
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  /**
   * Cria um novo incidente.
   * @param {CreateIncidentDto} createIncidentDto dados do incidente
   * @param {DecodedIdToken} currentUser utilizador autenticado do Firebase
   * @returns {Promise<ReturnIncidentDto>} incidente criado
   */
  @Post()
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @CurrentUser() currentUser: DecodedIdToken,
  ) {
    return this.incidentsService.create(createIncidentDto, currentUser);
  }

  /**
   * Lista incidentes ativos paginados.
   * @param {IncidentsQueryDto} query parâmetros de paginação
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<{ data: ReturnIncidentDto[]; page: number; limit: number; hasNextPage: boolean }>} lista paginada de incidentes
   */
  @Get()
  findAll(@Query() query: IncidentsQueryDto, @CurrentDbUser() dbUser: User) {
    return this.incidentsService.findAll(query, dbUser.id);
  }

  /**
   * Lê um incidente específico.
   * @param {string} id id do incidente
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<ReturnIncidentDto>} incidente detalhado
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentDbUser() dbUser: User) {
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
  remove(@Param('id') id: string, @CurrentUser() currentUser: DecodedIdToken) {
    return this.incidentsService.remove(id, currentUser);
  }
}
