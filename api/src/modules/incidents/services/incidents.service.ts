import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Incident, IncidentStatus } from '@/generated/prisma';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import { Paginated } from '@/src/common/types/pagination.types';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { ReturnIncidentDto } from '../dto/return-incident.dto';

/**
 * Serviço responsável pela gestão dos incidentes.
 */
@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly userRepository: UserRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly voteRepository: VoteRepository,
  ) {}

  /**
   * Cria um novo incidente para o utilizador autenticado.
   * @param {CreateIncidentDto} dto dados do incidente
   * @param {DecodedIdToken} currentUser utilizador autenticado do Firebase
   * @returns {Promise<ReturnIncidentDto>} incidente criado com coordenadas e estado atual
   * @throws {ForbiddenException} se o utilizador não estiver ativo ou estiver bloqueado
   * @throws {NotFoundException} se a categoria não existir ou estiver inativa
   */
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

  /**
   * Lista incidentes ativos para um utilizador autenticado.
   * @param {IncidentsQueryDto} query parâmetros de paginação e filtros (categoria, texto, propriedade do autor, latitude/longitude com raio opcional)
   * @param {string} viewerId id do utilizador autenticado
   * @returns {Promise<Paginated<ReturnIncidentDto>>} incidentes paginados com distância e voto do utilizador quando aplicável
   */
  async findAll(
    query: IncidentsQueryDto,
    viewerId: string,
  ): Promise<Paginated<ReturnIncidentDto>> {
    const hasLat = query.lat !== undefined;
    const hasLng = query.lng !== undefined;
    const hasRadius = query.radius !== undefined;

    if (hasLat !== hasLng) {
      throw new BadRequestException(
        'Latitude e longitude devem ser informadas em conjunto',
      );
    }

    if (hasRadius && !hasLat && !hasLng) {
      throw new BadRequestException(
        'O raio só pode ser usado com latitude e longitude',
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const hasLocationFilter = hasLat && hasLng;
    const radiusM = hasLocationFilter ? (query.radius ?? 1000) : undefined;

    const rows = await this.incidentsRepository.searchIds(
      {
        categoryId: query.categoryId,
        search: query.search,
        mine: query.mine,
        viewerId,
        latitude: query.lat,
        longitude: query.lng,
        radiusM,
      },
      skip,
      limit + 1,
    );

    const hasNextPage = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const incidents = await this.incidentsRepository.findByIds(
      pageRows.map((row) => row.id),
    );
    const incidentsById = new Map(
      incidents.map((incident) => [incident.id, incident]),
    );
    const orderedIncidents = pageRows
      .map((row) => incidentsById.get(row.id))
      .filter((incident): incident is NonNullable<typeof incident> =>
        Boolean(incident),
      );

    const distanceById = new Map(
      pageRows
        .filter((row) => row.distanceM !== undefined && row.distanceM !== null)
        .map((row) => [row.id, row.distanceM ?? 0]),
    );

    const data = await this.withCoordinates(
      orderedIncidents,
      viewerId,
      distanceById,
    );
    return { data, page, limit, hasNextPage };
  }

  /**
   * Busca um incidente pelo id e inclui o voto do utilizador atual.
   * @param {string} id id do incidente
   * @param {string} viewerId id do utilizador autenticado
   * @param {boolean} isAdmin indica se a consulta é feita por admin
   * @returns {Promise<ReturnIncidentDto>} incidente detalhado com coordenadas e voto atual
   * @throws {NotFoundException} se o incidente não existir ou estiver removido
   */
  async findOne(
    id: string,
    viewerId: string,
    isAdmin: boolean,
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

  /**
   * Remove um incidente como soft-delete.
   * @param {string} id id do incidente
   * @param {DecodedIdToken} currentUser utilizador autenticado do Firebase
   * @returns {Promise<{ message: string }>} mensagem de confirmação
   * @throws {NotFoundException} se o incidente não existir
   * @throws {ForbiddenException} se o utilizador não tiver permissão
   */
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

  /**
   * Completa cada incidente com coordenadas e o voto do utilizador atual.
   * @param {Awaited<ReturnType<IncidentsRepository['findMany']>>} incidents incidentes base
   * @param {string} viewerId id do utilizador autenticado
   * @returns {Promise<ReturnIncidentDto[]>} incidentes enriquecidos com coordenadas e voto
   * @throws {InternalServerErrorException} se a localização não puder ser obtida
   */
  private async withCoordinates(
    incidents: Incident[],
    viewerId: string,
    distanceById?: Map<string, number>,
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
        distanceM: distanceById?.get(incident.id) ?? null,
        myVote: voteMap.get(incident.id) ?? null,
      };
    });
  }
}
