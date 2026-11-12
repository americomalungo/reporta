import type { ModerationAction as ModerationActionType } from '@/src/common/enums/moderation.enums';

/** Tipo de ação registada na auditoria de moderação. */
export type ModerationAction = ModerationActionType;
/** Sanção aplicada após uma remoção automática por votos. */
export type AutoRemovalPenalty = 'NONE' | 'POSTING_RESTRICTED' | 'BANNED';
/** Resultado da remoção automática e da respetiva sanção ao autor. */
export interface AutoRemovalResult {
  /** Identificador do incidente removido. */ incidentId: string;
  /** Identificador do autor. */ authorId: string;
  /** Total de remoções do autor. */ removedPostsCount: number;
  /** Sanção aplicada. */ penalty: AutoRemovalPenalty;
}
/** Filtros de domínio para pesquisar registos de moderação. */
export interface ModerationLogFilters {
  /** Ação a filtrar. */ action?: ModerationAction;
  /** Utilizador alvo. */ targetUserId?: string;
  /** Incidente associado. */ incidentId?: string;
  /** Administrador responsável. */ adminId?: string;
}
/** Cursor cronológico dos registos de moderação. */
export interface ModerationLogCursor {
  /** Data do último registo. */ createdAt: Date;
  /** Identificador do último registo. */ id: string;
}
/** Linha de incidente apresentada na fila administrativa. */
export interface AdminIncidentRecord {
  /** Identificador do incidente. */ id: string;
  /** Título. */ title: string;
  /** Identidade resumida do autor. */ author: { id: string; name: string };
  /** Categoria. */ category: { id: string; name: string };
  /** Estado do incidente. */ status: string;
  /** Total de confirmações. */ confirmCount: number;
  /** Total de desconfirmações. */ disconfirmCount: number;
  /** Data de remoção. */ removedAt: Date | null;
  /** Administrador que removeu. */ removedBy: string | null;
  /** Motivo de remoção. */ removedReason: string | null;
  /** Criação. */ createdAt: Date;
}
/** Resultado de uma ação administrativa sobre um incidente. */
export interface AdminIncidentActionResult {
  /** Incidente alterado. */ incidentId: string;
  /** Autor a notificar. */ authorId: string;
  /** Estado após restauro. */ status?: string;
}
/** Dados de motivo e duração para suspender uma conta. */
export interface SuspendUserInput {
  /** Motivo. */ reason: string;
  /** Duração em dias. */ days: number;
}
/** Dados de motivo e duração para restringir publicações. */
export interface RestrictPostingInput {
  /** Motivo. */ reason: string;
  /** Duração em dias. */ days: number;
}

/** Representação administrativa dos dados de uma conta. */
export interface AdminUserRecord {
  /** Identificador. */ id: string;
  /** Nome. */ name: string;
  /** Email. */ email: string;
  /** Papel. */ role: string;
  /** Estado. */ status: string;
  /** Motivo do estado. */ statusReason: string | null;
  /** Fim da suspensão. */ suspendedUntil: Date | null;
  /** Fim do bloqueio de publicação. */ postingBlockedUntil: Date | null;
  /** Incidentes removidos. */ removedPostsCount: number;
}
