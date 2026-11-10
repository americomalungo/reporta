import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incidents.repository';
import { ReturnCategoryDto } from './dto/return-category.dto';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRole } from '@/src/common/enums/users.enums';

@Injectable()
export class CategoryService {
  constructor(private readonly repository: IncidentsRepository) {}

  /**
   * Função que cria uma categoria. Acessado pelo controlador só por admins
   * @param {CreateCategoryDto} dto
   * @returns {Promise<ReturnCategoryDto>}
   */
  async create(dto: CreateCategoryDto): Promise<ReturnCategoryDto> {
    const slug = this.generateSlug(dto.name);

    const data = {
      ...dto,
      slug,
    };

    const category = await this.repository.createCategory(data);

    if (!category) {
      throw new InternalServerErrorException(
        'Não foi possível criar categoria',
      );
    }

    return category;
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

    const categories = await this.repository.findManyCategory(where);

    return categories.map(() => new ReturnCategoryDto());
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

    const category = await this.repository.findUniqueCategory(where);

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    return category;
  }

  async update(where: { id: string }, updateCategoryDto: UpdateCategoryDto) {
    const category = this.repository.updateCategory(where, updateCategoryDto);

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    return category;
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
