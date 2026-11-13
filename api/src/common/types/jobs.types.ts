import type { JobName } from '@/src/common/enums/queue.enums';

/** Payload data accepted for every supported background job. */
export interface JobPayloadMap {
  /** Incident identifier for risk alert dispatch. */
  'dispatch-risk-alert': { incidentId: string };
  /** Incident identifier for pending risk alert pushes. */
  'send-alert-pushes': { incidentId: string };
  /** Notification identifier whose push should be sent. */
  'send-notification-push': { notificationId: string };
  /** Empty payload for risk alert recovery. */
  'retry-risk-alert-pushes': Record<string, never>;
  /** Empty payload for automatic moderation recovery. */
  'retry-auto-moderation': Record<string, never>;
  /** Incident identifier for immediate vote-triggered moderation. */
  'evaluate-incident-moderation': { incidentId: string };
  /** Empty payload for incident expiry. */
  'expire-incidents': Record<string, never>;
  /** Empty payload for suspension lifting. */
  'lift-suspensions': Record<string, never>;
  /** Empty payload for expired media cleanup. */
  'cleanup-media': Record<string, never>;
  /** Empty payload for orphan media scanning. */
  'scan-orphans': Record<string, never>;
  /** Empty payload for auxiliary data cleanup. */
  housekeeping: Record<string, never>;
}

/** Runtime metadata provided to a job handler. */
export interface JobContext {
  /** BullMQ identifier of the executing job. */
  jobId: string;
  /** Number of prior failed attempts. */
  attemptsMade: number;
  /** Maximum attempts configured for the job. */
  maxAttempts: number;
}

/** Function that processes the typed payload for a job. */
export type JobHandler<K extends JobName> = (
  payload: JobPayloadMap[K],
  context: JobContext,
) => Promise<void>;

/** Optional queue submission settings. */
export interface EnqueueOptions {
  /** Stable BullMQ job identifier. */
  jobId?: string;
  /** Delay before the job becomes available, in milliseconds. */
  delayMs?: number;
  /** Maximum number of attempts. */
  attempts?: number;
  /** Exponential retry delay in milliseconds. */
  backoffMs?: number;
  /** BullMQ simple-mode deduplication identifier. */
  deduplicationId?: string;
}

/** Result of adding a job to its queue. */
export interface EnqueueResult {
  /** Identifier of the new or existing job. */
  jobId: string;
  /** Indicates that BullMQ discarded this add due to deduplication. */
  deduplicated: boolean;
}

/** One recurring job schedule. */
export interface JobSchedule {
  /** Job to enqueue on each schedule occurrence. */
  job: JobName;
  /** Cron expression interpreted in Africa/Luanda. */
  cron: string;
}
