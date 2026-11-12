/** Identificadores dos cinco jobs de manutenção disponíveis. */
export enum MaintenanceJob {
  EXPIRE_INCIDENTS = 'expire-incidents',
  LIFT_SUSPENSIONS = 'lift-suspensions',
  CLEANUP_MEDIA = 'cleanup-media',
  SCAN_ORPHANS = 'scan-orphans',
  HOUSEKEEPING = 'housekeeping',
}
