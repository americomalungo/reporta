import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '@/src/common/decorators/current-user.decorator';
import { AllowUnregistered } from '@/src/common/decorators/allow-unregistered.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: DecodedIdToken) {
    return this.usersService.me(user);
  }

  @AllowUnregistered()
  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: DecodedIdToken,
  ) {
    return this.usersService.create(dto, currentUser);
  }

  @Get()
  findAll(@CurrentUser() user: DecodedIdToken) {
    return this.usersService.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: DecodedIdToken, @Param('id') id: string) {
    return this.usersService.findOne(user, { id: id });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: DecodedIdToken,
  ) {
    return this.usersService.update({ id: id }, updateUserDto, currentUser);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: DecodedIdToken) {
    return this.usersService.remove({ id }, currentUser);
  }
}
