import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import type { UpdateCategoryData } from '@/src/common/types/categories.types';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRole } from '@/src/common/enums/users.enums';
import { ReturnCategoryDto } from '../dto/return-category.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

/** Coordena as operações de consulta e edição de categorias. */
@Injectable()
export class CategoryService {
  /** Cria o serviço de categorias.
   * @param {CategoryRepository} repository persistência das categorias
   */
  constructor(private readonly repository: CategoryRepository) {}

  /**
   * Função que cria uma categoria. Acessado pelo controlador só por admins
   * @param {CreateCategoryDto} dto
   * @param {string} adminId administrador que cria a categoria
   * @returns {Promise<ReturnCategoryDto>}
   * @throws {BadRequestException} se o nome não puder gerar um slug válido
   */
  async create(
    dto: CreateCategoryDto,
    adminId: string,
  ): Promise<ReturnCategoryDto> {
    const name = this.normalizeName(dto.name);
    return this.repository.createCategory(
      {
        name,
        description: dto.description,
        icon: dto.icon,
        color: dto.color,
        isRisk: dto.isRisk,
        slug: this.generateSlug(name),
      },
      adminId,
    );
  }

  /**
   * Função que busca todas categorias.
   * Se usuario autenticado for ADMIN retorna todos, senão, retorna somente os ativos.
   * @param {DecodedIdToken} user utilizador autenticado
   * @returns {Promise<ReturnCategoryDto[]>} categorias visíveis ao utilizador
   */
  async findAll(user: DecodedIdToken): Promise<ReturnCategoryDto[]> {
    const categories = await this.repository.listCategories(
      user.role === UserRole.ADMIN,
    );

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
    const category =
      currentUser.role === UserRole.ADMIN
        ? await this.repository.findById(id)
        : await this.repository.findActiveById(id);
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

  /** Atualiza uma categoria e regista a auditoria no repository.
   * @param {string} id identificador da categoria
   * @param {UpdateCategoryDto} updateCategoryDto campos a atualizar
   * @param {string} adminId administrador responsável
   * @returns {Promise<ReturnCategoryDto>} categoria atualizada
   * @throws {BadRequestException} se o nome não puder gerar um slug válido
   * @throws {NotFoundException} se a categoria não existir
   */
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    adminId: string,
  ): Promise<ReturnCategoryDto> {
    const name =
      updateCategoryDto.name === undefined
        ? undefined
        : this.normalizeName(updateCategoryDto.name);
    const updateData: UpdateCategoryData = {
      ...(name !== undefined && { name, slug: this.generateSlug(name) }),
      ...(updateCategoryDto.description !== undefined && {
        description: updateCategoryDto.description,
      }),
      ...(updateCategoryDto.icon !== undefined && {
        icon: updateCategoryDto.icon,
      }),
      ...(updateCategoryDto.color !== undefined && {
        color: updateCategoryDto.color,
      }),
      ...(updateCategoryDto.isRisk !== undefined && {
        isRisk: updateCategoryDto.isRisk,
      }),
      ...(updateCategoryDto.isActive !== undefined && {
        isActive: updateCategoryDto.isActive,
      }),
    };
    return this.repository.updateCategory(id, updateData, adminId);
  }

  /** Normaliza e valida o nome usado na criação do slug.
   * @param {string} name nome apresentado
   * @returns {string} nome sem espaços laterais
   * @throws {BadRequestException} se não houver caracteres válidos
   */
  private normalizeName(name: string): string {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('O nome da categoria não pode estar vazio');
    }
    if (!this.generateSlug(normalizedName)) {
      throw new BadRequestException(
        'O nome da categoria deve conter letras ou números',
      );
    }
    return normalizedName;
  }

  /** Gera um slug ASCII a partir do nome da categoria.
   * @param {string} name nome normalizado
   * @returns {string} slug em minúsculas
   */
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
