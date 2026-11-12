import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import {
  CurrentDbUser,
  CurrentUser,
} from '@/src/common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '@/src/common/types/entities.types';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { ReturnCategoryDto } from '../dto/return-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryService } from '../services/category.service';

/** Endpoints de consulta e administração de categorias. */
@Controller('categories')
export class CategoriesController {
  /** Cria o controller de categorias.
   * @param {CategoryService} categoryService operações de categoria
   */
  constructor(private readonly categoryService: CategoryService) {}

  /** POST /categories — cria uma categoria e regista a auditoria.
   * @param {User} admin administrador autenticado
   * @param {CreateCategoryDto} createCategoryDto dados da categoria
   * @returns {Promise<ReturnCategoryDto>} categoria criada
   */
  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @CurrentDbUser() admin: User,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.create(createCategoryDto, admin.id);
  }

  /** GET /categories — lista categorias visíveis ao utilizador.
   * @param {DecodedIdToken} user token do utilizador autenticado
   * @returns {Promise<ReturnCategoryDto[]>} categorias disponíveis
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  findAll(@CurrentUser() user: DecodedIdToken): Promise<ReturnCategoryDto[]> {
    return this.categoryService.findAll(user);
  }

  /** GET /categories/:id — consulta uma categoria.
   * @param {DecodedIdToken} user token do utilizador autenticado
   * @param {string} id identificador da categoria
   * @returns {Promise<ReturnCategoryDto>} categoria encontrada
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  findOne(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.findOne(user, id);
  }

  /** PATCH /categories/:id — atualiza uma categoria e regista a auditoria.
   * @param {User} admin administrador autenticado
   * @param {string} id identificador da categoria
   * @param {UpdateCategoryDto} updateCategoryDto campos a alterar
   * @returns {Promise<ReturnCategoryDto>} categoria atualizada
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.update(id, updateCategoryDto, admin.id);
  }
}
