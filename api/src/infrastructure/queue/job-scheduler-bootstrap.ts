import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { JOB_SCHEDULES } from '@/src/common/constants/job-schedules.constants';
import {
  JOB_SCHEDULE_RETRY_INITIAL_DELAY_MS,
  JOB_SCHEDULE_RETRY_MAX_DELAY_MS,
  JOB_SCHEDULE_RETRY_MULTIPLIER,
} from '@/src/common/constants/queues.constants';
import { EnvService } from '@/src/infrastructure/env/env.service';
import { JobQueue } from './job-queue';

/** Synchronizes recurring BullMQ schedules after queue initialization. */
@Injectable()
export class JobSchedulerBootstrap
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JobSchedulerBootstrap.name);
  /** Timer used to retry schedule synchronization without blocking startup. */
  private retryTimer: NodeJS.Timeout | undefined;
  /** Number of consecutive failed synchronization attempts. */
  private retryAttempt = 0;
  /** Prevents pending retries from running during application shutdown. */
  private shuttingDown = false;

  /** Creates the scheduler initializer.
   * @param {JobQueue} jobQueue provider-independent queue interface
   * @param {EnvService} env scheduler activation configuration
   */
  constructor(
    private readonly jobQueue: JobQueue,
    private readonly env: EnvService,
  ) {}

  /** Updates recurring jobs only when background processing is enabled.
   * @returns {void} starts schedule initialization without blocking startup
   */
  onApplicationBootstrap(): void {
    if (!this.env.jobsEnabled) return;
    void this.synchronizeSchedules();
  }

  /** Stops pending scheduler retries during application shutdown.
   * @returns {void} completion of timer cleanup
   */
  onApplicationShutdown(): void {
    this.shuttingDown = true;
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  /** Attempts scheduler synchronization and schedules a retry on failure.
   * @returns {Promise<void>} completion of the synchronization attempt
   */
  private async synchronizeSchedules(): Promise<void> {
    if (this.shuttingDown) return;
    try {
      await this.jobQueue.syncSchedules(JOB_SCHEDULES);
      this.retryAttempt = 0;
      this.logger.log('BullMQ job schedules synchronized');
    } catch {
      this.scheduleRetry();
    }
  }

  /** Schedules the next retry using capped exponential backoff.
   * @returns {void} completion of retry timer registration
   */
  private scheduleRetry(): void {
    if (this.shuttingDown || this.retryTimer !== undefined) return;
    const delayMs = Math.min(
      JOB_SCHEDULE_RETRY_INITIAL_DELAY_MS *
        JOB_SCHEDULE_RETRY_MULTIPLIER ** this.retryAttempt,
      JOB_SCHEDULE_RETRY_MAX_DELAY_MS,
    );
    this.retryAttempt += 1;
    this.logger.warn(
      `Scheduler synchronization failed; retrying in ${delayMs} ms`,
    );
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.synchronizeSchedules();
    }, delayMs);
  }
}
