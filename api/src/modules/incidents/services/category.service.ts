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
import { CacheService } from '@/src/infrastructure/cache/cache.service';
import {
  ACTIVE_CATEGORIES_CACHE_KEY,
  CATEGORY_CACHE_TTL_MS,
} from '@/src/common/constants/categories.constants';

/** Guards a serializable array of category response objects.
 * @param {unknown} value untrusted cached value
 * @returns {value is ReturnCategoryDto[]} true if every category field matches its DTO type
 */
function isReturnCategoryArray(value: unknown): value is ReturnCategoryDto[] {
  return (
    Array.isArray(value) &&
    value.every(
      (category) =>
        typeof category === 'object' &&
        category !== null &&
        'id' in category &&
        typeof category.id === 'string' &&
        'name' in category &&
        typeof category.name === 'string' &&
        'description' in category &&
        (typeof category.description === 'string' ||
          category.description === null) &&
        'icon' in category &&
        (typeof category.icon === 'string' || category.icon === null) &&
        'color' in category &&
        (typeof category.color === 'string' || category.color === null) &&
        'isRisk' in category &&
        typeof category.isRisk === 'boolean' &&
        'slug' in category &&
        typeof category.slug === 'string' &&
        'isActive' in category &&
        typeof category.isActive === 'boolean',
    )
  );
}

/** Coordena as operações de consulta e edição de categorias. */
@Injectable()
export class CategoryService {
  /** Cria o serviço de categorias.
   * @param {CategoryRepository} repository persistência das categorias
   * @param {CacheService} cacheService active category cache
   */
  constructor(
    private readonly repository: CategoryRepository,
    private readonly cacheService: CacheService,
  ) {}

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
    const category = await this.repository.createCategory(
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
    await this.cacheService.del(ACTIVE_CATEGORIES_CACHE_KEY);
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      isRisk: category.isRisk,
      slug: category.slug,
      isActive: category.isActive,
    };
  }

  /**
   * Função que busca todas categorias.
   * Se usuario autenticado for ADMIN retorna todos, senão, retorna somente os ativos.
   * @param {DecodedIdToken} user utilizador autenticado
   * @returns {Promise<ReturnCategoryDto[]>} categorias visíveis ao utilizador
   */
  async findAll(user: DecodedIdToken): Promise<ReturnCategoryDto[]> {
    const includeInactive = user.role === UserRole.ADMIN;
    const loadCategories = async (): Promise<ReturnCategoryDto[]> => {
      const categories = await this.repository.listCategories(includeInactive);
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
    };
    if (includeInactive) return loadCategories();
    return this.cacheService.wrap(
      ACTIVE_CATEGORIES_CACHE_KEY,
      CATEGORY_CACHE_TTL_MS,
      isReturnCategoryArray,
      loadCategories,
    );
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
    const category = await this.repository.updateCategory(
      id,
      updateData,
      adminId,
    );
    await this.cacheService.del(ACTIVE_CATEGORIES_CACHE_KEY);
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      isRisk: category.isRisk,
      slug: category.slug,
      isActive: category.isActive,
    };
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
