/** Número mínimo de desconfirmações para remoção automática. */
export const AUTO_REMOVE_MIN_DISCONFIRMS = 5;
/** Rácio mínimo entre desconfirmações e confirmações para remoção automática. */
export const AUTO_REMOVE_DISCONFIRM_RATIO = 2;
/** Número de incidentes removidos que ativa uma restrição de publicação. */
export const POSTING_BLOCK_AT_REMOVED = 2;
/** Duração da restrição automática de publicação, em dias. */
export const POSTING_BLOCK_DAYS = 30;
/** Número de incidentes removidos que ativa um banimento automático. */
export const BAN_AT_REMOVED = 3;
/** Motivo persistido numa remoção automática por votos comunitários. */
export const AUTO_REMOVE_REASON =
  'Removido automaticamente por desconfirmações da comunidade';
/** Motivo persistido num banimento automático por incidentes removidos. */
export const AUTO_BAN_REASON = `Banido automaticamente: ${BAN_AT_REMOVED} incidentes removidos`;
