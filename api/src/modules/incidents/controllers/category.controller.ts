import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { ReturnCategoryDto } from '../dto/return-category.dto';
import { CategoryService } from '../services/category.service';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CurrentUser } from '@/src/common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  findAll(@CurrentUser() user: DecodedIdToken): Promise<ReturnCategoryDto[]> {
    return this.categoryService.findAll(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  findOne(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ReturnCategoryDto> {
    return this.categoryService.update(id, updateCategoryDto);
  }
}
