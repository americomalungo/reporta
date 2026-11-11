import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { IncidentStatus } from '@/generated/prisma';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { ReturnIncidentDto } from '../dto/return-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly userRepository: UserRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly voteRepository: VoteRepository,
  ) {}

  async create(
    dto: CreateIncidentDto,
    currentUser: DecodedIdToken,
  ): Promise<ReturnIncidentDto> {
    const author = await this.userRepository.findUnique({
      firebaseUid: currentUser.uid,
    });
    if (!author || author.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Apenas utilizadores ativos podem criar incidentes',
      );
    }
    if (author.postingBlockedUntil && author.postingBlockedUntil > new Date()) {
      throw new ForbiddenException(
        'A sua conta está impedida de publicar incidentes',
      );
    }

    const category = await this.categoryRepository.findUnique({
      id: dto.categoryId,
    });
    if (!category || !category.isActive) {
      throw new NotFoundException('Categoria não encontrada ou inativa');
    }

    const id = await this.incidentsRepository.createWithLocation({
      authorId: author.id,
      categoryId: category.id,
      title: dto.title,
      description: dto.description,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return this.findOne(id, author.id, currentUser.role === UserRole.ADMIN);
  }

  async findAll(
    query: IncidentsQueryDto,
    viewerId: string,
  ): Promise<{
    data: ReturnIncidentDto[];
    page: number;
    limit: number;
    hasNextPage: boolean;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const incidents = await this.incidentsRepository.findMany(
      {
        status: IncidentStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      (page - 1) * limit,
      limit + 1,
    );
    const hasNextPage = incidents.length > limit;
    const pageIncidents = incidents.slice(0, limit);
    const data = await this.withCoordinates(pageIncidents, viewerId);
    return { data, page, limit, hasNextPage };
  }

  async findOne(
    id: string,
    viewerId: string,
    isAdmin = false,
  ): Promise<ReturnIncidentDto> {
    const incident = isAdmin
      ? await this.incidentsRepository.findUnique({ id })
      : await this.incidentsRepository.findFirst({
          id,
          status: { notIn: [IncidentStatus.REMOVED, IncidentStatus.DELETED] },
        });
    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }
    const [result] = await this.withCoordinates([incident], viewerId);
    return result;
  }

  async remove(
    id: string,
    currentUser: DecodedIdToken,
  ): Promise<{ message: string }> {
    const incident = await this.incidentsRepository.findUnique({ id });
    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const actor = await this.userRepository.findUnique({
      firebaseUid: currentUser.uid,
    });
    if (!actor) {
      throw new ForbiddenException('Utilizador não encontrado');
    }
    if (incident.authorId !== actor.id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Não tem permissão para remover este incidente',
      );
    }

    await this.incidentsRepository.update(
      { id },
      {
        status: IncidentStatus.DELETED,
        removedAt: new Date(),
        removedBy: actor.id,
      },
    );
    return { message: 'Incidente removido com sucesso' };
  }

  private async withCoordinates(
    incidents: Awaited<ReturnType<IncidentsRepository['findMany']>>,
    viewerId: string,
  ): Promise<ReturnIncidentDto[]> {
    const locations = await this.incidentsRepository.getCoordinates(
      incidents.map((incident) => incident.id),
    );
    const coordinatesById = new Map(
      locations.map((location) => [location.id, location]),
    );

    const voteMap = new Map<string, ReturnIncidentDto['myVote']>();
    if (viewerId) {
      const votes = await this.voteRepository.findManyByUser(
        viewerId,
        incidents.map((incident) => incident.id),
      );

      votes.forEach((vote) => {
        voteMap.set(vote.incidentId, vote.type);
      });
    }

    return incidents.map((incident) => {
      const location = coordinatesById.get(incident.id);
      if (!location) {
        throw new InternalServerErrorException(
          'Não foi possível obter a localização do incidente',
        );
      }

      return {
        id: incident.id,
        authorId: incident.authorId,
        categoryId: incident.categoryId,
        title: incident.title,
        description: incident.description,
        address: incident.address,
        status: incident.status,
        expiresAt: incident.expiresAt,
        confirmCount: incident.confirmCount,
        disconfirmCount: incident.disconfirmCount,
        commentCount: incident.commentCount,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        latitude: location.latitude,
        longitude: location.longitude,
        myVote: voteMap.get(incident.id) ?? null,
      };
    });
  }
}
