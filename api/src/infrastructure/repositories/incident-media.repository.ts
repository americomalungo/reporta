import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '@/generated/prisma';
import type { IncidentMedia } from '@/src/common/types/entities.types';
import { PrismaService } from '../prisma/prisma.service';

/** Dados de uma imagem já processada, prontos para persistir. */
export interface NewMedia {
  /** Bucket que contém a imagem. */
  bucket: string;
  /** Chave da imagem no bucket. */
  path: string;
  /** URL pública da imagem. */
  url: string;
  /** Tipo MIME do ficheiro processado. */
  mimeType: string;
  /** Tamanho em bytes do ficheiro processado. */
  sizeBytes: number;
  /** Largura da imagem processada em píxeis. */
  width: number;
  /** Altura da imagem processada em píxeis. */
  height: number;
}

/** Gere a persistência das imagens associadas a incidentes. */
@Injectable()
export class IncidentMediaRepository {
  /** Injeta o acesso à base de dados. */
  constructor(private readonly prismaService: PrismaService) {}

  /** Bloqueia o incidente, verifica o limite e insere as imagens em sequência. */
  async addForIncident(
    incidentId: string,
    items: NewMedia[],
    maxPerIncident: number,
  ): Promise<IncidentMedia[]> {
    return this.prismaService.$transaction(async (transaction) => {
      const incidents = await transaction.$queryRaw<
        { id: string; status: string }[]
      >`
        SELECT id, status FROM incidents WHERE id = ${incidentId} FOR UPDATE
      `;
      if (incidents.length === 0) {
        throw new NotFoundException('Incidente não encontrado');
      }
      if (incidents[0]?.status !== 'ACTIVE') {
        throw new ConflictException('O incidente não está ativo');
      }

      const existingCount = await transaction.incidentMedia.count({
        where: { incidentId },
      });
      if (existingCount + items.length > maxPerIncident) {
        throw new ConflictException('Limite de 3 fotos por incidente');
      }
      const lastSortOrder = await transaction.incidentMedia.aggregate({
        where: { incidentId },
        _max: { sortOrder: true },
      });
      const nextSortOrder = (lastSortOrder._max.sortOrder ?? -1) + 1;

      return Promise.all(
        items.map((item, index) =>
          transaction.incidentMedia.create({
            data: {
              incidentId,
              type: MediaType.IMAGE,
              bucket: item.bucket,
              path: item.path,
              url: item.url,
              mimeType: item.mimeType,
              sizeBytes: item.sizeBytes,
              width: item.width,
              height: item.height,
              sortOrder: nextSortOrder + index,
            },
          }),
        ),
      );
    });
  }

  /** Procura uma imagem dentro do incidente indicado. */
  async findById(
    mediaId: string,
    incidentId: string,
  ): Promise<IncidentMedia | null> {
    return this.prismaService.incidentMedia.findFirst({
      where: { id: mediaId, incidentId },
    });
  }

  /** Apaga uma imagem pelo identificador. */
  async deleteById(mediaId: string): Promise<void> {
    await this.prismaService.incidentMedia.delete({ where: { id: mediaId } });
  }

  /** Procura imagens de vários incidentes na ordem de apresentação definida. */
  async findByIncidentIds(ids: string[]): Promise<IncidentMedia[]> {
    if (ids.length === 0) return [];
    return this.prismaService.incidentMedia.findMany({
      where: { incidentId: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Apaga várias linhas de imagem e devolve a quantidade removida. */
  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prismaService.incidentMedia.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }
}
