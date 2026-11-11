import { PrismaService } from '../prisma/prisma.service';
import { Incident, Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface CreateIncidentData {
  authorId: string;
  categoryId: string;
  title: string;
  description: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface IncidentCoordinates {
  id: string;
  latitude: number;
  longitude: number;
}

export interface IncidentSearchRow {
  id: string;
  distanceM?: number | null;
}

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

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

  async createIncidentMidia(data: Prisma.IncidentMediaCreateInput) {
    return await this.prismaService.incidentMedia.create({
      data,
    });
  }

  async findMany(
    where: Prisma.IncidentWhereInput,
    skip: number,
    take: number,
  ): Promise<Incident[]> {
    return await this.prismaService.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

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

  async findFirst(where: Prisma.IncidentWhereInput): Promise<Incident | null> {
    return this.prismaService.incident.findFirst({ where });
  }

  async findUnique(
    where: Prisma.IncidentWhereUniqueInput,
  ): Promise<Incident | null> {
    return this.prismaService.incident.findUnique({ where });
  }

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

  async update(
    where: Prisma.IncidentWhereUniqueInput,
    data: Prisma.IncidentUpdateInput,
  ) {
    return await this.prismaService.incident.update({
      where,
      data,
    });
  }
}
