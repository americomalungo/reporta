import { PrismaService } from '../prisma/prisma.service';
import { Category, Incident, Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async createIncidentMidia(data: Prisma.IncidentMediaCreateInput) {
    return await this.prismaService.incidentMedia.create({
      data,
    });
  }

  async findMany(where?: Prisma.IncidentWhereUniqueInput): Promise<Incident[]> {
    return await this.prismaService.incident.findMany({
      where,
    });
  }

  async findUnique(
    where: Prisma.IncidentWhereUniqueInput,
  ): Promise<Incident | null> {
    const category = await this.prismaService.incident.findUnique({
      where,
    });

    return category;
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
