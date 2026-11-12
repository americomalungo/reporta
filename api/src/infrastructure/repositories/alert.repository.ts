import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
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
   * Reclama o despacho de um alerta uma única vez para o incidente.
   * @param {string} incidentId id do incidente
   * @returns {Promise<boolean>} true quando este processo reclamou o despacho
   */
  async claimDispatch(incidentId: string): Promise<boolean> {
    const updated = await this.prismaService.$executeRaw`
      UPDATE incidents
      SET "alertDispatchedAt" = now()
      WHERE id = ${incidentId}
        AND "alertDispatchedAt" IS NULL
        AND status = 'ACTIVE'
    `;
    return updated > 0;
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

      return {
        recipients,
        lastCandidateUserId: candidates[candidates.length - 1]?.userId ?? null,
      };
    });
  }
}
