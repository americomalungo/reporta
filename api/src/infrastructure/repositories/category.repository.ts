import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category } from '@/src/common/types/entities.types';
import type {
  CreateCategoryData,
  UpdateCategoryData,
} from '@/src/common/types/categories.types';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError } from '../prisma/prisma-errors';

/**
 * Persiste e consulta categorias através da base de dados.
 */
@Injectable()
export class CategoryRepository {
  /**
   * Cria o repository de categorias.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Cria uma categoria com os dados de domínio recebidos.
   * @param {CreateCategoryData} data dados de criação da categoria
   * @returns {Promise<Category>} categoria persistida
   * @throws {ConflictException} se já existir uma categoria com o mesmo slug
   */
  async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      return await this.prismaService.category.create({ data });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Já existe uma categoria com este slug');
      }
      throw error;
    }
  }

  /**
   * Lista categorias, incluindo inativas apenas quando solicitado.
   * @param {boolean} includeInactive indica se as categorias inativas são incluídas
   * @returns {Promise<Category[]>} categorias ordenadas pelo nome
   */
  async listCategories(includeInactive: boolean): Promise<Category[]> {
    return this.prismaService.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Procura uma categoria pelo respetivo identificador.
   * @param {string} id identificador da categoria
   * @returns {Promise<Category | null>} categoria encontrada ou null
   */
  async findById(id: string): Promise<Category | null> {
    return this.prismaService.category.findUnique({ where: { id } });
  }

  /**
   * Procura uma categoria ativa pelo respetivo identificador.
   * @param {string} id identificador da categoria
   * @returns {Promise<Category | null>} categoria ativa encontrada ou null
   */
  async findActiveById(id: string): Promise<Category | null> {
    return this.prismaService.category.findFirst({
      where: { id, isActive: true },
    });
  }

  /**
   * Atualiza os campos de domínio de uma categoria.
   * @param {string} id identificador da categoria
   * @param {UpdateCategoryData} data campos de categoria a atualizar
   * @returns {Promise<Category>} categoria atualizada
   * @throws {ConflictException} se o novo slug já estiver em uso
   * @throws {NotFoundException} se a categoria não existir
   */
  async updateCategory(
    id: string,
    data: UpdateCategoryData,
  ): Promise<Category> {
    try {
      return await this.prismaService.category.update({
        where: { id },
        data,
      });
    } catch (error: unknown) {
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
