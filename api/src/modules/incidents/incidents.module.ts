import { Module } from '@nestjs/common';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { CategoriesController } from './controllers/category.controller';
import { IncidentsController } from './controllers/incidents.controller';
import { VotesController } from './controllers/votes.controller';
import { CategoryService } from './services/category.service';
import { IncidentsService } from './services/incidents.service';
import { VotesService } from './services/votes.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [IncidentsController, CategoriesController, VotesController],
  providers: [
    IncidentsService,
    VotesService,
    CategoryService,
    CategoryRepository,
    IncidentsRepository,
    VoteRepository,
  ],
})
export class IncidentsModule {}
