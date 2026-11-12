import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import { NotificationType } from '@/src/common/enums/notifications.enums';
import { POSTING_BLOCK_DAYS } from '@/src/common/constants/moderation.constants';
import { AuthService } from '@/src/modules/auth/auth.service';
import { NotificationDispatcherService } from '@/src/modules/notifications/notification-dispatcher.service';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { ModerationRepository } from '@/src/infrastructure/repositories/moderation.repository';
import type { CursorPage } from '@/src/common/types/pagination.types';
import type { AdminIncidentRecord } from '@/src/common/types/moderation.types';
import {
  encodeCursor,
  decodeCursor,
  isCreatedAtIdCursor,
} from '@/src/common/utils/cursor';
import { AdminIncidentsQueryDto } from './dto/admin-incidents-query.dto';
import { RemoveIncidentDto } from './dto/remove-incident.dto';
import { RestoreIncidentDto } from './dto/restore-incident.dto';
import type { User } from '@/src/common/types/entities.types';
import type { AdminUserRecord } from '@/src/common/types/moderation.types';
import { AdminUserRepository } from '@/src/infrastructure/repositories/admin-user.repository';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { RestrictPostingDto } from './dto/restrict-posting.dto';

/**
 * Coordena regras de moderação e efeitos externos.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  /** Cria o serviço de moderação.
   * @param {ModerationRepository} moderationRepository transições automáticas
   * @param {UserRepository} userRepository consulta semântica de utilizadores
   * @param {NotificationDispatcherService} notificationDispatcher notificações sem falha propagada
   * @param {AuthService} authService gestão de contas Firebase
   */
  constructor(
    private readonly moderationRepository: ModerationRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly authService: AuthService,
    private readonly adminUserRepository: AdminUserRepository,
  ) {}

  /** Avalia a remoção automática depois de um voto sem propagar falhas ao voto.
   * @param {string} incidentId identificador do incidente
   * @returns {Promise<void>} conclusão da avaliação
   */
  async evaluateIncidentAfterVote(incidentId: string): Promise<void> {
    try {
      const result =
        await this.moderationRepository.autoRemoveIncidentIfThresholdReached(
          incidentId,
        );
      if (!result) return;
      const user = await this.userRepository.findById(result.authorId);
      await this.notificationDispatcher.notify(result.authorId, {
        type: NotificationType.INCIDENT_REMOVED,
        title: 'Incidente removido',
        body: 'A comunidade confirmou que o incidente não deve permanecer ativo.',
        incidentId,
        push: false,
      });
      if (result.penalty === 'POSTING_RESTRICTED')
        await this.notificationDispatcher.notify(result.authorId, {
          type: NotificationType.POSTING_RESTRICTED,
          title: 'Publicações temporariamente limitadas',
          body: `A sua conta está impedida de publicar incidentes durante ${POSTING_BLOCK_DAYS} dias.`,
          push: false,
        });
      if (result.penalty === 'BANNED') {
        await this.notificationDispatcher.notify(result.authorId, {
          type: NotificationType.ACCOUNT_BANNED,
          title: 'Conta desativada',
          body: 'A sua conta foi desativada após várias remoções de incidentes.',
          push: false,
        });
        if (user?.status === AccountStatus.BANNED) {
          try {
            await this.authService.disableUser(user.firebaseUid);
          } catch (error: unknown) {
            this.logger.error(
              'Falha ao desativar a conta automaticamente no Firebase',
              error instanceof Error ? error.stack : String(error),
            );
          }
          try {
            await this.authService.revokeUserSessions(user.firebaseUid);
          } catch (error: unknown) {
            this.logger.error(
              'Falha ao revogar sessões da conta banida automaticamente',
              error instanceof Error ? error.stack : String(error),
            );
          }
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao avaliar moderação do incidente ${incidentId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Lista a fila de moderação por cursor.
   * @param {AdminIncidentsQueryDto} query filtros e paginação
   * @returns {Promise<CursorPage<AdminIncidentRecord>>} página de incidentes
   */
  async listIncidents(
    query: AdminIncidentsQueryDto,
  ): Promise<CursorPage<AdminIncidentRecord>> {
    const take = query.limit ?? 20;
    const cursor =
      query.cursor === undefined
        ? undefined
        : decodeCursor(query.cursor, isCreatedAtIdCursor);
    const rows = await this.moderationRepository.listForModeration(
      query.status,
      cursor === undefined
        ? undefined
        : { createdAt: new Date(cursor.createdAt), id: cursor.id },
      take + 1,
    );
    const hasNextPage = rows.length > take;
    const data = rows.slice(0, take);
    const last = data.at(-1);
    return {
      data,
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  /** Remove um incidente administrativamente e notifica o autor.
   * @param {User} admin administrador autenticado
   * @param {string} id identificador do incidente
   * @param {RemoveIncidentDto} dto motivo da remoção
   * @returns {Promise<{ message: string }>} confirmação da remoção
   */
  async removeIncident(
    admin: User,
    id: string,
    dto: RemoveIncidentDto,
  ): Promise<{ message: string }> {
    const result = await this.moderationRepository.removeByAdmin(
      id,
      admin.id,
      dto.reason,
    );
    await this.notificationDispatcher.notify(result.authorId, {
      type: NotificationType.INCIDENT_REMOVED,
      title: 'Incidente removido',
      body: 'Um incidente seu foi removido pela equipa de moderação.',
      incidentId: id,
      push: true,
    });
    return { message: 'Incidente removido' };
  }

  /** Restaura um incidente administrativamente e notifica o autor.
   * @param {User} admin administrador autenticado
   * @param {string} id identificador do incidente
   * @param {RestoreIncidentDto} dto motivo opcional
   * @returns {Promise<{ message: string }>} confirmação do restauro
   */
  async restoreIncident(
    admin: User,
    id: string,
    dto: RestoreIncidentDto,
  ): Promise<{ message: string }> {
    const result = await this.moderationRepository.restoreByAdmin(
      id,
      admin.id,
      dto.reason,
    );
    await this.notificationDispatcher.notify(result.authorId, {
      type: NotificationType.SYSTEM,
      title: 'Incidente restaurado',
      body: 'Um incidente seu foi restaurado e voltou a estar disponível.',
      incidentId: id,
      push: false,
    });
    return { message: 'Incidente restaurado' };
  }

  /** Suspende uma conta e revoga as sessões Firebase.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @param {SuspendUserDto} dto motivo e duração
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async suspendUser(
    admin: User,
    id: string,
    dto: SuspendUserDto,
  ): Promise<AdminUserRecord> {
    const target = await this.getTarget(admin, id, false);
    const result = await this.adminUserRepository.suspend(
      id,
      admin.id,
      dto.reason,
      dto.days,
    );
    try {
      await this.authService.revokeUserSessions(target.firebaseUid);
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao revogar sessões após suspensão',
        error instanceof Error ? error.stack : String(error),
      );
    }
    await this.notificationDispatcher.notify(id, {
      type: NotificationType.ACCOUNT_SUSPENDED,
      title: 'Conta suspensa',
      body: `A sua conta foi suspensa por ${dto.days} dias.`,
      push: false,
    });
    return result;
  }

  /** Reativa uma conta suspensa.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async unsuspendUser(admin: User, id: string): Promise<AdminUserRecord> {
    const result = await this.adminUserRepository.unsuspend(id, admin.id);
    await this.notificationDispatcher.notify(id, {
      type: NotificationType.ACCOUNT_REACTIVATED,
      title: 'Conta reativada',
      body: 'A suspensão da sua conta foi removida.',
      push: true,
    });
    return result;
  }

  /** Bane uma conta, desativa Firebase e revoga sessões.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @param {BanUserDto} dto motivo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async banUser(
    admin: User,
    id: string,
    dto: BanUserDto,
  ): Promise<AdminUserRecord> {
    const target = await this.getTarget(admin, id, false);
    const result = await this.adminUserRepository.ban(id, admin.id, dto.reason);
    try {
      await this.authService.disableUser(target.firebaseUid);
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao desativar conta no Firebase',
        error instanceof Error ? error.stack : String(error),
      );
    }
    try {
      await this.authService.revokeUserSessions(target.firebaseUid);
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao revogar sessões da conta banida',
        error instanceof Error ? error.stack : String(error),
      );
    }
    await this.notificationDispatcher.notify(id, {
      type: NotificationType.ACCOUNT_BANNED,
      title: 'Conta desativada',
      body: 'A sua conta foi desativada pela equipa de moderação.',
      push: false,
    });
    return result;
  }

  /** Reativa uma conta banida com compensação no Firebase se a BD falhar.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async unbanUser(admin: User, id: string): Promise<AdminUserRecord> {
    const target = await this.getTarget(admin, id, false);
    if (target.status !== AccountStatus.BANNED) {
      throw new ConflictException('A conta não está banida');
    }
    await this.authService.enableUser(target.firebaseUid);
    let result: AdminUserRecord;
    try {
      result = await this.adminUserRepository.unban(id, admin.id);
    } catch (error: unknown) {
      try {
        await this.authService.disableUser(target.firebaseUid);
      } catch (compensation: unknown) {
        this.logger.error(
          'Falha na compensação do unban no Firebase',
          compensation instanceof Error
            ? compensation.stack
            : String(compensation),
        );
      }
      throw error;
    }
    await this.notificationDispatcher.notify(id, {
      type: NotificationType.ACCOUNT_REACTIVATED,
      title: 'Conta reativada',
      body: 'A sua conta foi reativada.',
      push: true,
    });
    return result;
  }

  /** Restringe publicações por prazo definido.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @param {RestrictPostingDto} dto motivo e duração
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async restrictPosting(
    admin: User,
    id: string,
    dto: RestrictPostingDto,
  ): Promise<AdminUserRecord> {
    const result = await this.adminUserRepository.restrictPosting(
      id,
      admin.id,
      dto.reason,
      dto.days ?? POSTING_BLOCK_DAYS,
    );
    await this.notificationDispatcher.notify(id, {
      type: NotificationType.POSTING_RESTRICTED,
      title: 'Publicações temporariamente limitadas',
      body: `A sua conta está impedida de publicar durante ${dto.days ?? POSTING_BLOCK_DAYS} dias.`,
      push: true,
    });
    return result;
  }

  /** Remove uma restrição de publicação.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  liftPostingRestriction(admin: User, id: string): Promise<AdminUserRecord> {
    return this.adminUserRepository.liftPostingRestriction(id, admin.id);
  }

  /** Promove utilizador e Firebase a administrador com compensação.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async promoteUser(admin: User, id: string): Promise<AdminUserRecord> {
    const target = await this.getTarget(admin, id, false);
    if (
      target.role !== UserRole.USER ||
      target.status !== AccountStatus.ACTIVE
    ) {
      throw new ConflictException('Só é possível promover utilizadores ativos');
    }
    await this.authService.setRole(target.firebaseUid, UserRole.ADMIN);
    try {
      return await this.adminUserRepository.promote(id, admin.id);
    } catch (error: unknown) {
      try {
        await this.authService.setRole(target.firebaseUid, UserRole.USER);
      } catch (compensation: unknown) {
        this.logger.error(
          'Falha na compensação da promoção no Firebase',
          compensation instanceof Error
            ? compensation.stack
            : String(compensation),
        );
      }
      throw error;
    }
  }

  /** Despromove outro administrador com compensação no Firebase.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @returns {Promise<AdminUserRecord>} conta atualizada
   */
  async demoteUser(admin: User, id: string): Promise<AdminUserRecord> {
    if (id === admin.id)
      throw new ConflictException('Não pode despromover a própria conta');
    const target = await this.getTarget(admin, id, true);
    if (target.role !== UserRole.ADMIN) {
      throw new ConflictException('O utilizador não é administrador');
    }
    await this.authService.setRole(target.firebaseUid, UserRole.USER);
    try {
      return await this.adminUserRepository.demote(id, admin.id);
    } catch (error: unknown) {
      try {
        await this.authService.setRole(target.firebaseUid, UserRole.ADMIN);
      } catch (compensation: unknown) {
        this.logger.error(
          'Falha na compensação da despromoção no Firebase',
          compensation instanceof Error
            ? compensation.stack
            : String(compensation),
        );
      }
      throw error;
    }
  }

  /** Lê o alvo e verifica os limites comuns antes de chamar serviços externos.
   * @param {User} admin administrador autenticado
   * @param {string} id conta alvo
   * @param {boolean} allowAdmin indica que a operação pode visar outro admin
   * @returns {Promise<User>} utilizador alvo existente
   * @throws {NotFoundException} se a conta não existir ou estiver apagada
   * @throws {BadRequestException} se tentar atuar sobre si próprio
   * @throws {ForbiddenException} se tentar moderar outro administrador
   */
  private async getTarget(
    admin: User,
    id: string,
    allowAdmin: boolean,
  ): Promise<User> {
    const target = await this.userRepository.findById(id);
    if (!target || target.status === AccountStatus.DELETED)
      throw new NotFoundException('Utilizador não encontrado');
    if (target.id === admin.id)
      throw new BadRequestException('Não pode moderar a própria conta');
    if (target.role === UserRole.ADMIN && !allowAdmin)
      throw new ForbiddenException('Não pode moderar outro administrador');
    return target;
  }
}
