import { PrismaService } from '../prisma/prisma.service';
import { Category, Prisma } from '@/generated/prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    try {
      return await this.prismaService.category.create({ data });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
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
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException('Já existe uma categoria com este slug');
      }
      if (this.isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Categoria não encontrada');
      }
      throw error;
    }
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}
