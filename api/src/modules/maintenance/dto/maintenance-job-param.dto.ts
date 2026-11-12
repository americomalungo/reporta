import { IsEnum } from 'class-validator';
import { MaintenanceJob } from '@/src/common/enums/maintenance.enums';

/** Parâmetro validado que identifica um job manual de manutenção. */
export class MaintenanceJobParamDto {
  /** Nome estável do job. */
  @IsEnum(MaintenanceJob)
  job: MaintenanceJob;
}
