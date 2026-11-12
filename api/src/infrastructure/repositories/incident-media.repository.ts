import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '@/generated/prisma';
import type { IncidentMedia } from '@/src/common/types/entities.types';
import { PrismaService } from '../prisma/prisma.service';
import type { RemovableMediaRecord } from '@/src/common/types/maintenance.types';
import {
  MEDIA_GRACE_AFTER_REMOVAL_HOURS,
  MEDIA_RETENTION_AFTER_EXPIRY_DAYS,
} from '@/src/common/constants/maintenance.constants';

/**
 * Dados de uma imagem já processada, prontos para persistir.
 */
export interface NewMedia {
  /**
   * Bucket que contém a imagem.
   */
  bucket: string;
  /**
   * Chave da imagem no bucket.
   */
  path: string;
  /**
   * Referência interna do objeto, não acessível publicamente.
   */
  url: string;
  /**
   * Tipo MIME do ficheiro processado.
   */
  mimeType: string;
  /**
   * Tamanho em bytes do ficheiro processado.
   */
  sizeBytes: number;
  /**
   * Largura da imagem processada em píxeis.
   */
  width: number;
  /**
   * Altura da imagem processada em píxeis.
   */
  height: number;
}

/**
 * Gere a persistência das imagens associadas a incidentes.
 */
@Injectable()
export class IncidentMediaRepository {
  /**
   * Injeta o acesso à base de dados.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Bloqueia o incidente, verifica o limite e insere as imagens em sequência.
   * @param {string} incidentId identificador do incidente
   * @param {NewMedia[]} items imagens processadas a inserir
   * @param {number} maxPerIncident limite de imagens permitido
   * @returns {Promise<IncidentMedia[]>} registos criados na ordem atribuída
   * @throws {NotFoundException} se o incidente não existir
   * @throws {ConflictException} se o incidente não estiver ativo ou ultrapassar o limite
   */
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

  /**
   * Procura uma imagem dentro do incidente indicado.
   * @param {string} mediaId identificador da imagem
   * @param {string} incidentId identificador do incidente
   * @returns {Promise<IncidentMedia | null>} imagem encontrada ou null
   */
  async findById(
    mediaId: string,
    incidentId: string,
  ): Promise<IncidentMedia | null> {
    return this.prismaService.incidentMedia.findFirst({
      where: { id: mediaId, incidentId },
    });
  }

  /**
   * Apaga uma imagem pelo identificador.
   * @param {string} mediaId identificador da imagem
   * @returns {Promise<void>} conclusão da remoção da linha
   */
  async deleteById(mediaId: string): Promise<void> {
    await this.prismaService.incidentMedia.delete({ where: { id: mediaId } });
  }

  /**
   * Procura imagens de vários incidentes na ordem de apresentação definida.
   * @param {string[]} ids identificadores dos incidentes
   * @returns {Promise<IncidentMedia[]>} imagens ordenadas por posição e data
   */
  async findByIncidentIds(ids: string[]): Promise<IncidentMedia[]> {
    if (ids.length === 0) return [];
    return this.prismaService.incidentMedia.findMany({
      where: { incidentId: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Apaga várias linhas de imagem e devolve a quantidade removida.
   * @param {string[]} ids identificadores das imagens
   * @returns {Promise<number>} número de linhas apagadas
   */
  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prismaService.incidentMedia.deleteMany({
      where: { id: { in: ids } },
    });
    return result.count;
  }

  /** Lista media cu incidentos fora da janela de restauro ou retenção.
   * Incidentes restaurados após a limpeza das linhas ficam sem as fotos removidas.
   * @param {number} limit máximo de linhas a devolver
   * @returns {Promise<RemovableMediaRecord[]>} identificadores e caminhos elegíveis
   */
  async findRemovableBatch(limit: number): Promise<RemovableMediaRecord[]> {
    return this.prismaService.$queryRaw<RemovableMediaRecord[]>`
      SELECT media.id, media.path
      FROM incident_media AS media
      INNER JOIN incidents AS incident ON incident.id = media."incidentId"
      WHERE (
        incident.status IN ('REMOVED', 'DELETED')
        AND incident."removedAt" <= now() - (${MEDIA_GRACE_AFTER_REMOVAL_HOURS} * interval '1 hour')
      ) OR (
        incident.status = 'EXPIRED'
        AND incident."expiresAt" <= now() - (${MEDIA_RETENTION_AFTER_EXPIRY_DAYS} * interval '1 day')
      )
      ORDER BY media."createdAt", media.id
      LIMIT ${limit}
    `;
  }

  /** Procura que caminhos ainda têm linhas associadas na base de dados.
   * @param {string[]} paths caminhos de objetos candidatos a órfãos
   * @returns {Promise<Set<string>>} caminhos que continuam referenciados
   */
  async findExistingPaths(paths: string[]): Promise<Set<string>> {
    if (paths.length === 0) return new Set<string>();
    const rows = await this.prismaService.incidentMedia.findMany({
      where: { path: { in: paths } },
      select: { path: true },
      distinct: ['path'],
    });
    return new Set(rows.map((row) => row.path));
  }
}
