import type { AdminUserRecord } from '@/src/common/types/moderation.types';
/** Dados de conta devolvidos após uma ação administrativa. */
export class AdminUserDto implements AdminUserRecord {
  /** Identificador. */ id: string;
  /** Nome. */ name: string;
  /** Email. */ email: string;
  /** Papel. */ role: string;
  /** Estado. */ status: string;
  /** Motivo do estado. */ statusReason: string | null;
  /** Fim da suspensão. */ suspendedUntil: Date | null;
  /** Fim do bloqueio de publicação. */ postingBlockedUntil: Date | null;
  /** Contagem de incidentes removidos. */ removedPostsCount: number;
}
