import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALERT_DELIVERY_RETENTION_DAYS,
  HOUSEKEEPING_BATCH_SIZE,
  INACTIVE_PUSH_TOKEN_RETENTION_DAYS,
  LOCATION_RETENTION_DAYS,
  NOTIFICATION_RETENTION_DAYS,
} from '@/src/common/constants/maintenance.constants';

/** Persiste tarefas de manutenção agendada em operações idempotentes. */
@Injectable()
export class MaintenanceRepository {
  /** Cria o repository de manutenção.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  async acquireJobLock(job: string, token: string): Promise<boolean> {
    const rows = await this.prismaService.$queryRaw<{ job: string }[]>`
      INSERT INTO maintenance_job_locks (job, token, "leaseUntil")
      VALUES (${job}, ${token}, now() + interval '1 minute')
      ON CONFLICT (job) DO UPDATE
      SET token = EXCLUDED.token, "leaseUntil" = EXCLUDED."leaseUntil"
      WHERE maintenance_job_locks."leaseUntil" <= now()
      RETURNING job
    `;
    return rows.length > 0;
  }

  async renewJobLock(job: string, token: string): Promise<boolean> {
    const count = await this.prismaService.$executeRaw`
      UPDATE maintenance_job_locks
      SET "leaseUntil" = now() + interval '1 minute'
      WHERE job = ${job} AND token = ${token}
    `;
    return count === 1;
  }

  async releaseJobLock(job: string, token: string): Promise<void> {
    await this.prismaService.$executeRaw`
      DELETE FROM maintenance_job_locks WHERE job = ${job} AND token = ${token}
    `;
  }

  /** Expira um lote de incidentes ativos vencidos.
   * @param {number} batchSize máximo de incidentes por lote
   * @returns {Promise<string[]>} IDs que passaram a expirados
   */
  async expireIncidents(batchSize: number): Promise<string[]> {
    const rows = await this.prismaService.$queryRaw<{ id: string }[]>`
      WITH expired AS (
        SELECT id FROM incidents
        WHERE status = 'ACTIVE' AND "expiresAt" <= now()
        ORDER BY "expiresAt", id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE incidents AS i
      SET status = 'EXPIRED', "updatedAt" = now()
      FROM expired
      WHERE i.id = expired.id AND i.status = 'ACTIVE'
        AND i."expiresAt" <= now()
      RETURNING i.id
    `;
    return rows.map((row) => row.id);
  }

  /** Remove um lote de tokens push inativos antigos.
   * @returns {Promise<number>} quantidade apagada
   */
  async deleteInactivePushTokens(): Promise<number> {
    return this.prismaService.$executeRaw`
      DELETE FROM push_tokens WHERE id IN (
        SELECT id FROM push_tokens WHERE "isActive" = false
          AND "updatedAt" < now() - (${INACTIVE_PUSH_TOKEN_RETENTION_DAYS} * interval '1 day')
        ORDER BY "updatedAt", id LIMIT ${HOUSEKEEPING_BATCH_SIZE}
      )
    `;
  }

  /** Remove um lote de notificações antigas.
   * @returns {Promise<number>} quantidade apagada
   */
  async deleteOldNotifications(): Promise<number> {
    return this.prismaService.$executeRaw`
      DELETE FROM notifications WHERE id IN (
        SELECT id FROM notifications
        WHERE "createdAt" < now() - (${NOTIFICATION_RETENTION_DAYS} * interval '1 day')
        ORDER BY "createdAt", id LIMIT ${HOUSEKEEPING_BATCH_SIZE}
      )
    `;
  }

  /** Remove um lote de entregas de alertas antigas.
   * @returns {Promise<number>} quantidade apagada
   */
  async deleteOldAlertDeliveries(): Promise<number> {
    return this.prismaService.$executeRaw`
      DELETE FROM alert_deliveries WHERE id IN (
        SELECT id FROM alert_deliveries
        WHERE "deliveredAt" < now() - (${ALERT_DELIVERY_RETENTION_DAYS} * interval '1 day')
        ORDER BY "deliveredAt", id LIMIT ${HOUSEKEEPING_BATCH_SIZE}
      )
    `;
  }

  /** Anula localizações antigas de um lote de utilizadores.
   * @returns {Promise<number>} quantidade atualizada
   */
  async clearOldLocations(): Promise<number> {
    return this.prismaService.$executeRaw`
      UPDATE users SET "lastLocation" = NULL, "lastLocationAt" = NULL, "updatedAt" = now()
      WHERE id IN (
        SELECT id FROM users WHERE "lastLocationAt" < now() - (${LOCATION_RETENTION_DAYS} * interval '1 day')
        ORDER BY "lastLocationAt", id LIMIT ${HOUSEKEEPING_BATCH_SIZE}
      )
    `;
  }
}
