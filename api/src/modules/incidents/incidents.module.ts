import { Module } from '@nestjs/common';
import { IncidentsService } from './services/incidents.service';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { CategoriesController } from './controllers/category.controller';
import { CategoryService } from './services/category.service';
import { IncidentsController } from './controllers/incidents.controller';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [IncidentsController, CategoriesController],
  providers: [
    IncidentsService,
    CategoryService,
    CategoryRepository,
    IncidentsRepository,
  ],
})
export class IncidentsModule {}
