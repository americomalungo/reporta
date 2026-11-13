import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JOB_SCHEDULES } from '@/src/common/constants/job-schedules.constants';
import { EnvService } from '@/src/infrastructure/env/env.service';
import { JobQueue } from './job-queue';

/** Synchronizes recurring BullMQ schedules after queue initialization. */
@Injectable()
export class JobSchedulerBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobSchedulerBootstrap.name);

  /** Creates the scheduler initializer.
   * @param {JobQueue} jobQueue provider-independent queue interface
   * @param {EnvService} env scheduler activation configuration
   */
  constructor(
    private readonly jobQueue: JobQueue,
    private readonly env: EnvService,
  ) {}

  /** Updates recurring jobs only when background processing is enabled.
   * @returns {Promise<void>} completion of schedule initialization
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.env.jobsEnabled) return;
    try {
      await this.jobQueue.syncSchedules(JOB_SCHEDULES);
    } catch {
      this.logger.error(
        'Could not synchronize job schedules; API startup will continue',
        'Scheduler synchronization failed',
      );
    }
  }
}
