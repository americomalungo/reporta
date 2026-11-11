import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '@/generated/prisma';
import {
  CurrentDbUser,
  CurrentUser,
} from '@/src/common/decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';
import { IncidentsService } from '../services/incidents.service';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @CurrentUser() currentUser: DecodedIdToken,
  ) {
    return this.incidentsService.create(createIncidentDto, currentUser);
  }

  @Get()
  findAll(
    @Query() query: IncidentsQueryDto,
    @CurrentUser() currentUser: DecodedIdToken,
    @CurrentDbUser() dbUser: User,
  ) {
    return this.incidentsService.findAll(
      query,
      dbUser.id,
      currentUser.role === UserRole.ADMIN,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: DecodedIdToken,
    @CurrentDbUser() dbUser: User,
  ) {
    return this.incidentsService.findOne(
      id,
      dbUser.id,
      currentUser.role === UserRole.ADMIN,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: DecodedIdToken) {
    return this.incidentsService.remove(id, currentUser);
  }
}
