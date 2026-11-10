import { PrismaService } from '../prisma/prisma.service';
import { Category, Incident, Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return await this.prismaService.category.create({
      data,
    });
  }

  async findMany(
    where?: Prisma.CategoryWhereInput,
  ): Promise<Category[]> {
    return await this.prismaService.category.findMany({
      where,
    });
  }

  async findUnique(
    where: Prisma.CategoryWhereUniqueInput,
  ): Promise<Category | null> {
    const category = await this.prismaService.category.findUnique({
      where,
    });

    return category;
  }

  async update(
    where: Prisma.CategoryWhereUniqueInput,
    data: Prisma.CategoryUpdateInput,
  ) {
    return await this.prismaService.category.update({
      where,
      data,
    });
  }
}
