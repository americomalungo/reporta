import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceJobParamDto } from './dto/maintenance-job-param.dto';
import { MaintenanceRunDto } from './dto/maintenance-run.dto';

/** Endpoint administrativo para executar jobs manualmente. */
@ApiTags('Admin')
@Controller('admin/maintenance')
@Roles(UserRole.ADMIN)
export class AdminMaintenanceController {
  /** Cria o controller de manutenção.
   * @param {MaintenanceService} maintenanceService executor dos jobs
   */
  constructor(private readonly maintenanceService: MaintenanceService) {}

  /** POST /admin/maintenance/:job/run — executa um job na instância atual.
   * @param {MaintenanceJobParamDto} params nome validado do job
   * @returns {Promise<MaintenanceRunDto>} contagem e duração da execução
   */
  @Post(':job/run')
  @HttpCode(HttpStatus.OK)
  run(@Param() params: MaintenanceJobParamDto): Promise<MaintenanceRunDto> {
    return this.maintenanceService.execute(params.job);
  }
}
