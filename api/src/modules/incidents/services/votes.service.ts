import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentStatus, User } from '@/generated/prisma';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { VoteIncidentDto } from '../dto/vote-incident.dto';
import { ReturnVoteDto } from '../dto/return-vote.dto';

@Injectable()
export class VotesService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly voteRepository: VoteRepository,
  ) {}

  async vote(
    incidentId: string,
    user: User,
    dto: VoteIncidentDto,
  ): Promise<ReturnVoteDto> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });

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

    return {
      incidentId,
      myVote: result.myVote,
      confirmCount: result.confirmCount,
      disconfirmCount: result.disconfirmCount,
    };
  }

  async removeVote(incidentId: string, user: User): Promise<ReturnVoteDto> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });

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
