import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import { PUSH_CLAIM_LEASE_MINUTES } from '@/src/common/constants/notifications.constants';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const LOCATION_MAX_AGE_HOURS = 24;

/**
 * Utilizador efetivamente incluído na tabela de entregas de alerta.
 */
export interface AlertRecipient {
  /**
   * Identificador do utilizador destinatário.
   */
  userId: string;

  /**
   * Distância entre o utilizador e o incidente, em metros.
   */
  distanceM: number | null;
  /** Nome da primeira zona que intersecta o incidente, quando existe. */
  zoneName: string | null;
}

/**
 * Resultado da reserva de um lote de entregas.
 */
export interface AlertDeliveryBatch {
  /**
   * Destinatários cujas entregas foram inseridas neste lote.
   */
  recipients: AlertRecipient[];

  /**
   * Último utilizador candidato examinado, mesmo se a entrega já existia.
   */
  lastCandidateUserId: string | null;
}

/**
 * Candidato elegível antes de reclamar a entrega.
 */
interface AlertCandidate {
  /**
   * Identificador do utilizador candidato.
   */
  userId: string;

  /**
   * Distância geográfica ao incidente, em metros.
   */
  distanceM: number | null;
  /** Nome da primeira zona que intersecta o incidente, quando existe. */
  zoneName: string | null;
}

/**
 * Repositório responsável por reclamar e persistir entregas de alertas.
 */
@Injectable()
export class AlertRepository {
  /**
   * Cria um repositório de entregas de alerta.
   * @param {PrismaService} prismaService cliente Prisma da aplicação
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Lista incidentes de risco ativos sem despacho concluído após o cursor.
   * @param {string | null} afterId cursor exclusivo do incidente anterior
   * @param {number} take máximo de ids a devolver
   * @returns {Promise<string[]>} ids ordenados dos incidentes pendentes
   * @throws {Error} se a consulta à base de dados falhar
   */
  async findUndispatchedRiskIncidentIds(
    afterId: string | null,
    take: number,
  ): Promise<string[]> {
    const incidents = await this.prismaService.incident.findMany({
      where: {
        status: 'ACTIVE',
        alertDispatchedAt: null,
        category: { is: { isRisk: true } },
        ...(afterId === null ? {} : { id: { gt: afterId } }),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take,
    });
    return incidents.map(({ id }) => id);
  }

  /**
   * Marca como concluído o despacho de um incidente ainda ativo.
   * @param {string} incidentId identificador do incidente
   * @returns {Promise<void>} conclusão da atualização
   * @throws {Error} se a atualização à base de dados falhar
   */
  async markDispatchComplete(incidentId: string): Promise<void> {
    await this.prismaService.incident.updateMany({
      where: { id: incidentId, status: 'ACTIVE', alertDispatchedAt: null },
      data: { alertDispatchedAt: new Date() },
    });
  }

  /**
   * Lista incidentes com notificações push pendentes e lease expirada.
   * @param {string | null} afterId cursor exclusivo do incidente anterior
   * @param {number} take máximo de ids a devolver
   * @returns {Promise<string[]>} ids ordenados dos incidentes pendentes
   * @throws {Error} se a consulta à base de dados falhar
   */
  async findIncidentsWithPendingPush(
    afterId: string | null,
    take: number,
  ): Promise<string[]> {
    const rows = await this.prismaService.notification.findMany({
      where: {
        type: 'RISK_ALERT',
        pushSent: false,
        incidentId: {
          not: null,
          ...(afterId === null ? {} : { gt: afterId }),
        },
        user: { pushTokens: { some: { isActive: true } } },
        OR: [
          { pushClaimedAt: null },
          {
            pushClaimedAt: {
              lte: new Date(Date.now() - PUSH_CLAIM_LEASE_MINUTES * 60_000),
            },
          },
        ],
      },
      select: { incidentId: true },
      distinct: ['incidentId'],
      orderBy: { incidentId: 'asc' },
      take,
    });
    return rows.flatMap((row) => (row.incidentId ? [row.incidentId] : []));
  }

  /**
   * Seleciona destinatários por id e insere as entregas sem duplicados.
   * Devolve também o último candidato examinado para que conflitos não bloqueiem a paginação.
   * @param {{ incidentId: string; authorId: string; afterUserId: string | null; batchSize: number }} params critérios do lote e cursor exclusivo
   * @returns {Promise<AlertDeliveryBatch>} entregas inseridas e cursor de candidatos
   */
  async deliverBatch(params: {
    incidentId: string;
    authorId: string;
    afterUserId: string | null;
    batchSize: number;
    categoryName: string;
    incidentTitle: string;
    categoryId: string;
  }): Promise<AlertDeliveryBatch> {
    return this.prismaService.$transaction(async (transaction) => {
      const afterUserIdClause =
        params.afterUserId === null
          ? Prisma.empty
          : Prisma.sql`AND u.id > ${params.afterUserId}`;

      const candidates = await transaction.$queryRaw<AlertCandidate[]>`
        SELECT
          u.id AS "userId",
          CASE
            WHEN u."lastLocation" IS NOT NULL
              AND u."lastLocationAt" >= now() - (${LOCATION_MAX_AGE_HOURS} * interval '1 hour')
            THEN ST_Distance(u."lastLocation", i.location)::float8
            ELSE NULL
          END AS "distanceM",
          (
            SELECT z.name FROM user_interest_zones z
            WHERE z."userId" = u.id AND ST_Intersects(z.area, i.location)
            ORDER BY z."createdAt" ASC, z.id ASC
            LIMIT 1
          ) AS "zoneName"
        FROM users u
        JOIN incidents i ON i.id = ${params.incidentId}
        WHERE i.status = 'ACTIVE'
          AND u.id <> ${params.authorId}
          AND u.status = 'ACTIVE'
          AND u."alertsEnabled" = true
          AND (
            (
              u."lastLocation" IS NOT NULL
              AND u."lastLocationAt" >= now() - (${LOCATION_MAX_AGE_HOURS} * interval '1 hour')
              AND ST_DWithin(u."lastLocation", i.location, u."alertRadiusM"::float8)
            )
            OR EXISTS (
              SELECT 1 FROM user_interest_zones z
              WHERE z."userId" = u.id AND ST_Intersects(z.area, i.location)
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM alert_deliveries ad
            WHERE ad."incidentId" = i.id
              AND ad."userId" = u.id
          )
          ${afterUserIdClause}
        ORDER BY u.id ASC
        LIMIT ${params.batchSize}
      `;

      if (candidates.length === 0) {
        return {
          recipients: [],
          lastCandidateUserId: null,
        };
      }

      const values = candidates.map(
        (candidate) =>
          Prisma.sql`(${randomUUID()}, ${candidate.userId}, ${params.incidentId}, ${candidate.distanceM}::float8)`,
      );
      const inserted = await transaction.$queryRaw<
        Pick<AlertRecipient, 'userId' | 'distanceM'>[]
      >(
        Prisma.sql`
          INSERT INTO alert_deliveries (
            id,
            "userId",
            "incidentId",
            "distanceM"
          )
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("incidentId", "userId") DO NOTHING
          RETURNING "userId", "distanceM"
        `,
      );
      const candidatesByUserId = new Map(
        candidates.map((candidate) => [candidate.userId, candidate]),
      );
      const recipients: AlertRecipient[] = inserted.map((recipient) => ({
        ...recipient,
        zoneName: candidatesByUserId.get(recipient.userId)?.zoneName ?? null,
      }));

      if (recipients.length > 0) {
        await transaction.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.userId,
            type: NotificationType.RISK_ALERT,
            title: 'Alerta de risco perto de si',
            body:
              recipient.distanceM !== null && recipient.zoneName !== null
                ? `A categoria ${params.categoryName} registou o incidente "${params.incidentTitle}", a cerca de ${Math.round(recipient.distanceM)} m, na sua zona "${recipient.zoneName}".`
                : recipient.distanceM !== null
                  ? `A categoria ${params.categoryName} registou o incidente "${params.incidentTitle}", a cerca de ${Math.round(recipient.distanceM)} m.`
                  : `A categoria ${params.categoryName} registou o incidente "${params.incidentTitle}" na sua zona "${recipient.zoneName ?? ''}".`,
            incidentId: params.incidentId,
            data: {
              incidentId: params.incidentId,
              categoryId: params.categoryId,
              ...(recipient.distanceM === null
                ? {}
                : { distanceM: recipient.distanceM }),
              ...(recipient.zoneName === null
                ? {}
                : { zoneName: recipient.zoneName }),
            },
          })),
        });
      }

      return {
        recipients,
        lastCandidateUserId: candidates[candidates.length - 1]?.userId ?? null,
      };
    });
  }
}
