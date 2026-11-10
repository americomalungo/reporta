import { Module } from '@nestjs/common';
import { IncidentsService } from './services/incidents.service';
import { IncidentsRepository } from '@/src/infrastructure/repositories/category.repository';
import { CategorysController } from './controllers/category.controller';
import { CategoryService } from './services/category.service';
import { IncidentsController } from './controllers/incidents.controller';

@Module({
  controllers: [IncidentsController, CategorysController],
  providers: [IncidentsService, CategoryService, IncidentsRepository],
})
export class IncidentsModule {}
