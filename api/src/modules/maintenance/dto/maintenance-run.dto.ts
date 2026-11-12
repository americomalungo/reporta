import type { MaintenanceRunResult } from '@/src/common/types/maintenance.types';

/** Resumo de um job de manutenção executado manualmente. */
export class MaintenanceRunDto implements MaintenanceRunResult {
  /** Nome estável do job. */
  job: string;
  /** Total de registos ou objetos afetados. */
  affected: number;
  /** Duração da execução, em milissegundos. */
  durationMs: number;
}
