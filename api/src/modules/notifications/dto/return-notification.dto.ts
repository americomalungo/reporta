import type { NotificationType } from '@/src/common/types/incidents.types';

/**
 * Notificação in-app devolvida ao utilizador proprietário.
 */
export class ReturnNotificationDto {
  /**
   * Identificador da notificação.
   */
  id: string;

  /**
   * Categoria da notificação.
   */
  type: NotificationType;

  /**
   * Título apresentado na notificação.
   */
  title: string;

  /**
   * Texto apresentado na notificação.
   */
  body: string;

  /**
   * Identificador do incidente associado, se existir.
   */
  incidentId: string | null;

  /**
   * Dados adicionais da notificação, quando são um objeto JSON.
   */
  data: Record<string, unknown> | null;

  /**
   * Indica se a notificação já foi lida.
   */
  isRead: boolean;

  /**
   * Data em que a notificação foi lida, se aplicável.
   */
  readAt: Date | null;

  /**
   * Data de criação da notificação.
   */
  createdAt: Date;
}
