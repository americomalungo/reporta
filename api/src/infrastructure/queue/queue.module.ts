import { Global, Module } from '@nestjs/common';
import { BullMqJobQueue } from './bullmq-job-queue';
import { JobQueue } from './job-queue';
import { JobSchedulerBootstrap } from './job-scheduler-bootstrap';

/** Exposes the provider-independent job queue across feature modules. */
@Global()
@Module({
  providers: [
    { provide: JobQueue, useClass: BullMqJobQueue },
    JobSchedulerBootstrap,
  ],
  exports: [JobQueue],
})
export class QueueModule {}
