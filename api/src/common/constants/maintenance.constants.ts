/** Tamanho máximo do lote de incidentes expirados. */
export const EXPIRE_INCIDENTS_BATCH_SIZE = 1000;
/** Tamanho máximo do lote de suspensões expiradas. */
export const LIFT_SUSPENSIONS_BATCH_SIZE = 200;
/** Tamanho máximo do lote de imagens removíveis. */
export const CLEANUP_MEDIA_BATCH_SIZE = 100;
/** Tamanho de cada página de objetos no armazenamento. */
export const ORPHAN_SCAN_PAGE_SIZE = 1000;
/** Limite de páginas de objetos numa execução de deteção de órfãos. */
export const ORPHAN_SCAN_MAX_PAGES = 50;
/** Idade mínima de objetos antes de os considerar órfãos, em horas. */
export const ORPHAN_MIN_AGE_HOURS = 24;
/** Período de tolerância após remoção de incidente, em horas. */
export const MEDIA_GRACE_AFTER_REMOVAL_HOURS = 24;
/** Retenção de media após expiração do incidente, em dias. */
export const MEDIA_RETENTION_AFTER_EXPIRY_DAYS = 30;
/** Tamanho máximo de cada lote de limpeza de dados auxiliares. */
export const HOUSEKEEPING_BATCH_SIZE = 5000;
/** Máximo de ciclos de lote por execução de qualquer job. */
export const MAINTENANCE_MAX_BATCH_ITERATIONS = 20;
/** Retenção de tokens push inativos, em dias. */
export const INACTIVE_PUSH_TOKEN_RETENTION_DAYS = 60;
/** Retenção de notificações, em dias. */
export const NOTIFICATION_RETENTION_DAYS = 90;
/** Retenção de entregas de alertas, em dias. */
export const ALERT_DELIVERY_RETENTION_DAYS = 30;
/** Retenção de localizações conhecidas, em dias. */
export const LOCATION_RETENTION_DAYS = 7;
