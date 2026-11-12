import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import { UserRole } from '@/src/common/enums/users.enums';
import type { User } from '@/src/common/types/entities.types';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import type { NewMedia } from '@/src/infrastructure/repositories/incident-media.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { StorageService } from '@/src/infrastructure/storage/storage.service';
import { ReturnMediaDto } from '../dto/return-media.dto';
import {
  ImageProcessorService,
  type ProcessedImage,
  type UploadedImageInput,
} from './image-processor.service';

/** Limite total de fotos permitido por incidente. */
export const MAX_MEDIA_PER_INCIDENT = 3;
/** Limite do ficheiro original recebido pela API, em bytes. */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Coordena validação, armazenamento e persistência de imagens de incidentes. */
@Injectable()
export class IncidentMediaService {
  private readonly logger = new Logger(IncidentMediaService.name);

  /** Injeta os repositórios e serviços de processamento e armazenamento. */
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly incidentMediaRepository: IncidentMediaRepository,
    private readonly imageProcessor: ImageProcessorService,
    private readonly storageService: StorageService,
  ) {}

  /** Valida, processa e associa entre uma e três fotos a um incidente ativo. */
  async upload(
    user: User,
    incidentId: string,
    files: UploadedImageInput[],
  ): Promise<ReturnMediaDto[]> {
    if (files.length < 1 || files.length > MAX_MEDIA_PER_INCIDENT) {
      throw new BadRequestException('Envie entre 1 e 3 ficheiros de imagem');
    }
    if (files.some((file) => file.size > MAX_IMAGE_SIZE_BYTES)) {
      throw new BadRequestException('Cada imagem deve ter no máximo 5 MB');
    }

    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });
    if (!incident || incident.status === IncidentStatus.DELETED) {
      throw new NotFoundException('Incidente não encontrado');
    }
    if (incident.authorId !== user.id && user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Incidente não encontrado');
    }
    if (incident.status !== IncidentStatus.ACTIVE) {
      throw new ConflictException('O incidente não está ativo');
    }

    const processed = await Promise.all(
      files.map((file) => this.imageProcessor.process(file)),
    );
    const bucket = this.storageService.getBucketName();
    const uploaded: NewMedia[] = [];

    try {
      for (const image of processed) {
        const path = `incidents/${incidentId}/${randomUUID()}.webp`;
        const url = await this.storageService.upload(
          path,
          image.buffer,
          image.mimeType,
        );
        uploaded.push(this.toNewMedia(path, url, bucket, image));
      }
    } catch (error: unknown) {
      await this.removeUploadedObjects(uploaded);
      this.logger.error(
        `Falha ao enviar imagens do incidente ${incidentId} para o R2`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException('Falha ao guardar as imagens');
    }

    const media = await this.incidentMediaRepository
      .addForIncident(incidentId, uploaded, MAX_MEDIA_PER_INCIDENT)
      .catch(async (error: unknown) => {
        await this.removeUploadedObjects(uploaded);
        throw error;
      });
    return media.map((item) => ({
      id: item.id,
      url: item.url,
      width: item.width,
      height: item.height,
      sortOrder: item.sortOrder,
    }));
  }

  /** Apaga a linha da foto e tenta remover o objeto correspondente do R2. */
  async remove(
    user: User,
    incidentId: string,
    mediaId: string,
  ): Promise<{ message: string }> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });
    if (
      !incident ||
      incident.status === IncidentStatus.DELETED ||
      (incident.authorId !== user.id && user.role !== UserRole.ADMIN)
    ) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const media = await this.incidentMediaRepository.findById(
      mediaId,
      incidentId,
    );
    if (!media) throw new NotFoundException('Imagem não encontrada');

    await this.incidentMediaRepository.deleteById(media.id);
    try {
      await this.storageService.remove([media.path]);
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao remover a imagem ${media.id} do R2`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return { message: 'Imagem removida' };
  }

  /** Converte os dados processados para o formato persistido no repository. */
  private toNewMedia(
    path: string,
    url: string,
    bucket: string,
    image: ProcessedImage,
  ): NewMedia {
    return {
      bucket,
      path,
      url,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
    };
  }

  /** Compensa falhas removendo os objetos já enviados para o R2. */
  private async removeUploadedObjects(items: NewMedia[]): Promise<void> {
    if (items.length === 0) return;
    try {
      await this.storageService.remove(items.map((item) => item.path));
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao compensar objetos enviados para o R2',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
