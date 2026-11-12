import { Module } from '@nestjs/common';
import { CategoryRepository } from '@/src/infrastructure/repositories/category.repository';
import { CommentRepository } from '@/src/infrastructure/repositories/comment.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
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
import { AlertsModule } from '../alerts/alerts.module';
import {
  IncidentMediaController,
  MulterUploadErrorInterceptor,
} from './controllers/incident-media.controller';
import { IncidentMediaService } from './services/incident-media.service';
import { ImageProcessorService } from './services/image-processor.service';

@Module({
  imports: [UsersModule, AlertsModule],
  controllers: [
    IncidentsController,
    CategoriesController,
    VotesController,
    CommentsController,
    IncidentMediaController,
  ],
  providers: [
    IncidentsService,
    IncidentMediaService,
    ImageProcessorService,
    MulterUploadErrorInterceptor,
    VotesService,
    CommentsService,
    CategoryService,
    CategoryRepository,
    CommentRepository,
    IncidentsRepository,
    IncidentMediaRepository,
    VoteRepository,
  ],
})
export class IncidentsModule {}
