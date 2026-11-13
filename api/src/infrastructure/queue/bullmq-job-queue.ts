import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
  JOB_DEFAULT_ATTEMPTS,
  JOB_DEFAULT_BACKOFF_MS,
  JOB_QUEUE,
  JOB_REMOVE_ON_COMPLETE,
  JOB_REMOVE_ON_FAIL,
  QUEUE_CONCURRENCY,
  REDIS_COMMAND_TIMEOUT_MS,
  REDIS_MAX_RETRY_DELAY_MS,
} from '@/src/common/constants/queues.constants';
import { JobName, QueueName } from '@/src/common/enums/queue.enums';
import type {
  EnqueueOptions,
  EnqueueResult,
  JobContext,
  JobHandler,
  JobPayloadMap,
  JobSchedule,
} from '@/src/common/types/jobs.types';
import { JOB_PAYLOAD_GUARDS } from '@/src/common/utils/job-payload.guards';
import { EnvService } from '@/src/infrastructure/env/env.service';
import { JobQueue } from './job-queue';

type StoredHandler = (payload: unknown, context: JobContext) => Promise<void>;

/** BullMQ-backed implementation of the provider-independent job interface. */
@Injectable()
export class BullMqJobQueue
  extends JobQueue
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BullMqJobQueue.name);
  private readonly redis: Redis;
  private readonly queues = new Map<QueueName, Queue<unknown, void, string>>();
  private readonly workers: Worker<unknown, void, string>[] = [];
  private readonly queueConnections: Redis[] = [];
  private readonly workerConnections: Redis[] = [];
  private readonly handlers = new Map<JobName, StoredHandler>();
  private initialized = false;

  /** Creates the BullMQ adapter and its dedicated Redis connection.
   * @param {EnvService} env runtime connection and worker configuration
   */
  constructor(private readonly env: EnvService) {
    super();
    this.redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      connectTimeout: REDIS_COMMAND_TIMEOUT_MS,
      retryStrategy: (attempt: number): number =>
        Math.min(attempt * 100, REDIS_MAX_RETRY_DELAY_MS),
    });
    this.redis.on('error', () =>
      this.logger.error('BullMQ Redis connection error'),
    );
  }

  /** Creates queues and enabled workers after feature modules register handlers.
   * @returns {Promise<void>} completion of local queue and worker initialization
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.initialized) return;
    for (const queueName of Object.values(QueueName)) {
      const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
      this.queueConnections.push(connection);
      const queue = new Queue<unknown, void, string>(queueName, {
        connection,
        prefix: this.env.redisKeyPrefix,
        defaultJobOptions: {
          attempts: JOB_DEFAULT_ATTEMPTS,
          backoff: { type: 'exponential', delay: JOB_DEFAULT_BACKOFF_MS },
          removeOnComplete: JOB_REMOVE_ON_COMPLETE,
          removeOnFail: JOB_REMOVE_ON_FAIL,
        },
      });
      queue.on('error', (error: Error) => {
        this.logger.error(
          `Queue ${queueName} error: ${this.safeErrorMessage(error)}`,
        );
      });
      this.queues.set(queueName, queue);
    }

    this.initialized = true;
    if (!this.env.jobsEnabled) return;
    for (const queueName of Object.values(QueueName)) {
      const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
      this.workerConnections.push(connection);
      const worker = new Worker<unknown, void, string>(
        queueName,
        async (job: Job<unknown, void, string>): Promise<void> =>
          this.processJob(job),
        {
          connection,
          prefix: this.env.redisKeyPrefix,
          concurrency: QUEUE_CONCURRENCY[queueName],
        },
      );
      worker.on('error', (error: Error) => {
        this.logger.error(
          `Worker ${queueName} error: ${this.safeErrorMessage(error)}`,
        );
      });
      worker.on(
        'failed',
        (job: Job<unknown, void, string> | undefined, error: Error) => {
          const name = job?.name ?? 'unknown';
          const id = job?.id ?? 'unknown';
          const attempt = job?.attemptsMade ?? 0;
          this.logger.error(
            `Job ${name} (${id}) failed on attempt ${attempt}: ${this.safeErrorMessage(error)}`,
          );
        },
      );
      this.workers.push(worker);
    }
  }

  /** Adds a typed job, applying retry policy and simple-mode deduplication.
   * @param {K} name job type
   * @param {JobPayloadMap[K]} payload job data
   * @param {EnqueueOptions} options optional submission settings
   * @returns {Promise<EnqueueResult>} job identifier and deduplication state
   * @throws {Error} when the queue backend is unavailable or rejects the job
   */
  async enqueue<K extends JobName>(
    name: K,
    payload: JobPayloadMap[K],
    options: EnqueueOptions = {},
  ): Promise<EnqueueResult> {
    if (options.jobId?.includes(':')) {
      throw new Error('BullMQ jobId cannot contain a colon');
    }
    const submittedJobId =
      options.jobId ??
      (options.deduplicationId === undefined ? undefined : randomUUID());
    const queue = this.queues.get(JOB_QUEUE[name]);
    if (!queue) throw new Error('Job queue is not initialized');
    try {
      if (options.jobId !== undefined) {
        const existingJob = await queue.getJob(options.jobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'failed' || state === 'completed') {
            await existingJob.remove();
          } else {
            return { jobId: options.jobId, deduplicated: true };
          }
        }
      }
      if (options.deduplicationId) {
        const existingId = await queue.getDeduplicationJobId(
          options.deduplicationId,
        );
        if (existingId !== null) {
          return { jobId: existingId, deduplicated: true };
        }
      }
      const job = await queue.add(name, payload, {
        ...(submittedJobId !== undefined && { jobId: submittedJobId }),
        ...(options.delayMs !== undefined && { delay: options.delayMs }),
        ...(options.attempts !== undefined && { attempts: options.attempts }),
        ...(options.backoffMs !== undefined && {
          backoff: { type: 'exponential', delay: options.backoffMs },
        }),
        ...(options.deduplicationId !== undefined && {
          deduplication: { id: options.deduplicationId },
        }),
      });
      if (!job.id) throw new Error('BullMQ did not return a job identifier');
      return {
        jobId: job.id,
        deduplicated:
          options.deduplicationId !== undefined &&
          submittedJobId !== undefined &&
          job.id !== submittedJobId,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to enqueue ${name}`,
        error instanceof Error
          ? this.safeErrorMessage(error)
          : 'Unknown queue error',
      );
      throw new Error(`Unable to enqueue ${name}`);
    }
  }

  /** Registers a type-safe handler and validates payloads at dispatch time.
   * @param {K} name job type to handle
   * @param {JobHandler<K>} handler job processor
   * @returns {void} registration completion
   * @throws {Error} if this job already has a registered handler
   */
  registerHandler<K extends JobName>(name: K, handler: JobHandler<K>): void {
    if (this.handlers.has(name))
      throw new Error(`Handler already registered for ${name}`);
    this.handlers.set(name, async (payload: unknown, context: JobContext) => {
      const guard = JOB_PAYLOAD_GUARDS[name];
      if (!guard(payload)) throw new Error(`Invalid payload for ${name}`);
      await handler(payload, context);
    });
  }

  /** Idempotently upserts desired schedules and removes obsolete schedulers.
   * @param {JobSchedule[]} schedules current desired repeat schedules
   * @returns {Promise<void>} completed synchronization
   * @throws {Error} when Redis cannot update scheduler state
   */
  async syncSchedules(schedules: JobSchedule[]): Promise<void> {
    if (!this.initialized) await this.onApplicationBootstrap();
    const maintenanceQueue = this.queues.get(QueueName.MAINTENANCE);
    const alertsQueue = this.queues.get(QueueName.ALERTS);
    const moderationQueue = this.queues.get(QueueName.MODERATION);
    if (!maintenanceQueue || !alertsQueue || !moderationQueue) {
      throw new Error('Job queues are not initialized');
    }
    const queues: Array<[QueueName, Queue<unknown, void, string>]> = [
      [QueueName.MAINTENANCE, maintenanceQueue],
      [QueueName.ALERTS, alertsQueue],
      [QueueName.MODERATION, moderationQueue],
    ];
    for (const schedule of schedules) {
      const queue = this.queues.get(JOB_QUEUE[schedule.job]);
      if (!queue) throw new Error(`Queue missing for ${schedule.job}`);
      await queue.upsertJobScheduler(
        schedule.job,
        { pattern: schedule.cron, tz: 'Africa/Luanda' },
        {
          name: schedule.job,
          data: {},
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: JOB_DEFAULT_BACKOFF_MS },
          },
        },
      );
    }
    for (const [queueName, queue] of queues) {
      const schedulers = await queue.getJobSchedulers(0, -1, true);
      for (const scheduler of schedulers) {
        const isDesired = schedules.some(
          (schedule) =>
            schedule.job === scheduler.name &&
            JOB_QUEUE[schedule.job] === queueName,
        );
        if (!isDesired) {
          await queue.removeJobScheduler(scheduler.key);
        }
      }
    }
  }

  /** Closes workers, queues, and their dedicated Redis connections in order.
   * @returns {Promise<void>} completion of best-effort shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    for (const worker of this.workers) {
      try {
        await worker.close();
      } catch (error: unknown) {
        this.logger.error(
          'Failed to close BullMQ worker',
          error instanceof Error
            ? this.safeErrorMessage(error)
            : 'Unknown error',
        );
      }
    }
    for (const queue of this.queues.values()) {
      try {
        await queue.close();
      } catch (error: unknown) {
        this.logger.error(
          'Failed to close BullMQ queue',
          error instanceof Error
            ? this.safeErrorMessage(error)
            : 'Unknown error',
        );
      }
    }
    for (const connection of [
      ...this.workerConnections,
      ...this.queueConnections,
      this.redis,
    ]) {
      connection.disconnect();
    }
  }

  /** Validates and dispatches a job to its registered handler.
   * @param {Job<unknown, void, string>} job BullMQ job envelope
   * @returns {Promise<void>} completion of the registered handler
   * @throws {Error} if the name, payload, identifier, or handler is invalid
   */
  private async processJob(job: Job<unknown, void, string>): Promise<void> {
    const jobName = Object.values(JobName).find((name) => name === job.name);
    if (!jobName) {
      throw new Error(`Unknown job name ${job.name}`);
    }
    if (!job.id) throw new Error(`Job ${job.name} has no identifier`);
    const handler = this.handlers.get(jobName);
    if (!handler) throw new Error(`No handler registered for ${jobName}`);
    const context: JobContext = {
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts:
        typeof job.opts.attempts === 'number'
          ? job.opts.attempts
          : JOB_DEFAULT_ATTEMPTS,
    };
    await handler(job.data, context);
  }

  /** Removes Redis URLs from text before logging errors.
   * @param {Error} error queue or connection error
   * @returns {string} sanitized error message
   */
  private safeErrorMessage(error: Error): string {
    return error.message.replace(/rediss?:\/\/[^\s]+/g, '[redis-url]');
  }
}
