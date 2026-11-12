import type { AdminIncidentRecord } from '@/src/common/types/moderation.types';

/**
 * Incidente apresentado na fila administrativa.
 */
export class AdminIncidentDto implements AdminIncidentRecord {
  /**
   * Identificador do incidente.
   */
  id: string;
  /**
   * Título.
   */
  title: string;
  /**
   * Autor resumido.
   */
  author: { id: string; name: string };
  /**
   * Categoria associada.
   */
  category: { id: string; name: string };
  /**
   * Estado.
   */
  status: string;
  /**
   * Contagem de confirmações.
   */
  confirmCount: number;
  /**
   * Contagem de desconfirmações.
   */
  disconfirmCount: number;
  /**
   * Data da remoção.
   */
  removedAt: Date | null;
  /**
   * Administrador que removeu.
   */
  removedBy: string | null;
  /**
   * Motivo da remoção.
   */
  removedReason: string | null;
  /**
   * Data de criação.
   */
  createdAt: Date;
}
