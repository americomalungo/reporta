import { Injectable } from '@nestjs/common';
import type { ModerationLog } from '@/src/common/types/entities.types';
import type {
  ModerationLogCursor,
  ModerationLogFilters,
} from '@/src/common/types/moderation.types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pesquisa os registos de auditoria de moderação.
 */
@Injectable()
export class ModerationLogRepository {
  /**
   * Cria o repository de auditoria.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Lista registos de moderação com filtros e cursor cronológico.
   * @param {ModerationLogFilters} filters filtros opcionais da auditoria
   * @param {ModerationLogCursor | undefined} cursor posição exclusiva da próxima página
   * @param {number} take quantidade máxima de linhas a devolver
   * @returns {Promise<ModerationLog[]>} registos ordenados por data e id decrescentes
   */
  list(
    filters: ModerationLogFilters,
    cursor: ModerationLogCursor | undefined,
    take: number,
  ): Promise<ModerationLog[]> {
    const conditions = {
      ...(filters.action !== undefined && { action: filters.action }),
      ...(filters.targetUserId !== undefined && {
        targetUserId: filters.targetUserId,
      }),
      ...(filters.incidentId !== undefined && {
        incidentId: filters.incidentId,
      }),
      ...(filters.adminId !== undefined && { adminId: filters.adminId }),
      ...(cursor !== undefined && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    };

    return this.prismaService.moderationLog.findMany({
      where: conditions,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
  }
}
