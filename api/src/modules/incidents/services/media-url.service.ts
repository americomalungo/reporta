import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { IncidentMedia } from '@/src/common/types/entities.types';
import { StorageService } from '@/src/infrastructure/storage/storage.service';
import { ReturnMediaDto } from '../dto/return-media.dto';

/** Converte linhas de media em DTOs com URLs assinados em lote. */
@Injectable()
export class MediaUrlService {
  /** Cria o mapper de URLs de media.
   * @param {StorageService} storageService geração local de URLs assinados
   */
  constructor(private readonly storageService: StorageService) {}

  /** Mapeia media preservando a ordem recebida e sem assinar chaves repetidas.
   * @param {IncidentMedia[]} media linhas de media persistidas
   * @returns {Promise<ReturnMediaDto[]>} DTOs com URL de leitura assinado
   */
  async toReturnDtos(media: IncidentMedia[]): Promise<ReturnMediaDto[]> {
    const signedUrls = await this.storageService.getSignedReadUrls(
      media.map((item) => item.path),
    );
    return media.map((item) => {
      const url = signedUrls.get(item.path);
      if (!url)
        throw new InternalServerErrorException(
          'Não foi possível assinar a imagem',
        );
      return {
        id: item.id,
        url,
        width: item.width,
        height: item.height,
        sortOrder: item.sortOrder,
      };
    });
  }
}
