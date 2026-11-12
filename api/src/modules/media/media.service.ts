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
import { MediaUrlService } from './media-url.service';
import { ReturnMediaDto } from './dto/return-media.dto';
import {
  ImageProcessorService,
  type ProcessedImage,
  type UploadedImageInput,
} from './image-processor.service';

/**
 * Limite total de fotos permitido por incidente.
 */
export const MAX_MEDIA_PER_INCIDENT = 3;
/**
 * Limite do ficheiro original recebido pela API, em bytes.
 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Coordena validação, armazenamento e persistência de imagens de incidentes.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  /**
   * Injeta os repositórios e serviços de processamento e armazenamento.
   * @param {IncidentsRepository} incidentsRepository consulta dos incidentes
   * @param {IncidentMediaRepository} incidentMediaRepository persistência das imagens
   * @param {ImageProcessorService} imageProcessor validação e conversão das imagens
   * @param {StorageService} storageService armazenamento privado
   * @param {MediaUrlService} mediaUrlService conversão para URLs assinados
   */
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly incidentMediaRepository: IncidentMediaRepository,
    private readonly imageProcessor: ImageProcessorService,
    private readonly storageService: StorageService,
    private readonly mediaUrlService: MediaUrlService,
  ) {}

  /**
   * Valida, processa e associa entre uma e três fotos a um incidente ativo.
   * @param {User} user utilizador autenticado
   * @param {string} incidentId identificador do incidente
   * @param {UploadedImageInput[]} files ficheiros recebidos em memória
   * @returns {Promise<ReturnMediaDto[]>} imagens persistidas com a sua ordem
   * @throws {BadRequestException} se não forem enviadas entre uma e três imagens válidas
   * @throws {NotFoundException} se o incidente não existir ou não estiver acessível ao utilizador
   * @throws {ConflictException} se o incidente não estiver ativo ou exceder o limite de três fotos
   * @throws {BadGatewayException} se o envio de algum objeto para o armazenamento falhar
   */
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

    const incident = await this.incidentsRepository.findById(incidentId);
    if (!incident || incident.status === IncidentStatus.DELETED) {
      throw new NotFoundException('Incidente não encontrado');
    }
    if (incident.authorId !== user.id && user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Incidente não encontrado');
    }
    if (incident.status !== IncidentStatus.ACTIVE) {
      throw new ConflictException('O incidente não está ativo');
    }

    const processed: ProcessedImage[] = [];
    for (const file of files) {
      processed.push(await this.imageProcessor.process(file));
    }
    const bucket = this.storageService.getBucketName();
    const uploaded: NewMedia[] = [];

    try {
      for (const image of processed) {
        const path = `incidents/${incidentId}/${randomUUID()}.webp`;
        await this.storageService.upload(path, image.buffer, image.mimeType);
        uploaded.push(
          this.toNewMedia(
            path,
            this.storageService.getInternalReference(path),
            bucket,
            image,
          ),
        );
      }
    } catch (error: unknown) {
      await this.removeUploadedObjects(uploaded);
      this.logger.error(
        `Falha ao enviar imagens do incidente ${incidentId} para o armazenamento`,
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
    return this.mediaUrlService.toReturnDtos(media);
  }

  /**
   * Apaga a linha da foto e tenta remover o objeto correspondente do armazenamento.
   * @param {User} user utilizador autenticado
   * @param {string} incidentId identificador do incidente
   * @param {string} mediaId identificador da imagem
   * @returns {Promise<{ message: string }>} confirmação da remoção
   * @throws {NotFoundException} se o incidente ou a imagem não existir ou não estiver acessível
   */
  async remove(
    user: User,
    incidentId: string,
    mediaId: string,
  ): Promise<{ message: string }> {
    const incident = await this.incidentsRepository.findById(incidentId);
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

    try {
      await this.storageService.remove([media.path]);
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao remover a imagem ${media.id} do armazenamento`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
    await this.incidentMediaRepository.deleteById(media.id);
    return { message: 'Imagem removida' };
  }

  /**
   * Converte os dados processados para o formato persistido no repository.
   * @param {string} path chave do objeto no bucket
   * @param {string} url referência interna do objeto, inacessível publicamente
   * @param {string} bucket nome do bucket privado
   * @param {ProcessedImage} image conteúdo e metadados da imagem processada
   * @returns {NewMedia} dados prontos para persistência
   */
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

  /**
   * Compensa falhas removendo os objetos já enviados para o armazenamento.
   * @param {NewMedia[]} items objetos enviados durante o pedido
   * @returns {Promise<void>} conclusão da tentativa de compensação
   */
  private async removeUploadedObjects(items: NewMedia[]): Promise<void> {
    if (items.length === 0) return;
    try {
      await this.storageService.remove(items.map((item) => item.path));
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao compensar objetos enviados para o armazenamento',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
