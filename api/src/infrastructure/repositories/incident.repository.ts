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

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

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
        ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)::geography,
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
