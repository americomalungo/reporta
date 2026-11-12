import { $Enums } from '@/generated/prisma';

/**
 * Tipo de notificação persistido pela aplicação.
 */
export type NotificationType = $Enums.NotificationType;

/**
 * Dados de domínio aceites pelo serviço de envio de notificações.
 */
export interface NotificationDispatchInput {
  /**
   * Tipo da notificação a criar.
   */
  type: NotificationType;
  /**
   * Título apresentado ao utilizador.
   */
  title: string;
  /**
   * Texto apresentado ao utilizador.
   */
  body: string;
  /**
   * Identificador opcional do incidente associado.
   */
  incidentId?: string;
  /**
   * Dados adicionais simples para a notificação e o push.
   */
  data?: Record<string, string | number | boolean>;
  /**
   * Indica se também deve ser enviado um push FCM.
   */
  push: boolean;
}
