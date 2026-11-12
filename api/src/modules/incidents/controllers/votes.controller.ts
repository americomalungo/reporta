import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { VoteIncidentDto } from '../dto/vote-incident.dto';
import { ReturnVoteDto } from '../dto/return-vote.dto';
import { VotesService } from '../services/votes.service';

/**
 * Controller responsável pelas operações de voto em incidentes.
 */
@Controller('incidents/:incidentId/vote')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  /**
   * Regista ou altera um voto num incidente.
   * @param {string} incidentId id do incidente
   * @param {VoteIncidentDto} dto tipo do voto a guardar
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnVoteDto>} estado atualizado do voto e contadores
   * @throws {NotFoundException} se o incidente não existir
   */
  @Put()
  vote(
    @Param('incidentId') incidentId: string,
    @Body() dto: VoteIncidentDto,
    @CurrentDbUser() user: User,
  ): Promise<ReturnVoteDto> {
    return this.votesService.vote(incidentId, user, dto);
  }

  /**
   * Remove o voto atual do utilizador num incidente.
   * @param {string} incidentId id do incidente
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnVoteDto>} estado final do voto e contadores
   * @throws {NotFoundException} se o incidente não existir ou o utilizador ainda não tiver votado
   */
  @Delete()
  removeVote(
    @Param('incidentId') incidentId: string,
    @CurrentDbUser() user: User,
  ): Promise<ReturnVoteDto> {
    return this.votesService.removeVote(incidentId, user);
  }
}
