import type { ModerationAction } from '@/src/common/types/moderation.types';
/** Registo apresentado na auditoria administrativa. */
export class AdminModerationLogDto {
  /** Identificador do registo. */ id: string;
  /** Ação auditada. */ action: ModerationAction;
  /** Administrador responsável ou null para sistema. */ adminId: string | null;
  /** Incidente associado. */ incidentId: string | null;
  /** Utilizador alvo. */ targetUserId: string | null;
  /** Motivo registado. */ reason: string | null;
  /** Metadados estruturados. */ metadata: Record<string, unknown> | null;
  /** Data de criação. */ createdAt: Date;
}
