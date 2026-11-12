import { Module } from '@nestjs/common';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { IncidentMediaController, MulterUploadErrorInterceptor } from './media.controller';
import { ImageProcessorService } from './image-processor.service';
import { MediaService } from './media.service';
import { MediaUrlService } from './media-url.service';

@Module({
  controllers: [IncidentMediaController],
  providers: [
    MediaService,
    ImageProcessorService,
    MediaUrlService,
    IncidentMediaRepository,
    IncidentsRepository,
    MulterUploadErrorInterceptor,
  ],
  exports: [MediaUrlService, IncidentMediaRepository],
})
export class MediaModule {}
