import { Injectable } from '@nestjs/common';
import { ModerationLogRepository } from '@/src/infrastructure/repositories/moderation-log.repository';
import type { ModerationLogFilters } from '@/src/common/types/moderation.types';
import type { CursorPage } from '@/src/common/types/pagination.types';
import {
  decodeCursor,
  encodeCursor,
  isCreatedAtIdCursor,
} from '@/src/common/utils/cursor';
import { AdminModerationLogsQueryDto } from './dto/admin-moderation-logs-query.dto';
import { AdminModerationLogDto } from './dto/admin-moderation-log.dto';

/**
 * Consulta a auditoria de moderação por cursor.
 */
@Injectable()
export class AdminModerationLogsService {
  /** Cria o serviço de consulta da auditoria.
   * @param {ModerationLogRepository} repository consulta paginada de logs
   */
  constructor(private readonly repository: ModerationLogRepository) {}

  /** Lista os registos de auditoria com filtros opcionais.
   * @param {AdminModerationLogsQueryDto} query filtros e cursor
   * @returns {Promise<CursorPage<AdminModerationLogDto>>} página de auditoria
   */
  async list(
    query: AdminModerationLogsQueryDto,
  ): Promise<CursorPage<AdminModerationLogDto>> {
    const filters: ModerationLogFilters = {
      ...(query.action === undefined ? {} : { action: query.action }),
      ...(query.targetUserId === undefined
        ? {}
        : { targetUserId: query.targetUserId }),
      ...(query.incidentId === undefined
        ? {}
        : { incidentId: query.incidentId }),
      ...(query.adminId === undefined ? {} : { adminId: query.adminId }),
    };
    const decoded =
      query.cursor === undefined
        ? undefined
        : decodeCursor(query.cursor, isCreatedAtIdCursor);
    const cursor =
      decoded === undefined
        ? undefined
        : { createdAt: new Date(decoded.createdAt), id: decoded.id };
    const take = query.limit ?? 20;
    const rows = await this.repository.list(filters, cursor, take + 1);
    const hasNextPage = rows.length > take;
    const pageRows = rows.slice(0, take);
    const data = pageRows.map((row): AdminModerationLogDto => ({
      id: row.id,
      action: row.action,
      adminId: row.adminId,
      incidentId: row.incidentId,
      targetUserId: row.targetUserId,
      reason: row.reason,
      metadata: this.toMetadataRecord(row.metadata),
      createdAt: row.createdAt,
    }));
    const last = pageRows.at(-1);
    return {
      data,
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  /** Converte metadados JSON em objeto de registo para a resposta da API.
   * @param {unknown} value valor JSON persistido
   * @returns {Record<string, unknown> | null} metadados ou null quando não são objeto
   */
  private toMetadataRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return null;
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) record[key] = item;
    return record;
  }
}
