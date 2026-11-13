import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IncidentStatus, VoteType } from '@/src/common/enums/incidents.enums';
import type { User } from '@/src/common/types/entities.types';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { JobQueue } from '@/src/infrastructure/queue/job-queue';
import { JobName } from '@/src/common/enums/queue.enums';
import { VoteIncidentDto } from '../dto/vote-incident.dto';
import { ReturnVoteDto } from '../dto/return-vote.dto';

/**
 * Serviço responsável pela gestão de votos nos incidentes.
 */
@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  /** Creates the vote service.
   * @param {IncidentsRepository} incidentsRepository incident lookup
   * @param {VoteRepository} voteRepository vote persistence
   * @param {JobQueue} jobQueue asynchronous moderation queue
   */
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly voteRepository: VoteRepository,
    private readonly jobQueue: JobQueue,
  ) {}

  /**
   * Regista ou altera o voto do utilizador num incidente.
   * @param {string} incidentId id do incidente
   * @param {User} user utilizador autenticado
   * @param {VoteIncidentDto} dto tipo de voto a aplicar
   * @returns {Promise<ReturnVoteDto>} resumo do estado final do voto e contadores
   * @throws {NotFoundException} se o incidente não existir ou estiver removido
   * @throws {ForbiddenException} se o utilizador tentar votar no seu próprio incidente
   * @throws {ConflictException} se o incidente estiver expirado ou indisponível para votação
   */
  async vote(
    incidentId: string,
    user: User,
    dto: VoteIncidentDto,
  ): Promise<ReturnVoteDto> {
    const incident = await this.incidentsRepository.findById(incidentId);

    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (
      incident.status === IncidentStatus.REMOVED ||
      incident.status === IncidentStatus.DELETED
    ) {
      throw new NotFoundException('Incidente não encontrado');
    }

    if (incident.authorId === user.id) {
      throw new ForbiddenException('Não pode votar no seu próprio incidente');
    }

    if (
      incident.status === IncidentStatus.EXPIRED ||
      incident.expiresAt <= new Date()
    ) {
      throw new ConflictException('Incidente expirado');
    }

    if (incident.status !== IncidentStatus.ACTIVE) {
      throw new ConflictException('Incidente não está disponível para votação');
    }

    const result = await this.voteRepository.setVote(
      incidentId,
      user.id,
      dto.type,
    );
    if (dto.type === VoteType.DISCONFIRM) {
      try {
        await this.jobQueue.enqueue(
          JobName.EVALUATE_INCIDENT_MODERATION,
          { incidentId },
          { attempts: 5, backoffMs: 5000 },
        );
      } catch (error: unknown) {
        this.logger.error(
          `Falha ao pôr avaliação de moderação do incidente ${incidentId} em fila`,
          error instanceof Error ? error.message : 'Erro desconhecido na fila',
        );
      }
    }

    return {
      incidentId,
      myVote: result.myVote,
      confirmCount: result.confirmCount,
      disconfirmCount: result.disconfirmCount,
    };
  }

  /**
   * Remove o voto do utilizador num incidente.
   * @param {string} incidentId id do incidente
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnVoteDto>} resumo do estado final do voto e contadores
   * @throws {NotFoundException} se o incidente não existir ou o utilizador ainda não tiver votado
   */
  async removeVote(incidentId: string, user: User): Promise<ReturnVoteDto> {
    const incident = await this.incidentsRepository.findById(incidentId);

    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const result = await this.voteRepository.removeVote(incidentId, user.id);

    return {
      incidentId,
      myVote: result.myVote,
      confirmCount: result.confirmCount,
      disconfirmCount: result.disconfirmCount,
    };
  }
}
