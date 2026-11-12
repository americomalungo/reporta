import { Injectable } from '@nestjs/common';
import { ModerationLogRepository } from '@/src/infrastructure/repositories/moderation-log.repository';
import type { ModerationLogFilters } from '@/src/common/types/moderation.types';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { decodeCursor, encodeCursor } from '@/src/common/utils/cursor';
import { AdminModerationLogsQueryDto } from './dto/admin-moderation-logs-query.dto';
import { AdminModerationLogDto } from './dto/admin-moderation-log.dto';

/** Consulta a auditoria de moderação por cursor. */
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
        : decodeCursor(query.cursor, isLogCursor);
    const cursor =
      decoded === undefined
        ? undefined
        : { createdAt: new Date(decoded.createdAt), id: decoded.id };
    const take = query.limit ?? 20;
    const rows = await this.repository.list(filters, cursor, take + 1);
    const hasNextPage = rows.length > take;
    const pageRows = rows.slice(0, take);
    const data = pageRows.map((row) => {
      const metadata: Record<string, unknown> | null = {};
      if (
        row.metadata !== null &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
      ) {
        for (const [key, value] of Object.entries(row.metadata))
          metadata[key] = value;
      } else if (row.metadata === null)
        return {
          id: row.id,
          action: row.action,
          adminId: row.adminId,
          incidentId: row.incidentId,
          targetUserId: row.targetUserId,
          reason: row.reason,
          metadata: null,
          createdAt: row.createdAt,
        };
      return {
        id: row.id,
        action: row.action,
        adminId: row.adminId,
        incidentId: row.incidentId,
        targetUserId: row.targetUserId,
        reason: row.reason,
        metadata,
        createdAt: row.createdAt,
      };
    });
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
}

/** Valida o formato do cursor de auditoria.
 * @param {unknown} value valor descodificado
 * @returns {value is ModerationLogCursor} indica cursor válido
 */
function isLogCursor(
  value: unknown,
): value is { createdAt: string; id: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('createdAt' in value) ||
    !('id' in value)
  )
    return false;
  return (
    typeof value.createdAt === 'string' &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.id === 'string'
  );
}
