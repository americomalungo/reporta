import { JobName } from '@/src/common/enums/queue.enums';
import type { JobSchedule } from '@/src/common/types/jobs.types';

/** Stable repeat schedules for all recurring jobs, in Africa/Luanda time. */
export const JOB_SCHEDULES: JobSchedule[] = [
  { job: JobName.RETRY_RISK_ALERT_PUSHES, cron: '*/5 * * * *' },
  { job: JobName.RETRY_AUTO_MODERATION, cron: '*/5 * * * *' },
  { job: JobName.EXPIRE_INCIDENTS, cron: '*/5 * * * *' },
  { job: JobName.LIFT_SUSPENSIONS, cron: '*/5 * * * *' },
  { job: JobName.CLEANUP_MEDIA, cron: '0 * * * *' },
  { job: JobName.SCAN_ORPHANS, cron: '30 3 * * *' },
  { job: JobName.HOUSEKEEPING, cron: '0 4 * * *' },
];
