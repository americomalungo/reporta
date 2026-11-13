import { JobName, QueueName } from '@/src/common/enums/queue.enums';

/** Maps each job to its owning queue. */
export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JobName.DISPATCH_RISK_ALERT]: QueueName.ALERTS,
  [JobName.SEND_ALERT_PUSHES]: QueueName.ALERTS,
  [JobName.SEND_NOTIFICATION_PUSH]: QueueName.ALERTS,
  [JobName.RETRY_RISK_ALERT_PUSHES]: QueueName.ALERTS,
  [JobName.RETRY_AUTO_MODERATION]: QueueName.MODERATION,
  [JobName.EVALUATE_INCIDENT_MODERATION]: QueueName.MODERATION,
  [JobName.EXPIRE_INCIDENTS]: QueueName.MAINTENANCE,
  [JobName.LIFT_SUSPENSIONS]: QueueName.MAINTENANCE,
  [JobName.CLEANUP_MEDIA]: QueueName.MAINTENANCE,
  [JobName.SCAN_ORPHANS]: QueueName.MAINTENANCE,
  [JobName.HOUSEKEEPING]: QueueName.MAINTENANCE,
};

/** Default maximum number of job attempts. */
export const JOB_DEFAULT_ATTEMPTS = 5;
/** Default exponential retry delay in milliseconds. */
export const JOB_DEFAULT_BACKOFF_MS = 5000;
/** Default successful job retention policy. */
export const JOB_REMOVE_ON_COMPLETE = { age: 3600, count: 1000 } as const;
/** Default failed job retention policy. */
export const JOB_REMOVE_ON_FAIL = { age: 7 * 24 * 3600 } as const;
/** Worker concurrency for each queue. */
export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  [QueueName.ALERTS]: 2,
  [QueueName.MODERATION]: 1,
  [QueueName.MAINTENANCE]: 1,
};
/** Connection timeout above the observed 10.7-second remote TLS handshake. */
export const REDIS_CONNECT_TIMEOUT_MS = 15_000;
/** Command timeout for the shared cache and rate-limit Redis client. */
export const REDIS_CACHE_COMMAND_TIMEOUT_MS = 2000;
/** Command timeout for Redis connections used by BullMQ producers. */
export const REDIS_QUEUE_COMMAND_TIMEOUT_MS = 5000;
/** Upper bound for Redis connection retry delay in milliseconds. */
export const REDIS_MAX_RETRY_DELAY_MS = 2000;
/** Initial delay before retrying failed BullMQ schedule synchronization. */
export const JOB_SCHEDULE_RETRY_INITIAL_DELAY_MS = 30_000;
/** Maximum delay between failed BullMQ schedule synchronization attempts. */
export const JOB_SCHEDULE_RETRY_MAX_DELAY_MS = 10 * 60_000;
/** Multiplier applied to each failed schedule synchronization retry delay. */
export const JOB_SCHEDULE_RETRY_MULTIPLIER = 2;
