import { PrismaService } from '../prisma/prisma.service';
import { Incident, Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * Dados necessários para criar um incidente com geolocalização.
 */
export interface CreateIncidentData {
  /**
   * Identificador do autor do incidente.
   */
  authorId: string;
  /**
   * Identificador da categoria do incidente.
   */
  categoryId: string;
  /**
   * Título do incidente.
   */
  title: string;
  /**
   * Descrição detalhada do incidente.
   */
  description: string;
  /**
   * Endereço textual opcional do incidente.
   */
  address?: string;
  /**
   * Latitude da localização do incidente.
   */
  latitude: number;
  /**
   * Longitude da localização do incidente.
   */
  longitude: number;
}

/**
 * Coordenadas geográficas de um incidente.
 */
export interface IncidentCoordinates {
  /**
   * Identificador do incidente.
   */
  id: string;
  /**
   * Latitude em graus.
   */
  latitude: number;
  /**
   * Longitude em graus.
   */
  longitude: number;
}

/**
 * Resultado bruto de pesquisa de incidentes com distância opcional.
 */
export interface IncidentSearchRow {
  /**
   * Identificador do incidente.
   */
  id: string;
  /**
   * Distância em metros até o ponto de referência, quando aplicável.
   */
  distanceM?: number | null;
}

/**
 * Repositório responsável por operações de leitura e escrita dos incidentes.
 */
@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Pesquisa os ids de incidentes aplicando filtros de categoria, texto, autoria e proximidade.
   * @param {{ categoryId?: string; search?: string; mine?: boolean; viewerId?: string; latitude?: number; longitude?: number; radiusM?: number; }} filters filtros da consulta
   * @param {number} skip quantidade de registros a ignorar
   * @param {number} take quantidade máxima de registros a devolver
   * @returns {Promise<IncidentSearchRow[]>} ids dos incidentes com distância calculada quando aplicável
   */
  async searchIds(
    filters: {
      categoryId?: string;
      search?: string;
      mine?: boolean;
      viewerId?: string;
      latitude?: number;
      longitude?: number;
      radiusM?: number;
    },
    skip: number,
    take: number,
  ): Promise<IncidentSearchRow[]> {
    const clauses: Prisma.Sql[] = [];

    const isMineMode = Boolean(filters.mine && filters.viewerId);

    if (isMineMode) {
      clauses.push(
        Prisma.sql`WHERE i."authorId" = ${filters.viewerId} AND i.status != 'DELETED'`,
      );
    } else {
      clauses.push(
        Prisma.sql`WHERE i.status = 'ACTIVE' AND i."expiresAt" > now() AND i.status NOT IN ('REMOVED', 'DELETED')`,
      );
    }

    if (filters.categoryId) {
      clauses.push(Prisma.sql`AND i."categoryId" = ${filters.categoryId}`);
    }

    if (filters.search && filters.search.trim().length > 0) {
      const pattern = `%${filters.search
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')}%`;
      clauses.push(
        Prisma.sql`AND (
          i.title ILIKE ${pattern} ESCAPE '\\' OR
          i.description ILIKE ${pattern} ESCAPE '\\'
        )`,
      );
    }

    const hasLocationFilter =
      filters.latitude !== undefined &&
      filters.longitude !== undefined &&
      filters.radiusM !== undefined;

    if (hasLocationFilter) {
      clauses.push(
        Prisma.sql`AND ST_DWithin(
          i.location,
          ST_SetSRID(ST_MakePoint(${filters.longitude}::float8, ${filters.latitude}::float8), 4326)::geography,
          ${filters.radiusM}::float8
        )`,
      );
    }

    const selectDistance = hasLocationFilter
      ? Prisma.sql`, ST_Distance(
            i.location,
            ST_SetSRID(ST_MakePoint(${filters.longitude}::float8, ${filters.latitude}::float8), 4326)::geography
          ) AS "distanceM"`
      : Prisma.sql``;

    const orderBy = hasLocationFilter
      ? Prisma.sql`ORDER BY "distanceM" ASC, i."createdAt" DESC, i.id DESC`
      : Prisma.sql`ORDER BY i."createdAt" DESC, i.id DESC`;

    const whereClause = Prisma.join(clauses, ' ');
    const query = Prisma.sql`
      SELECT i.id ${selectDistance}
      FROM incidents i
      ${whereClause}
      ${orderBy}
      LIMIT ${take}
      OFFSET ${skip}
    `;

    const rows = await this.prismaService.$queryRaw<IncidentSearchRow[]>(query);
    return rows;
  }

  /**
   * Cria um incidente e persiste a sua localização em PostGIS.
   * @param {CreateIncidentData} data dados do incidente e da geolocalização
   * @returns {Promise<string>} identificador do incidente criado
   */
  async createWithLocation(data: CreateIncidentData): Promise<string> {
    const id = randomUUID();
    await this.prismaService.$executeRaw`
      INSERT INTO incidents (
        id,
        "authorId",
        "categoryId",
        title,
        description,
        address,
        location,
        status,
        "expiresAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${data.authorId},
        ${data.categoryId},
        ${data.title},
        ${data.description},
        ${data.address ?? null},
        ST_SetSRID(ST_MakePoint(${data.longitude}::float8, ${data.latitude}::float8), 4326)::geography,
        'ACTIVE',
        now() + interval '48 hours',
        now()
      )
    `;
    return id;
  }

  /**
   * Cria um registo de mídia associado a um incidente.
   * @param {Prisma.IncidentMediaCreateInput} data payload de criação de mídia
   * @returns {Promise<Prisma.IncidentMedia>} registo criado
   */
  async createIncidentMidia(data: Prisma.IncidentMediaCreateInput) {
    return await this.prismaService.incidentMedia.create({
      data,
    });
  }

  /**
   * Busca vários incidentes pelos ids informados.
   * @param {string[]} ids identificadores dos incidentes
   * @returns {Promise<Incident[]>} incidentes encontrados na ordem do banco
   */
  async findByIds(ids: string[]): Promise<Incident[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.prismaService.incident.findMany({
      where: {
        id: { in: ids },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca o primeiro incidente que satisfaz o critério informado.
   * @param {Prisma.IncidentWhereInput} where filtro de busca
   * @returns {Promise<Incident | null>} incidente encontrado ou nulo
   */
  async findFirst(where: Prisma.IncidentWhereInput): Promise<Incident | null> {
    return this.prismaService.incident.findFirst({ where });
  }

  /**
   * Busca um incidente por chave única.
   * @param {Prisma.IncidentWhereUniqueInput} where critério único
   * @returns {Promise<Incident | null>} incidente encontrado ou nulo
   */
  async findUnique(
    where: Prisma.IncidentWhereUniqueInput,
  ): Promise<Incident | null> {
    return this.prismaService.incident.findUnique({ where });
  }

  /**
   * Obtém as coordenadas geográficas dos incidentes informados.
   * @param {string[]} ids identificadores dos incidentes
   * @returns {Promise<IncidentCoordinates[]>} coordenadas extraídas da geolocalização
   */
  async getCoordinates(ids: string[]): Promise<IncidentCoordinates[]> {
    if (ids.length === 0) return [];

    return this.prismaService.$queryRaw<IncidentCoordinates[]>`
      SELECT
        id,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM incidents
      WHERE id IN (${Prisma.join(ids)})
    `;
  }

  /**
   * Atualiza um incidente.
   * @param {Prisma.IncidentWhereUniqueInput} where critério de identificação
   * @param {Prisma.IncidentUpdateInput} data campos a atualizar
   * @returns {Promise<Incident>} incidente atualizado
   */
  async update(
    where: Prisma.IncidentWhereUniqueInput,
    data: Prisma.IncidentUpdateInput,
  ): Promise<Incident> {
    return await this.prismaService.incident.update({
      where,
      data,
    });
  }
}
