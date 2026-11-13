import { Module } from '@nestjs/common';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { CommentRepository } from '@/src/infrastructure/repositories/comment.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { VoteRepository } from '@/src/infrastructure/repositories/vote.repository';
import { CategoriesController } from './controllers/category.controller';
import { CommentsController } from './controllers/comments.controller';
import { IncidentsController } from './controllers/incidents.controller';
import { VotesController } from './controllers/votes.controller';
import { CategoryService } from './services/category.service';
import { CommentsService } from './services/comments.service';
import { IncidentsService } from './services/incidents.service';
import { VotesService } from './services/votes.service';
import { UsersModule } from '../users/users.module';
import { ModerationModule } from '../moderation/moderation.module';
import { MediaModule } from '../media/media.module';

/** Module containing incident, category, vote, and comment features. */
@Module({
  imports: [UsersModule, ModerationModule, MediaModule],
  controllers: [
    IncidentsController,
    CategoriesController,
    VotesController,
    CommentsController,
  ],
  providers: [
    IncidentsService,
    VotesService,
    CommentsService,
    CategoryService,
    CategoryRepository,
    CommentRepository,
    IncidentsRepository,
    VoteRepository,
  ],
})
export class IncidentsModule {}
