import { PrismaService } from '../prisma/prisma.service';
import { Category, Prisma } from '@/generated/prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isPrismaError } from '@/src/common/utils/prisma-errors';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    try {
      return await this.prismaService.category.create({ data });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Já existe uma categoria com este slug');
      }
      throw error;
    }
  }

  async findMany(where?: Prisma.CategoryWhereInput): Promise<Category[]> {
    return await this.prismaService.category.findMany({
      where,
      orderBy: { name: 'asc' },
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
    try {
      return await this.prismaService.category.update({ where, data });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Já existe uma categoria com este slug');
      }
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Categoria não encontrada');
      }
      throw error;
    }
  }
}
