import { Injectable, NotFoundException } from '@nestjs/common';
import { IncidentsRepository } from '@/src/infrastructure/repositories/category.repository';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRole } from '@/src/common/enums/users.enums';
import { ReturnCategoryDto } from '../dto/return-category.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly repository: IncidentsRepository) {}

  /**
   * Função que cria uma categoria. Acessado pelo controlador só por admins
   * @param {CreateCategoryDto} dto
   * @returns {Promise<ReturnCategoryDto>}
   */
  async create(dto: CreateCategoryDto): Promise<ReturnCategoryDto> {
    try {
      const slug = this.generateSlug(dto.name);
      const data = {
        ...dto,
        slug,
      };
      return await this.repository.create(data);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Função que busca todas categorias.
   * Se usuario autenticado for ADMIN retorna todos, senão, retorna somente os ativos
   * @async
   * @param {DecodedIdToken} user
   * @returns {Promise<ReturnCategoryDto[]>}
   */
  async findAll(user: DecodedIdToken): Promise<ReturnCategoryDto[]> {
    const where = user.role === UserRole.ADMIN ? {} : { isActive: true };

    const categories = await this.repository.findMany(where);

    if (!categories) {
      throw new NotFoundException('Categorias não encontradas');
    }
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      isRisk: category.isRisk,
      slug: category.slug,
      isActive: category.isActive,
    }));
  }

  /**
   *  Função que busca uma categoria.
   * Se usuario autenticado for USER, retorna somente se for ativos
   * @param {DecodedIdToken} currentUser
   * @param {string} id
   * @returns {Promise<ReturnCategoryDto>}
   */
  async findOne(
    currentUser: DecodedIdToken,
    id: string,
  ): Promise<ReturnCategoryDto> {
    const where =
      currentUser.role === UserRole.ADMIN ? { id } : { id, isActive: true };
    const category = await this.repository.findUnique(where);
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return {
      id: category?.id,
      name: category?.name,
      description: category?.description,
      icon: category?.icon,
      color: category?.color,
      isRisk: category?.isRisk,
      slug: category?.slug,
      isActive: category?.isActive,
    };
  }

  async update(where: { id: string }, updateCategoryDto: UpdateCategoryDto) {
    try {
      const category = await this.repository.update(
        where,
        updateCategoryDto,
      );
      return category;
    } catch (error) {
      throw error;
    }
  }

  private generateSlug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }
}
