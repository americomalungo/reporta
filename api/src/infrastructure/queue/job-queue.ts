import type { JobName } from '@/src/common/enums/queue.enums';
import type {
  EnqueueOptions,
  EnqueueResult,
  JobHandler,
  JobPayloadMap,
  JobSchedule,
} from '@/src/common/types/jobs.types';

/** Provider-independent API for submitting and processing background jobs. */
export abstract class JobQueue {
  /** Adds a typed payload to its configured queue.
   * @param {K} name job type
   * @param {JobPayloadMap[K]} payload data validated by the selected job type
   * @param {EnqueueOptions} options optional retry, delay, identity, and deduplication settings
   * @returns {Promise<EnqueueResult>} job identifier and deduplication state
   * @throws {Error} when the queue backend is unavailable or rejects the job
   */
  abstract enqueue<K extends JobName>(
    name: K,
    payload: JobPayloadMap[K],
    options?: EnqueueOptions,
  ): Promise<EnqueueResult>;

  /** Registers one handler before workers are initialized.
   * @param {K} name job type to handle
   * @param {JobHandler<K>} handler typed job processor
   * @returns {void} registration completion
   * @throws {Error} if a handler for the same job is already registered
   */
  abstract registerHandler<K extends JobName>(
    name: K,
    handler: JobHandler<K>,
  ): void;

  /** Synchronizes repeat schedules and removes stale schedules.
   * @param {JobSchedule[]} schedules desired recurring jobs
   * @returns {Promise<void>} completion of schedule synchronization
   * @throws {Error} when the queue backend is unavailable
   */
  abstract syncSchedules(schedules: JobSchedule[]): Promise<void>;
}
