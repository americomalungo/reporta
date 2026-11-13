import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Incident, User } from '@/src/common/types/entities.types';
import type { IncidentSearchCursor } from '@/src/common/types/incidents.types';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import { MediaUrlService } from '../../media/media-url.service';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { JobQueue } from '@/src/infrastructure/queue/job-queue';
import { JobName } from '@/src/common/enums/queue.enums';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import type { CursorPage } from '@/src/common/types/pagination.types';
import {
  decodeCursor,
  encodeCursor,
  isTimestampIdCursor,
} from '@/src/common/utils/cursor';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { ReturnIncidentDto } from '../dto/return-incident.dto';

/** Validates the two supported incident feed cursor variants.
 * @param {unknown} value decoded cursor value
 * @returns {value is IncidentSearchCursor} true when the value has a valid feed cursor shape
 */
function isFeedCursor(value: unknown): value is IncidentSearchCursor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  if (
    !('k' in value) ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0
  )
    return false;
  if (value.k === 'c') {
    return (
      Object.keys(value).length === 3 &&
      't' in value &&
      isTimestampIdCursor({ t: value.t, id: value.id })
    );
  }
  return (
    value.k === 'd' &&
    Object.keys(value).length === 3 &&
    'd' in value &&
    typeof value.d === 'number' &&
    Number.isFinite(value.d) &&
    value.d >= 0
  );
}

/**
 * Serviço responsável pela gestão dos incidentes.
 */
@Injectable()
export class IncidentsService {
  /** Logger for queue submission failures that must not fail incident creation. */
  private readonly logger = new Logger(IncidentsService.name);

  /** Creates the incident service.
   * @param {IncidentsRepository} incidentsRepository incident persistence and queries
   * @param {IncidentMediaRepository} incidentMediaRepository media persistence
   * @param {CategoryRepository} categoryRepository category lookup
   * @param {VoteRepository} voteRepository vote lookup
   * @param {JobQueue} jobQueue asynchronous alert dispatch queue
   * @param {MediaUrlService} mediaUrlService signed media URL generation
   */
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly incidentMediaRepository: IncidentMediaRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly voteRepository: VoteRepository,
    private readonly jobQueue: JobQueue,
    private readonly mediaUrlService: MediaUrlService,
  ) {}

  /**
   * Cria um novo incidente para o utilizador autenticado.
   * @param {CreateIncidentDto} dto dados do incidente
   * @param {User} dbUser utilizador autenticado carregado da base de dados
   * @returns {Promise<ReturnIncidentDto>} incidente criado com coordenadas e estado atual
   * @throws {ForbiddenException} se o utilizador não estiver ativo ou estiver bloqueado
   * @throws {NotFoundException} se a categoria não existir ou estiver inativa
   */
  async create(
    dto: CreateIncidentDto,
    dbUser: User,
  ): Promise<ReturnIncidentDto> {
    if (dbUser.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Apenas utilizadores ativos podem criar incidentes',
      );
    }
    if (dbUser.postingBlockedUntil && dbUser.postingBlockedUntil > new Date()) {
      throw new ForbiddenException(
        'A sua conta está impedida de publicar incidentes',
      );
    }

    const category = await this.categoryRepository.findById(dto.categoryId);
    if (!category || !category.isActive) {
      throw new NotFoundException('Categoria não encontrada ou inativa');
    }

    const id = await this.incidentsRepository.createWithLocation({
      authorId: dbUser.id,
      categoryId: category.id,
      title: dto.title,
      description: dto.description,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    const response = await this.findOne(
      id,
      dbUser.id,
      dbUser.role === UserRole.ADMIN,
    );

    if (category.isRisk) {
      try {
        await this.jobQueue.enqueue(
          JobName.DISPATCH_RISK_ALERT,
          { incidentId: id },
          {
            jobId: `${JobName.DISPATCH_RISK_ALERT}-${id}`,
            attempts: 5,
            backoffMs: 5000,
          },
        );
      } catch (error: unknown) {
        this.logger.error(
          `Falha ao pôr o alerta de risco do incidente ${id} em fila`,
          error instanceof Error ? error.message : 'Erro desconhecido na fila',
        );
      }
    }

    return response;
  }

  /**
   * Lista incidentes ativos para um utilizador autenticado.
   * @param {IncidentsQueryDto} query parâmetros de paginação e filtros (categoria, texto, propriedade do autor, latitude/longitude com raio opcional)
   * @param {string} viewerId id do utilizador autenticado
   * @returns {Promise<CursorPage<ReturnIncidentDto>>} incidentes paginados com distância e voto do utilizador quando aplicável
   */
  async findAll(
    query: IncidentsQueryDto,
    viewerId: string,
  ): Promise<CursorPage<ReturnIncidentDto>> {
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

    const limit = query.limit ?? 20;
    const hasLocationFilter = hasLat && hasLng;
    const radiusM = hasLocationFilter ? (query.radius ?? 1000) : undefined;
    const cursor =
      query.cursor !== undefined
        ? decodeCursor(query.cursor, isFeedCursor)
        : undefined;

    if (
      cursor &&
      ((hasLocationFilter && cursor.k !== 'd') ||
        (!hasLocationFilter && cursor.k !== 'c'))
    ) {
      throw new BadRequestException('Cursor inválido');
    }

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
      cursor,
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
    const lastIncident = orderedIncidents.at(-1);
    const lastRow = pageRows.find((row) => row.id === lastIncident?.id);
    let nextCursor: string | null = null;

    if (hasNextPage && lastRow) {
      if (hasLocationFilter) {
        if (typeof lastRow.distanceM !== 'number') {
          throw new InternalServerErrorException(
            'Não foi possível determinar a distância do cursor',
          );
        }
        nextCursor = encodeCursor({
          k: 'd',
          d: lastRow.distanceM,
          id: lastRow.id,
        });
      } else {
        nextCursor = encodeCursor({
          k: 'c',
          t: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        });
      }
    }

    return { data, nextCursor, hasNextPage };
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
      ? await this.incidentsRepository.findById(id)
      : await this.incidentsRepository.findVisibleById(id);
    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }
    const [result] = await this.withCoordinates([incident], viewerId);
    return result;
  }

  /**
   * Remove um incidente como soft-delete.
   * @param {string} id id do incidente
   * @param {User} user utilizador autenticado carregado da base de dados
   * @returns {Promise<{ message: string }>} mensagem de confirmação
   * @throws {NotFoundException} se o incidente não existir ou não puder ser removido pelo autor
   * @throws {ForbiddenException} se o utilizador não tiver permissão
   * @throws {ConflictException} se um administrador tentar remover um incidente já eliminado
   */
  async remove(id: string, user: User): Promise<{ message: string }> {
    const incident = await this.incidentsRepository.findById(id);
    if (!incident) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const isAdmin = user.role === UserRole.ADMIN;
    if (incident.authorId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'Não tem permissão para remover este incidente',
      );
    }
    if (isAdmin && incident.status === IncidentStatus.DELETED) {
      throw new ConflictException('Incidente já removido');
    }
    const authorCanRemove =
      incident.status === IncidentStatus.ACTIVE ||
      incident.status === IncidentStatus.EXPIRED ||
      incident.status === IncidentStatus.UNDER_REVIEW;
    if (!isAdmin && !authorCanRemove) {
      throw new NotFoundException('Incidente não encontrado');
    }

    await this.incidentsRepository.markDeleted(id, user.id);
    return { message: 'Incidente removido com sucesso' };
  }

  /**
   * Completa cada incidente com coordenadas e o voto do utilizador atual.
   * @param {Incident[]} incidents incidentes base
   * @param {string} viewerId id do utilizador autenticado
   * @returns {Promise<ReturnIncidentDto[]>} incidentes enriquecidos com coordenadas e voto
   * @throws {InternalServerErrorException} se a localização não puder ser obtida
   */
  private async withCoordinates(
    incidents: Incident[],
    viewerId: string,
    distanceById?: Map<string, number>,
  ): Promise<ReturnIncidentDto[]> {
    const incidentIds = incidents.map((incident) => incident.id);
    const [locations, media] = await Promise.all([
      this.incidentsRepository.getCoordinates(incidentIds),
      this.incidentMediaRepository.findByIncidentIds(incidentIds),
    ]);
    const coordinatesById = new Map(
      locations.map((location) => [location.id, location]),
    );
    const signedMedia = await this.mediaUrlService.toReturnDtos(media);
    const mediaByIncidentId = new Map<string, ReturnIncidentDto['media']>();
    media.forEach((item, index) => {
      const items = mediaByIncidentId.get(item.incidentId) ?? [];
      const signedItem = signedMedia[index];
      if (signedItem) items.push(signedItem);
      mediaByIncidentId.set(item.incidentId, items);
    });

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
        media: mediaByIncidentId.get(incident.id) ?? [],
      };
    });
  }
}
