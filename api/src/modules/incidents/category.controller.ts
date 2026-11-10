import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryService } from './category.service';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CurrentUser } from '@/src/common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('categories')
@Roles(UserRole.ADMIN)
export class CategorysController {
  constructor(private readonly incidentsService: CategoryService) {}

  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.incidentsService.create(createCategoryDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.USER)
  findAll(@CurrentUser() user: DecodedIdToken) {
    return this.incidentsService.findAll(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  findOne(@CurrentUser() user: DecodedIdToken, @Param('id') id: string) {
    return this.incidentsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.incidentsService.update({ id }, updateCategoryDto);
  }
}
