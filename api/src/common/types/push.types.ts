/**
 * Conteúdo enviado como notificação push pelo Firebase Cloud Messaging.
 */
export interface PushPayload {
  /**
   * Título apresentado na notificação.
   */
  title: string;

  /**
   * Texto apresentado na notificação.
   */
  body: string;

  /**
   * Metadados adicionais da notificação, todos serializados como strings.
   */
  data: Record<string, string>;
}

/**
 * Resumo dos resultados obtidos ao enviar uma notificação push.
 */
export interface PushSendResult {
  /**
   * Quantidade de tokens que receberam o envio com sucesso.
   */
  successCount: number;

  /**
   * Tokens que o Firebase identificou como inválidos ou já não registados.
   */
  invalidTokens: string[];
}
