import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AccountStatus, ModerationAction, UserRole } from '@/generated/prisma';
import type { AdminUserRecord } from '@/src/common/types/moderation.types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Executa transições administrativas de contas e guarda histórico e auditoria.
 */
@Injectable()
export class AdminUserRepository {
  /** Cria o repository administrativo de utilizadores.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /** Suspende uma conta ativa.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @param {string} reason motivo
   * @param {number} days duração em dias
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  suspend(
    id: string,
    adminId: string,
    reason: string,
    days: number,
  ): Promise<AdminUserRecord> {
    return this.transition(id, adminId, ModerationAction.SUSPEND_USER, reason, {
      from: [AccountStatus.ACTIVE],
      to: AccountStatus.SUSPENDED,
      suspendedDays: days,
    });
  }
  /** Reativa uma conta suspensa.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  unsuspend(id: string, adminId: string): Promise<AdminUserRecord> {
    return this.transition(
      id,
      adminId,
      ModerationAction.UNSUSPEND_USER,
      'Suspensão removida',
      { from: [AccountStatus.SUSPENDED], to: AccountStatus.ACTIVE },
    );
  }
  /** Bane uma conta ativa ou suspensa.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @param {string} reason motivo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  ban(id: string, adminId: string, reason: string): Promise<AdminUserRecord> {
    return this.transition(id, adminId, ModerationAction.BAN_USER, reason, {
      from: [AccountStatus.ACTIVE, AccountStatus.SUSPENDED],
      to: AccountStatus.BANNED,
      clearLocation: true,
    });
  }
  /** Reativa uma conta banida.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  unban(id: string, adminId: string): Promise<AdminUserRecord> {
    return this.transition(
      id,
      adminId,
      ModerationAction.UNBAN_USER,
      'Conta reativada',
      {
        from: [AccountStatus.BANNED],
        to: AccountStatus.ACTIVE,
        resetRemovals: true,
      },
    );
  }
  /** Aplica ou estende uma restrição de publicação.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @param {string} reason motivo
   * @param {number} days duração em dias
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  restrictPosting(
    id: string,
    adminId: string,
    reason: string,
    days: number,
  ): Promise<AdminUserRecord> {
    return this.transition(
      id,
      adminId,
      ModerationAction.RESTRICT_POSTING,
      reason,
      { from: [AccountStatus.ACTIVE], postingDays: days },
    );
  }
  /** Remove uma restrição de publicação existente.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  liftPostingRestriction(
    id: string,
    adminId: string,
  ): Promise<AdminUserRecord> {
    return this.transition(
      id,
      adminId,
      ModerationAction.LIFT_POSTING_RESTRICTION,
      'Restrição de publicação removida',
      {
        from: [
          AccountStatus.ACTIVE,
          AccountStatus.SUSPENDED,
          AccountStatus.BANNED,
        ],
        liftPosting: true,
      },
    );
  }
  /** Promove um utilizador ativo a administrador.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  promote(id: string, adminId: string): Promise<AdminUserRecord> {
    return this.setRole(
      id,
      adminId,
      UserRole.USER,
      UserRole.ADMIN,
      ModerationAction.PROMOTE_ADMIN,
    );
  }
  /** Despromove um administrador quando existe outro administrador.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  demote(id: string, adminId: string): Promise<AdminUserRecord> {
    return this.setRole(
      id,
      adminId,
      UserRole.ADMIN,
      UserRole.USER,
      ModerationAction.DEMOTE_ADMIN,
    );
  }

  /** Aplica uma transição de estado e cria histórico e log atomicamente.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador
   * @param {ModerationAction} action ação auditada
   * @param {string} reason motivo
   * @param {TransitionOptions} options configuração da transição
   * @returns {Promise<AdminUserRecord>} utilizador atualizado
   * @throws {NotFoundException} se o alvo não existir ou estiver apagado
   * @throws {ConflictException} se o estado não permitir a transição
   */
  private async transition(
    id: string,
    adminId: string,
    action: ModerationAction,
    reason: string,
    options: TransitionOptions,
  ): Promise<AdminUserRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id } });
      if (!current || current.status === AccountStatus.DELETED)
        throw new NotFoundException('Utilizador não encontrado');
      this.assertCanModerate(
        current.id,
        current.role,
        adminId,
        options.allowOtherAdmin ?? false,
      );
      if (!options.from.includes(current.status))
        throw new ConflictException('Estado da conta não permite esta ação');
      if (options.liftPosting && current.postingBlockedUntil === null)
        throw new ConflictException(
          'Utilizador não tem restrição de publicação',
        );
      const now = new Date();
      const data = {
        ...(options.to === undefined
          ? {}
          : {
              status: options.to,
              statusReason: options.to === AccountStatus.ACTIVE ? null : reason,
              statusChangedAt: now,
              statusChangedBy: adminId,
              suspendedUntil:
                options.suspendedDays === undefined
                  ? null
                  : new Date(now.getTime() + options.suspendedDays * 86400000),
            }),
        ...(options.postingDays === undefined
          ? {}
          : {
              postingBlockedUntil: new Date(
                now.getTime() + options.postingDays * 86400000,
              ),
            }),
        ...(options.liftPosting ? { postingBlockedUntil: null } : {}),
        ...(options.resetRemovals
          ? { removedPostsCount: 0, postingBlockedUntil: null }
          : {}),
      };
      const changed = await tx.user.updateMany({
        where: { id, status: current.status },
        data,
      });
      if (changed.count !== 1)
        throw new ConflictException('A conta foi alterada por outro pedido');
      if (options.clearLocation) {
        await tx.pushToken.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
        await tx.$executeRaw`UPDATE users SET "lastLocation" = NULL, "lastLocationAt" = NULL WHERE id = ${id}`;
      }
      if (options.to !== undefined)
        await tx.userStatusHistory.create({
          data: {
            userId: id,
            fromStatus: current.status,
            toStatus: options.to,
            reason,
            until:
              options.suspendedDays === undefined
                ? null
                : new Date(now.getTime() + options.suspendedDays * 86400000),
            changedBy: adminId,
          },
        });
      await tx.moderationLog.create({
        data: {
          action,
          adminId,
          targetUserId: id,
          reason,
          metadata:
            options.suspendedDays === undefined &&
            options.postingDays === undefined
              ? undefined
              : {
                  ...(options.suspendedDays === undefined
                    ? {}
                    : {
                        until: new Date(
                          now.getTime() + options.suspendedDays * 86400000,
                        ).toISOString(),
                      }),
                  ...(options.postingDays === undefined
                    ? {}
                    : {
                        until: new Date(
                          now.getTime() + options.postingDays * 86400000,
                        ).toISOString(),
                      }),
                },
        },
      });
      const updated = await tx.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!updated) throw new NotFoundException('Utilizador não encontrado');
      return updated;
    });
  }

  /** Atualiza o papel de conta e audita sem ultrapassar o último administrador.
   * @param {string} id utilizador alvo
   * @param {string} adminId administrador responsável
   * @param {UserRole} from papel de origem
   * @param {UserRole} to papel final
   * @param {ModerationAction} action ação auditada
   * @returns {Promise<AdminUserRecord>} utilizador atualizado
   */
  private async setRole(
    id: string,
    adminId: string,
    from: UserRole,
    to: UserRole,
    action: ModerationAction,
  ): Promise<AdminUserRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id } });
      if (!current || current.status === AccountStatus.DELETED)
        throw new NotFoundException('Utilizador não encontrado');
      this.assertCanModerate(
        current.id,
        current.role,
        adminId,
        to === UserRole.USER,
      );
      if (
        current.role !== from ||
        (to === UserRole.ADMIN && current.status !== AccountStatus.ACTIVE)
      )
        throw new ConflictException('Estado da conta não permite esta ação');
      if (to === UserRole.USER) {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM users WHERE role = 'ADMIN' AND status <> 'DELETED' FOR UPDATE
        `;
      }
      if (
        to === UserRole.USER &&
        (await tx.user.count({
          where: {
            role: UserRole.ADMIN,
            status: { not: AccountStatus.DELETED },
          },
        })) <= 1
      )
        throw new ConflictException(
          'Não pode despromover o último administrador',
        );
      const changed = await tx.user.updateMany({
        where: { id, role: from, status: current.status },
        data: { role: to },
      });
      if (changed.count !== 1)
        throw new ConflictException('A conta foi alterada por outro pedido');
      await tx.moderationLog.create({
        data: { action, adminId, targetUserId: id },
      });
      const updated = await tx.user.findUnique({
        where: { id },
        select: userSelect,
      });
      if (!updated) throw new NotFoundException('Utilizador não encontrado');
      return updated;
    });
  }

  /** Valida os limites comuns de atuação administrativa.
   * @param {string} id identificador alvo
   * @param {UserRole} role papel atual
   * @param {string} adminId administrador
   * @param {boolean} allowOtherAdmin indica que se aplica a operação de despromoção
   * @returns {void} validação concluída
   * @throws {BadRequestException} se houver tentativa sobre si próprio
   * @throws {ForbiddenException} se tentar moderar outro administrador
   */
  private assertCanModerate(
    id: string,
    role: UserRole,
    adminId: string,
    allowOtherAdmin: boolean,
  ): void {
    if (id === adminId)
      throw new BadRequestException('Não pode moderar a própria conta');
    if (role === UserRole.ADMIN && !allowOtherAdmin)
      throw new ForbiddenException('Não pode moderar outro administrador');
  }
}

/**
 * Opções internas para transições administrativas de conta.
 */
interface TransitionOptions {
  /**
   * Estados de origem válidos.
   */
  from: AccountStatus[];
  /**
   * Estado final opcional.
   */
  to?: AccountStatus;
  /**
   * Dias de suspensão.
   */
  suspendedDays?: number;
  /**
   * Dias de bloqueio de publicação.
   */
  postingDays?: number;
  /**
   * Limpa localização e tokens.
   */
  clearLocation?: boolean;
  /**
   * Reinicia penalizações.
   */
  resetRemovals?: boolean;
  /**
   * Remove bloqueio de publicação.
   */
  liftPosting?: boolean;
  /**
   * Permite agir sobre outro administrador.
   */
  allowOtherAdmin?: boolean;
}
/** Campos selecionados para montar a resposta administrativa de utilizador. */
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  statusReason: true,
  suspendedUntil: true,
  postingBlockedUntil: true,
  removedPostsCount: true,
};
