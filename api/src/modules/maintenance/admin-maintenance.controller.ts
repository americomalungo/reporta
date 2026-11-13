import {
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceJobParamDto } from './dto/maintenance-job-param.dto';
import type { MaintenanceQueuedResult } from '@/src/common/types/maintenance.types';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMIT_ADMIN } from '@/src/common/constants/rate-limit.constants';

/** Endpoint administrativo para executar jobs manualmente. */
@ApiTags('Admin')
@Controller('admin/maintenance')
@Roles(UserRole.ADMIN)
@Throttle({ default: RATE_LIMIT_ADMIN })
export class AdminMaintenanceController {
  /** Cria o controller de manutenção.
   * @param {MaintenanceService} maintenanceService executor dos jobs
   */
  constructor(private readonly maintenanceService: MaintenanceService) {}

  /** POST /admin/maintenance/:job/run — enqueues one maintenance job.
   * @param {MaintenanceJobParamDto} params nome validado do job
   * @returns {Promise<MaintenanceQueuedResult>} queued job identifier
   * @throws {ConflictException} if an equivalent maintenance job is queued or running
   */
  @Post(':job/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ description: 'Job de manutenção colocado em fila.' })
  @ApiConflictResponse({
    description: 'Já existe um job igual em fila ou execução.',
  })
  async run(
    @Param() params: MaintenanceJobParamDto,
  ): Promise<MaintenanceQueuedResult> {
    const result = await this.maintenanceService.enqueueManual(params.job);
    if (result.deduplicated) {
      throw new ConflictException({ jobId: result.jobId, deduplicated: true });
    }
    return { jobId: result.jobId, queued: true };
  }
}
