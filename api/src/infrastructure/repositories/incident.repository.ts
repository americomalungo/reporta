import { PrismaService } from '../prisma/prisma.service';
import { Incident, Prisma } from '@/generated/prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isPrismaError } from '../prisma/prisma-errors';
import type { IncidentSearchCursor } from '@/src/common/types/incidents.types';
import { REPUTATION_INCIDENT_CREATED } from '@/src/common/constants/reputation.constants';

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
   * Data de criação usada como cursor quando a pesquisa não é por proximidade.
   */
  createdAt: Date;
  /**
   * Distância em metros até o ponto de referência, quando aplicável.
   */
  distanceM?: number | null;
}

/**
 * Dados mínimos do incidente para decidir se deve gerar alerta de risco.
 */
export interface IncidentRiskAlertData {
  /**
   * Identificador do incidente.
   */
  id: string;

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
   * Estado atual do incidente.
   */
  status: Incident['status'];

  /**
   * Nome da categoria associada.
   */
  categoryName: string;

  /**
   * Indica se a categoria gera alertas de risco.
   */
  isRisk: boolean;
}

/**
 * Repositório responsável por operações de leitura e escrita dos incidentes.
 */
@Injectable()
export class IncidentsRepository {
  /**
   * Cria o repository de incidentes.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Pesquisa os ids de incidentes aplicando filtros de categoria, texto, autoria e proximidade.
   * @param {{ categoryId?: string; search?: string; mine?: boolean; viewerId?: string; latitude?: number; longitude?: number; radiusM?: number; }} filters filtros da consulta
   * @param {IncidentSearchCursor | undefined} cursor posição a partir da qual continuar a pesquisa
   * @param {number} take quantidade máxima de registros a devolver
   * @returns {Promise<IncidentSearchRow[]>} ids dos incidentes com distância calculada quando aplicável
   * @throws {Error} se a consulta de pesquisa falhar
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
    cursor: IncidentSearchCursor | undefined,
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

    if (!hasLocationFilter && cursor?.k === 'c') {
      clauses.push(
        Prisma.sql`AND (i."createdAt", i.id) < ((${cursor.t}::timestamptz AT TIME ZONE 'UTC')::timestamp(3), ${cursor.id})`,
      );
    }

    const whereClause = Prisma.join(clauses, ' ');
    const query = hasLocationFilter
      ? Prisma.sql`
          WITH candidates AS (
            SELECT i.id, i."createdAt" ${selectDistance}
            FROM incidents i
            ${whereClause}
          )
          SELECT id, "createdAt", "distanceM"
          FROM candidates
          ${
            cursor?.k === 'd'
              ? Prisma.sql`WHERE ("distanceM", id) > (${cursor.d}::float8, ${cursor.id})`
              : Prisma.sql``
          }
          ORDER BY "distanceM" ASC, id ASC
          LIMIT ${take}
        `
      : Prisma.sql`
          SELECT i.id, i."createdAt"
          FROM incidents i
          ${whereClause}
          ORDER BY i."createdAt" DESC, i.id DESC
          LIMIT ${take}
        `;

    const rows = await this.prismaService.$queryRaw<IncidentSearchRow[]>(query);
    return rows;
  }

  /**
   * Cria um incidente e persiste a sua localização em PostGIS.
   * @param {CreateIncidentData} data dados do incidente e da geolocalização
   * @returns {Promise<string>} identificador do incidente criado
   * @throws {Error} se a inserção do incidente ou da localização falhar
   */
  async createWithLocation(data: CreateIncidentData): Promise<string> {
    const id = randomUUID();
    await this.prismaService.$transaction(async (transaction) => {
      await transaction.$executeRaw`
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
      await transaction.$executeRaw`
        UPDATE users
        SET "reputationScore" = GREATEST("reputationScore" + ${REPUTATION_INCIDENT_CREATED}, 0),
            "updatedAt" = now()
        WHERE id = ${data.authorId}
      `;
    });
    return id;
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
   * Procura um incidente pelo identificador.
   * @param {string} id identificador do incidente
   * @returns {Promise<Incident | null>} incidente encontrado ou null
   */
  async findById(id: string): Promise<Incident | null> {
    return this.prismaService.incident.findUnique({ where: { id } });
  }

  /**
   * Procura um incidente visível, excluindo os estados removido e eliminado.
   * @param {string} id identificador do incidente
   * @returns {Promise<Incident | null>} incidente visível encontrado ou null
   */
  async findVisibleById(id: string): Promise<Incident | null> {
    return this.prismaService.incident.findFirst({
      where: { id, status: { notIn: ['REMOVED', 'DELETED'] } },
    });
  }

  /**
   * Obtém os dados do incidente e da categoria usados no despacho de alerta.
   * @param {string} incidentId id do incidente
   * @returns {Promise<IncidentRiskAlertData | null>} dados do alerta ou null se o incidente não existir
   */
  async findRiskAlertData(
    incidentId: string,
  ): Promise<IncidentRiskAlertData | null> {
    const incident = await this.prismaService.incident.findUnique({
      where: { id: incidentId },
      select: {
        id: true,
        authorId: true,
        categoryId: true,
        title: true,
        status: true,
        category: {
          select: {
            name: true,
            isRisk: true,
          },
        },
      },
    });

    if (!incident) {
      return null;
    }

    return {
      id: incident.id,
      authorId: incident.authorId,
      categoryId: incident.categoryId,
      title: incident.title,
      status: incident.status,
      categoryName: incident.category.name,
      isRisk: incident.category.isRisk,
    };
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
   * Marca um incidente como eliminado e regista quem executou a ação.
   * @param {string} id identificador do incidente
   * @param {string} actorId identificador do utilizador que executa a ação
   * @returns {Promise<Incident>} incidente atualizado
   * @throws {NotFoundException} se o incidente não existir
   */
  async markDeleted(id: string, actorId: string): Promise<Incident> {
    try {
      return await this.prismaService.incident.update({
        where: { id },
        data: {
          status: 'DELETED',
          removedAt: new Date(),
          removedBy: actorId,
        },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Incidente não encontrado');
      }
      throw error;
    }
  }
}
