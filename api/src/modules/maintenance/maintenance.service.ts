import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MaintenanceJob } from '@/src/common/enums/maintenance.enums';
import { JobName } from '@/src/common/enums/queue.enums';
import {
  CLEANUP_MEDIA_BATCH_SIZE,
  EXPIRE_INCIDENTS_BATCH_SIZE,
  HOUSEKEEPING_BATCH_SIZE,
  MAINTENANCE_MAX_BATCH_ITERATIONS,
  ORPHAN_MIN_AGE_HOURS,
  ORPHAN_SCAN_PAGE_SIZE,
  ORPHAN_SCAN_MAX_PAGES,
  ORPHAN_SCAN_CURSOR_CACHE_KEY,
  ORPHAN_SCAN_CURSOR_TTL_MS,
  LIFT_SUSPENSIONS_BATCH_SIZE,
} from '@/src/common/constants/maintenance.constants';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import { MaintenanceRepository } from '@/src/infrastructure/repositories/maintenance.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import { StorageService } from '@/src/infrastructure/storage/storage.service';
import { NotificationDispatcherService } from '@/src/modules/notifications/notification-dispatcher.service';
import { CacheService } from '@/src/infrastructure/cache/cache.service';
import { JobQueue } from '@/src/infrastructure/queue/job-queue';
import type { EnqueueResult } from '@/src/common/types/jobs.types';

/** Maps a validated manual maintenance name to its queue job.
 * @param {MaintenanceJob} job requested maintenance operation
 * @returns {JobName} matching queue job
 */
function getMaintenanceJobName(job: MaintenanceJob): JobName {
  switch (job) {
    case MaintenanceJob.EXPIRE_INCIDENTS:
      return JobName.EXPIRE_INCIDENTS;
    case MaintenanceJob.LIFT_SUSPENSIONS:
      return JobName.LIFT_SUSPENSIONS;
    case MaintenanceJob.CLEANUP_MEDIA:
      return JobName.CLEANUP_MEDIA;
    case MaintenanceJob.SCAN_ORPHANS:
      return JobName.SCAN_ORPHANS;
    case MaintenanceJob.HOUSEKEEPING:
      return JobName.HOUSEKEEPING;
  }
}

/** Executes idempotent maintenance jobs through BullMQ workers. */
@Injectable()
export class MaintenanceService implements OnModuleInit {
  /** Logger for completed maintenance handler summaries. */
  private readonly logger = new Logger(MaintenanceService.name);

  /** Creates the maintenance job handlers.
   * @param {MaintenanceRepository} maintenanceRepository expiry and retention operations
   * @param {UserRepository} userRepository expired suspension operations
   * @param {IncidentMediaRepository} mediaRepository media row operations
   * @param {StorageService} storageService private object storage
   * @param {NotificationDispatcherService} notificationDispatcher best-effort notifications
   * @param {CacheService} cacheService continuation cursor cache
   * @param {JobQueue} jobQueue queue abstraction for manual runs
   */
  constructor(
    private readonly maintenanceRepository: MaintenanceRepository,
    private readonly userRepository: UserRepository,
    private readonly mediaRepository: IncidentMediaRepository,
    private readonly storageService: StorageService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly cacheService: CacheService,
    private readonly jobQueue: JobQueue,
  ) {}

  /** Registers all maintenance job processors after module construction.
   * @returns {void} handler registration completion
   */
  onModuleInit(): void {
    this.jobQueue.registerHandler(JobName.EXPIRE_INCIDENTS, async () => {
      await this.runMaintenanceJob(MaintenanceJob.EXPIRE_INCIDENTS, () =>
        this.expireIncidents(),
      );
    });
    this.jobQueue.registerHandler(JobName.LIFT_SUSPENSIONS, async () => {
      await this.runMaintenanceJob(MaintenanceJob.LIFT_SUSPENSIONS, () =>
        this.liftSuspensions(),
      );
    });
    this.jobQueue.registerHandler(JobName.CLEANUP_MEDIA, async () => {
      await this.runMaintenanceJob(MaintenanceJob.CLEANUP_MEDIA, () =>
        this.cleanupMedia(),
      );
    });
    this.jobQueue.registerHandler(JobName.SCAN_ORPHANS, async () => {
      await this.runMaintenanceJob(MaintenanceJob.SCAN_ORPHANS, () =>
        this.scanOrphans(),
      );
    });
    this.jobQueue.registerHandler(JobName.HOUSEKEEPING, async () => {
      await this.runMaintenanceJob(MaintenanceJob.HOUSEKEEPING, () =>
        this.housekeeping(),
      );
    });
  }

  /** Enqueues a manually requested maintenance operation with simple deduplication.
   * @param {MaintenanceJob} job validated maintenance job name
   * @returns {Promise<EnqueueResult>} queued job identifier and deduplication state
   * @throws {Error} if the queue backend is unavailable
   */
  async enqueueManual(job: MaintenanceJob): Promise<EnqueueResult> {
    return this.jobQueue.enqueue(
      getMaintenanceJobName(job),
      {},
      {
        attempts: 3,
        backoffMs: 5000,
        deduplicationId: `manual-${job}`,
      },
    );
  }

  /** Runs one worker action and logs its affected count and duration.
   * @param {MaintenanceJob} job maintenance operation name
   * @param {() => Promise<number>} action operation that returns affected count
   * @returns {Promise<void>} completion of the maintenance action
   * @throws {Error} if the operation fails so BullMQ can retry it
   */
  private async runMaintenanceJob(
    job: MaintenanceJob,
    action: () => Promise<number>,
  ): Promise<void> {
    const startedAt = Date.now();
    const affected = await action();
    this.logger.log(
      `Job ${job}: affected=${affected}, durationMs=${Date.now() - startedAt}`,
    );
  }

  /** Expira lotes limitados de incidentes.
   * @returns {Promise<number>} total de incidentes atualizados
   */
  private async expireIncidents(): Promise<number> {
    let affected = 0;
    for (
      let iteration = 0;
      iteration < MAINTENANCE_MAX_BATCH_ITERATIONS;
      iteration += 1
    ) {
      const ids = await this.maintenanceRepository.expireIncidents(
        EXPIRE_INCIDENTS_BATCH_SIZE,
      );
      affected += ids.length;
      if (ids.length < EXPIRE_INCIDENTS_BATCH_SIZE) break;
    }
    return affected;
  }

  /** Reativa lotes de utilizadores e envia notificações depois das transações.
   * @returns {Promise<number>} total de contas reativadas
   */
  private async liftSuspensions(): Promise<number> {
    let affected = 0;
    for (
      let iteration = 0;
      iteration < MAINTENANCE_MAX_BATCH_ITERATIONS;
      iteration += 1
    ) {
      const ids = await this.userRepository.liftExpiredSuspensions(
        LIFT_SUSPENSIONS_BATCH_SIZE,
      );
      affected += ids.length;
      await Promise.all(
        ids.map((userId) =>
          this.notificationDispatcher.notify(userId, {
            type: NotificationType.ACCOUNT_REACTIVATED,
            title: 'Conta reativada',
            body: 'A suspensão da sua conta terminou e o acesso foi reativado.',
            push: true,
          }),
        ),
      );
      if (ids.length < LIFT_SUSPENSIONS_BATCH_SIZE) break;
    }
    return affected;
  }

  /** Apaga primeiro os objetos e, em seguida, as linhas vencidas de media.
   * Incidentes restaurados depois desta limpeza voltam sem as fotos removidas.
   * @returns {Promise<number>} total de linhas removidas
   */
  private async cleanupMedia(): Promise<number> {
    let affected = 0;
    for (
      let iteration = 0;
      iteration < MAINTENANCE_MAX_BATCH_ITERATIONS;
      iteration += 1
    ) {
      const rows = await this.mediaRepository.findRemovableBatch(
        CLEANUP_MEDIA_BATCH_SIZE,
      );
      if (rows.length === 0) break;
      await this.storageService.remove(rows.map((row) => row.path));
      affected += await this.mediaRepository.deleteMany(
        rows.map((row) => row.id),
      );
      if (rows.length < CLEANUP_MEDIA_BATCH_SIZE) break;
    }
    return affected;
  }

  /** Remove páginas limitadas de objetos antigos sem linha correspondente.
   * @returns {Promise<number>} total de objetos órfãos removidos
   */
  private async scanOrphans(): Promise<number> {
    const cutoff = Date.now() - ORPHAN_MIN_AGE_HOURS * 60 * 60 * 1000;
    let affected = 0;
    const continuationToken = await this.cacheService.get(
      ORPHAN_SCAN_CURSOR_CACHE_KEY,
      (value: unknown): value is string => typeof value === 'string',
    );
    let nextToken = continuationToken ?? undefined;
    for (let page = 0; page < ORPHAN_SCAN_MAX_PAGES; page += 1) {
      const result = await this.storageService.listObjects('incidents/', {
        continuationToken: nextToken,
        maxKeys: ORPHAN_SCAN_PAGE_SIZE,
      });
      const oldObjects = result.objects.filter(
        (object) => object.lastModified.getTime() <= cutoff,
      );
      const paths = oldObjects.map((object) => object.key);
      const existing = await this.mediaRepository.findExistingPaths(paths);
      const orphanKeys = paths.filter((path) => !existing.has(path));
      await this.storageService.remove(orphanKeys);
      affected += orphanKeys.length;
      nextToken = result.nextToken ?? undefined;
      if (!nextToken) {
        await this.cacheService.del(ORPHAN_SCAN_CURSOR_CACHE_KEY);
        break;
      }
      await this.cacheService.set(
        ORPHAN_SCAN_CURSOR_CACHE_KEY,
        nextToken,
        ORPHAN_SCAN_CURSOR_TTL_MS,
      );
    }
    return affected;
  }

  /** Executa a manutenção de cada tabela em lotes limitados e regista contagens por tipo.
   * @returns {Promise<number>} total de registos apagados ou localizações limpas
   */
  private async housekeeping(): Promise<number> {
    const counts = {
      pushTokens: 0,
      notifications: 0,
      alertDeliveries: 0,
      locations: 0,
    };
    const jobs = [
      async (): Promise<number> =>
        this.maintenanceRepository.deleteInactivePushTokens(),
      async (): Promise<number> =>
        this.maintenanceRepository.deleteOldNotifications(),
      async (): Promise<number> =>
        this.maintenanceRepository.deleteOldAlertDeliveries(),
      async (): Promise<number> =>
        this.maintenanceRepository.clearOldLocations(),
    ];
    const totals: number[] = [];
    for (const job of jobs) {
      let count = 0;
      for (
        let iteration = 0;
        iteration < MAINTENANCE_MAX_BATCH_ITERATIONS;
        iteration += 1
      ) {
        const batch = await job();
        count += batch;
        if (batch < HOUSEKEEPING_BATCH_SIZE) break;
      }
      totals.push(count);
    }
    counts.pushTokens = totals[0] ?? 0;
    counts.notifications = totals[1] ?? 0;
    counts.alertDeliveries = totals[2] ?? 0;
    counts.locations = totals[3] ?? 0;
    const total =
      counts.pushTokens +
      counts.notifications +
      counts.alertDeliveries +
      counts.locations;
    if (total > 0)
      this.logger.log(
        `Housekeeping: tokens=${counts.pushTokens}, notificações=${counts.notifications}, entregas=${counts.alertDeliveries}, localizações=${counts.locations}`,
      );
    return total;
  }
}
