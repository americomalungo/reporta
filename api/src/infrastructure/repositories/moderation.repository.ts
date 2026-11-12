import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  IncidentStatus,
  ModerationAction,
  UserRole,
} from '@/generated/prisma';
import type {
  AdminIncidentActionResult,
  AdminIncidentRecord,
  AutoRemovalResult,
} from '@/src/common/types/moderation.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTO_BAN_REASON,
  AUTO_REMOVE_REASON,
  AUTO_REMOVE_DISCONFIRM_RATIO,
  AUTO_REMOVE_MIN_DISCONFIRMS,
  BAN_AT_REMOVED,
  POSTING_BLOCK_AT_REMOVED,
  POSTING_BLOCK_DAYS,
} from '@/src/common/constants/moderation.constants';
import { REPUTATION_INCIDENT_REMOVED_PENALTY } from '@/src/common/constants/reputation.constants';

/**
 * Persiste transições de moderação e os respetivos registos de auditoria.
 */
@Injectable()
export class ModerationRepository {
  /**
   * Cria o repository de moderação. @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /** Remove atomicamente um incidente quando os votos atingem o limiar automático.
   * @param {string} incidentId identificador do incidente
   * @returns {Promise<AutoRemovalResult | null>} resultado da remoção ou null se o limiar não foi aplicado
   */
  async autoRemoveIncidentIfThresholdReached(
    incidentId: string,
  ): Promise<AutoRemovalResult | null> {
    return this.prismaService.$transaction(async (tx) => {
      const reason = AUTO_REMOVE_REASON;
      const removed = await tx.$queryRaw<
        { authorId: string; confirmCount: number; disconfirmCount: number }[]
      >`
        UPDATE incidents SET status = 'REMOVED', "removedAt" = now(), "removedBy" = NULL,
          "removedReason" = ${reason}, "updatedAt" = now()
        WHERE id = ${incidentId} AND status = 'ACTIVE'
          AND "disconfirmCount" >= ${AUTO_REMOVE_MIN_DISCONFIRMS}
          AND "disconfirmCount" >= ${AUTO_REMOVE_DISCONFIRM_RATIO} * "confirmCount"
        RETURNING "authorId", "confirmCount", "disconfirmCount"
      `;
      const incident = removed[0];
      if (!incident) return null;
      const authors = await tx.$queryRaw<
        {
          id: string;
          removedPostsCount: number;
          role: UserRole;
          status: AccountStatus;
        }[]
      >`
        UPDATE users SET "removedPostsCount" = "removedPostsCount" + 1,
          "reputationScore" = GREATEST("reputationScore" + ${REPUTATION_INCIDENT_REMOVED_PENALTY}, 0),
          "updatedAt" = now()
        WHERE id = ${incident.authorId} RETURNING id, "removedPostsCount", role, status
      `;
      const author = authors[0];
      if (!author)
        throw new NotFoundException('Autor do incidente não encontrado');
      await tx.moderationLog.create({
        data: {
          action: ModerationAction.REMOVE_INCIDENT,
          adminId: null,
          incidentId,
          targetUserId: author.id,
          reason,
          metadata: {
            auto: true,
            confirmCount: incident.confirmCount,
            disconfirmCount: incident.disconfirmCount,
          },
        },
      });
      let penalty: AutoRemovalResult['penalty'] = 'NONE';
      if (
        author.role === UserRole.USER &&
        author.status === AccountStatus.ACTIVE
      ) {
        if (author.removedPostsCount === POSTING_BLOCK_AT_REMOVED) {
          await tx.user.update({
            where: { id: author.id },
            data: {
              postingBlockedUntil: new Date(
                Date.now() + POSTING_BLOCK_DAYS * 86400000,
              ),
            },
          });
          await tx.moderationLog.create({
            data: {
              action: ModerationAction.RESTRICT_POSTING,
              adminId: null,
              targetUserId: author.id,
              reason: 'Restrição automática de publicação',
              metadata: { auto: true },
            },
          });
          penalty = 'POSTING_RESTRICTED';
        } else if (author.removedPostsCount >= BAN_AT_REMOVED) {
          const changedAt = new Date();
          await tx.user.update({
            where: { id: author.id },
            data: {
              status: AccountStatus.BANNED,
              statusReason: AUTO_BAN_REASON,
              statusChangedAt: changedAt,
              statusChangedBy: null,
            },
          });
          await tx.userStatusHistory.create({
            data: {
              userId: author.id,
              fromStatus: AccountStatus.ACTIVE,
              toStatus: AccountStatus.BANNED,
              reason: AUTO_BAN_REASON,
              changedBy: null,
            },
          });
          await tx.pushToken.updateMany({
            where: { userId: author.id },
            data: { isActive: false },
          });
          await tx.$executeRaw`UPDATE users SET "lastLocation" = NULL, "lastLocationAt" = NULL WHERE id = ${author.id}`;
          await tx.moderationLog.create({
            data: {
              action: ModerationAction.BAN_USER,
              adminId: null,
              targetUserId: author.id,
              reason: AUTO_BAN_REASON,
              metadata: { auto: true },
            },
          });
          penalty = 'BANNED';
        }
      }
      return {
        incidentId,
        authorId: author.id,
        removedPostsCount: author.removedPostsCount,
        penalty,
      };
    });
  }

  /** Lista incidentes para a fila de moderação com cursor estável.
   * @param {IncidentStatus | undefined} status estado opcional a filtrar
   * @param {{ createdAt: Date; id: string } | undefined} cursor posição da página
   * @param {number} take quantidade máxima de resultados
   * @returns {Promise<AdminIncidentRecord[]>} incidentes ordenados do mais recente
   */
  async listForModeration(
    status: IncidentStatus | undefined,
    cursor: { createdAt: Date; id: string } | undefined,
    take: number,
  ): Promise<AdminIncidentRecord[]> {
    return this.prismaService.incident.findMany({
      where: {
        ...(status === undefined
          ? {
              status: {
                in: [IncidentStatus.UNDER_REVIEW, IncidentStatus.REMOVED],
              },
            }
          : { status }),
        ...(cursor === undefined
          ? {}
          : {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        title: true,
        status: true,
        confirmCount: true,
        disconfirmCount: true,
        removedAt: true,
        removedBy: true,
        removedReason: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  /** Remove um incidente por decisão administrativa e guarda a auditoria na mesma transação.
   * @param {string} id identificador do incidente
   * @param {string} adminId identificador do administrador
   * @param {string} reason motivo registado
   * @returns {Promise<AdminIncidentActionResult>} incidente removido e respetivo autor
   * @throws {NotFoundException} se o incidente não existir ou estiver apagado
   * @throws {ConflictException} se o estado atual não permitir a remoção
   */
  async removeByAdmin(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<AdminIncidentActionResult> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.incident.findUnique({
        where: { id },
        select: { authorId: true, status: true },
      });
      if (!current || current.status === IncidentStatus.DELETED) {
        throw new NotFoundException('Incidente não encontrado');
      }
      if (current.status === IncidentStatus.REMOVED) {
        throw new ConflictException('Incidente já removido');
      }
      if (
        ![
          IncidentStatus.ACTIVE,
          IncidentStatus.EXPIRED,
          IncidentStatus.UNDER_REVIEW,
        ].includes(current.status)
      ) {
        throw new ConflictException('Estado do incidente não permite remoção');
      }
      const changed = await tx.incident.updateMany({
        where: { id, status: current.status },
        data: {
          status: IncidentStatus.REMOVED,
          removedAt: new Date(),
          removedBy: adminId,
          removedReason: reason,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'O incidente foi alterado por outro pedido',
        );
      }
      await tx.$executeRaw`
        UPDATE users SET "reputationScore" = GREATEST("reputationScore" + ${REPUTATION_INCIDENT_REMOVED_PENALTY}, 0),
          "updatedAt" = now() WHERE id = ${current.authorId}
      `;
      await tx.moderationLog.create({
        data: {
          action: ModerationAction.REMOVE_INCIDENT,
          adminId,
          incidentId: id,
          targetUserId: current.authorId,
          reason,
          metadata: { auto: false },
        },
      });
      return { incidentId: id, authorId: current.authorId };
    });
  }

  /** Restaura um incidente e audita a ação atomicamente.
   * @param {string} id identificador do incidente
   * @param {string} adminId identificador do administrador
   * @param {string | undefined} reason motivo opcional
   * @returns {Promise<AdminIncidentActionResult>} incidente restaurado e estado final
   * @throws {NotFoundException} se o incidente não existir ou estiver apagado
   * @throws {ConflictException} se o estado atual não permitir restauro
   */
  async restoreByAdmin(
    id: string,
    adminId: string,
    reason?: string,
  ): Promise<AdminIncidentActionResult> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.incident.findUnique({
        where: { id },
        select: {
          authorId: true,
          status: true,
          expiresAt: true,
          removedBy: true,
        },
      });
      if (!current || current.status === IncidentStatus.DELETED) {
        throw new NotFoundException('Incidente não encontrado');
      }
      if (
        current.status !== IncidentStatus.REMOVED &&
        current.status !== IncidentStatus.UNDER_REVIEW
      ) {
        throw new ConflictException('Estado do incidente não permite restauro');
      }
      const status =
        current.expiresAt > new Date()
          ? IncidentStatus.ACTIVE
          : IncidentStatus.EXPIRED;
      const changed = await tx.incident.updateMany({
        where: { id, status: current.status },
        data: { status, removedAt: null, removedBy: null, removedReason: null },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'O incidente foi alterado por outro pedido',
        );
      }
      if (
        current.status === IncidentStatus.REMOVED &&
        current.removedBy === null
      ) {
        await tx.$executeRaw`UPDATE users SET "removedPostsCount" = GREATEST("removedPostsCount" - 1, 0),
          "reputationScore" = GREATEST("reputationScore" - ${REPUTATION_INCIDENT_REMOVED_PENALTY}, 0),
          "updatedAt" = now() WHERE id = ${current.authorId}`;
      } else if (current.status === IncidentStatus.REMOVED) {
        await tx.$executeRaw`UPDATE users SET "reputationScore" = GREATEST("reputationScore" - ${REPUTATION_INCIDENT_REMOVED_PENALTY}, 0),
          "updatedAt" = now() WHERE id = ${current.authorId}`;
      }
      await tx.moderationLog.create({
        data: {
          action: ModerationAction.RESTORE_INCIDENT,
          adminId,
          incidentId: id,
          targetUserId: current.authorId,
          reason,
          metadata: { auto: false },
        },
      });
      return { incidentId: id, authorId: current.authorId, status };
    });
  }
}
