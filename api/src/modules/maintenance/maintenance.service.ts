import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MaintenanceJob } from '@/src/common/enums/maintenance.enums';
import {
  CLEANUP_MEDIA_BATCH_SIZE,
  EXPIRE_INCIDENTS_BATCH_SIZE,
  HOUSEKEEPING_BATCH_SIZE,
  MAINTENANCE_MAX_BATCH_ITERATIONS,
  ORPHAN_MIN_AGE_HOURS,
  ORPHAN_SCAN_MAX_PAGES,
  ORPHAN_SCAN_PAGE_SIZE,
  LIFT_SUSPENSIONS_BATCH_SIZE,
} from '@/src/common/constants/maintenance.constants';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import { MaintenanceRepository } from '@/src/infrastructure/repositories/maintenance.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { IncidentMediaRepository } from '@/src/infrastructure/repositories/incident-media.repository';
import { StorageService } from '@/src/infrastructure/storage/storage.service';
import { NotificationDispatcherService } from '@/src/modules/notifications/notification-dispatcher.service';
import { EnvService } from '@/src/infrastructure/env/env.service';
import type { MaintenanceRunResult } from '@/src/common/types/maintenance.types';

/** Executa os cinco jobs de manutenção de forma idempotente e sem sobreposição local. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly runningJobs = new Set<MaintenanceJob>();

  /** Cria o executor dos jobs de manutenção.
   * @param {MaintenanceRepository} maintenanceRepository alterações de expiração e retenção
   * @param {UserRepository} userRepository reativação atómica das suspensões
   * @param {IncidentMediaRepository} mediaRepository consulta e remoção das linhas de media
   * @param {StorageService} storageService armazenamento privado
   * @param {NotificationDispatcherService} notificationDispatcher notificações best effort
   * @param {EnvService} env configuração de ativação dos crons
   */
  constructor(
    private readonly maintenanceRepository: MaintenanceRepository,
    private readonly userRepository: UserRepository,
    private readonly mediaRepository: IncidentMediaRepository,
    private readonly storageService: StorageService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly env: EnvService,
  ) {}

  /** Expira incidentes ativos vencidos a cada cinco minutos.
   * @returns {Promise<void>} conclusão do disparo
   */
  @Cron('*/5 * * * *', { name: 'expire-incidents', timeZone: 'Africa/Luanda' })
  async cronExpireIncidents(): Promise<void> {
    await this.runScheduled(MaintenanceJob.EXPIRE_INCIDENTS);
  }

  /** Reativa suspensões vencidas a cada cinco minutos.
   * @returns {Promise<void>} conclusão do disparo
   */
  @Cron('*/5 * * * *', { name: 'lift-suspensions', timeZone: 'Africa/Luanda' })
  async cronLiftSuspensions(): Promise<void> {
    await this.runScheduled(MaintenanceJob.LIFT_SUSPENSIONS);
  }

  /** Limpa media retida a cada hora.
   * @returns {Promise<void>} conclusão do disparo
   */
  @Cron('0 * * * *', { name: 'cleanup-media', timeZone: 'Africa/Luanda' })
  async cronCleanupMedia(): Promise<void> {
    await this.runScheduled(MaintenanceJob.CLEANUP_MEDIA);
  }

  /** Procura objetos sem referência diariamente às 03:30.
   * @returns {Promise<void>} conclusão do disparo
   */
  @Cron('30 3 * * *', { name: 'scan-orphans', timeZone: 'Africa/Luanda' })
  async cronScanOrphans(): Promise<void> {
    await this.runScheduled(MaintenanceJob.SCAN_ORPHANS);
  }

  /** Apaga dados auxiliares diariamente às 04:00.
   * @returns {Promise<void>} conclusão do disparo
   */
  @Cron('0 4 * * *', { name: 'housekeeping', timeZone: 'Africa/Luanda' })
  async cronHousekeeping(): Promise<void> {
    await this.runScheduled(MaintenanceJob.HOUSEKEEPING);
  }

  /** Executa manualmente um job e devolve duração e total afetado.
   * @param {MaintenanceJob} job job a executar
   * @returns {Promise<MaintenanceRunResult>} resumo da execução
   * @throws {ConflictException} se o mesmo job já estiver em execução
   */
  async execute(job: MaintenanceJob): Promise<MaintenanceRunResult> {
    if (this.runningJobs.has(job))
      throw new ConflictException('Job já em execução');
    this.runningJobs.add(job);
    const startedAt = Date.now();
    let affected = 0;
    try {
      switch (job) {
        case MaintenanceJob.EXPIRE_INCIDENTS:
          affected = await this.expireIncidents();
          break;
        case MaintenanceJob.LIFT_SUSPENSIONS:
          affected = await this.liftSuspensions();
          break;
        case MaintenanceJob.CLEANUP_MEDIA:
          affected = await this.cleanupMedia();
          break;
        case MaintenanceJob.SCAN_ORPHANS:
          affected = await this.scanOrphans();
          break;
        case MaintenanceJob.HOUSEKEEPING:
          affected = await this.housekeeping();
          break;
      }
    } catch (error: unknown) {
      const details =
        error instanceof Error
          ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
          : String(error);
      this.logger.error(`Falha no job ${job}`, details);
    } finally {
      this.runningJobs.delete(job);
    }
    const durationMs = Date.now() - startedAt;
    if (affected > 0)
      this.logger.log(
        `Job ${job}: ${affected} itens afetados em ${durationMs} ms`,
      );
    return { job, affected, durationMs };
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
    let continuationToken: string | undefined;
    for (let page = 0; page < ORPHAN_SCAN_MAX_PAGES; page += 1) {
      const result = await this.storageService.listObjects('incidents/', {
        continuationToken,
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
      continuationToken = result.nextToken ?? undefined;
      if (!continuationToken) break;
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

  /** Dispara um job cron apenas quando ativado e sem sobreposição local.
   * @param {MaintenanceJob} job job agendado
   * @returns {Promise<void>} conclusão do disparo
   */
  private async runScheduled(job: MaintenanceJob): Promise<void> {
    if (!this.env.jobsEnabled || this.runningJobs.has(job)) return;
    await this.execute(job);
  }
}
