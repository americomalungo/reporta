import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { CategorysController } from './category.controller';
import { CategoryService } from './category.service';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incidents.repository';

@Module({
  controllers: [IncidentsController, CategorysController],
  providers: [IncidentsService, CategoryService, IncidentsRepository],
})
export class IncidentsModule {}
