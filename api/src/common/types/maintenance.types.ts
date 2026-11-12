/** Linha de media elegível para limpeza, sem URL interna. */
export interface RemovableMediaRecord {
  /** Identificador da linha de media. */
  id: string;
  /** Chave do objeto no armazenamento. */
  path: string;
}

/** Contagens removidas na limpeza de dados auxiliares. */
export interface HousekeepingResult {
  /** Tokens push apagados. */
  pushTokens: number;
  /** Notificações apagadas. */
  notifications: number;
  /** Entregas de alertas apagadas. */
  alertDeliveries: number;
  /** Localizações anuladas. */
  locations: number;
}

/** Resultado da execução de um job manual. */
export interface MaintenanceRunResult {
  /** Nome estável do job. */
  job: string;
  /** Total de linhas ou objetos afetados. */
  affected: number;
  /** Duração da execução em milissegundos. */
  durationMs: number;
}
