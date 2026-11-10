import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { IncidentsService } from '../services/incidents.service';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { CurrentUser } from '@/src/common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { IncidentsQueryDto } from '../dto/incidents-query.dto';

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
  findAll(@Query() query: IncidentsQueryDto) {
    return this.incidentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: DecodedIdToken) {
    return this.incidentsService.findOne(id, currentUser);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: DecodedIdToken) {
    return this.incidentsService.remove(id, currentUser);
  }
}
