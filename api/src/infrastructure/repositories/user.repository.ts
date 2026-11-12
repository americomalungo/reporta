import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AccountStatus, User } from '@/generated/prisma';
import type { Prisma } from '@/generated/prisma';
import { ModerationAction } from '@/src/common/enums/moderation.enums';
import type {
  CreateUserData,
  SoftDeleteUserOptions,
  UpdateUserData,
  UserLocation,
} from '@/src/common/types/users.types';
import { PrismaService } from '../prisma/prisma.service';
import { isPrismaError } from '../prisma/prisma-errors';

/**
 * Persiste e consulta utilizadores e os seus dados associados.
 */
@Injectable()
export class UserRepository {
  /**
   * Cria o repository de utilizadores.
   * @param {PrismaService} prismaService acesso à base de dados
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Cria um utilizador e, opcionalmente, guarda a sua localização inicial.
   * @param {CreateUserData} data dados do perfil e da conta Firebase
   * @param {number | undefined} latitude latitude inicial opcional
   * @param {number | undefined} longitude longitude inicial opcional
   * @returns {Promise<User>} utilizador persistido
   * @throws {ConflictException} se email ou identificador Firebase já estiver registado
   */
  async createUser(
    data: CreateUserData,
    latitude?: number,
    longitude?: number,
  ): Promise<User> {
    try {
      return await this.prismaService.$transaction(async (transaction) => {
        const user = await transaction.user.create({ data });
        if (latitude !== undefined && longitude !== undefined) {
          await transaction.$executeRaw`
            UPDATE users
            SET "lastLocation" = ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography,
                "lastLocationAt" = now()
            WHERE id = ${user.id}
          `;
        }
        return user;
      });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Utilizador já registado');
      }
      throw error;
    }
  }

  /**
   * Procura um utilizador pelo identificador Firebase.
   * @param {string} firebaseUid identificador do utilizador no Firebase
   * @returns {Promise<User | null>} utilizador encontrado ou null
   */
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.prismaService.user.findUnique({ where: { firebaseUid } });
  }

  /**
   * Procura um utilizador pelo identificador interno.
   * @param {string} id identificador interno do utilizador
   * @returns {Promise<User | null>} utilizador encontrado ou null
   */
  async findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({ where: { id } });
  }

  /**
   * Lista utilizadores, podendo incluir estados não ativos para administração.
   * @param {boolean} includeInactive indica se os estados não ativos são incluídos
   * @returns {Promise<User[]>} utilizadores encontrados por ordem de criação
   */
  async listUsers(includeInactive: boolean): Promise<User[]> {
    return this.prismaService.user.findMany({
      where: includeInactive ? undefined : { status: AccountStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Atualiza apenas os campos editáveis do perfil.
   * @param {string} id identificador interno do utilizador
   * @param {UpdateUserData} data campos de perfil a atualizar
   * @returns {Promise<User>} utilizador atualizado
   * @throws {NotFoundException} se o utilizador não existir
   */
  async updateProfile(id: string, data: UpdateUserData): Promise<User> {
    try {
      return await this.prismaService.user.update({
        where: { id },
        data,
      });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Utilizador não encontrado');
      }
      throw error;
    }
  }

  /**
   * Atualiza a última localização conhecida do utilizador.
   * @param {string} userId identificador interno do utilizador
   * @param {number} latitude latitude em graus decimais
   * @param {number} longitude longitude em graus decimais
   * @returns {Promise<Date>} data da localização persistida
   * @throws {NotFoundException} se o utilizador não existir
   */
  async setLastLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<Date> {
    const locations = await this.prismaService.$queryRaw<
      { lastLocationAt: Date }[]
    >`
      UPDATE users
      SET "lastLocation" = ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography,
          "lastLocationAt" = now()
      WHERE id = ${userId}
      RETURNING "lastLocationAt"
    `;
    const location = locations[0];
    if (!location) throw new NotFoundException('Utilizador não encontrado');
    return location.lastLocationAt;
  }

  /**
   * Apaga a localização guardada do utilizador.
   * @param {string} userId identificador interno do utilizador
   * @returns {Promise<void>} conclusão da remoção da localização
   */
  async clearLastLocation(userId: string): Promise<void> {
    await this.prismaService.$executeRaw`
      UPDATE users
      SET "lastLocation" = NULL,
          "lastLocationAt" = NULL
      WHERE id = ${userId}
    `;
  }

  /**
   * Devolve a localização geográfica guardada do utilizador.
   * @param {string} userId identificador interno do utilizador
   * @returns {Promise<UserLocation | null>} coordenadas encontradas ou null
   */
  async getLastLocation(userId: string): Promise<UserLocation | null> {
    const locations = await this.prismaService.$queryRaw<UserLocation[]>`
      SELECT
        ST_Y("lastLocation"::geometry) AS latitude,
        ST_X("lastLocation"::geometry) AS longitude
      FROM users
      WHERE id = ${userId} AND "lastLocation" IS NOT NULL
    `;
    return locations[0] ?? null;
  }

  /**
   * Remove logicamente um utilizador e regista o histórico numa transação.
   * @param {string} id identificador interno do utilizador
   * @param {SoftDeleteUserOptions} options ator e motivo da remoção
   * @returns {Promise<User>} utilizador anonimizado e marcado como removido
   * @throws {NotFoundException} se o utilizador não existir
   */
  async softDelete(id: string, options: SoftDeleteUserOptions): Promise<User> {
    try {
      return await this.prismaService.$transaction(async (transaction) => {
        const currentUser = await transaction.user.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!currentUser) {
          throw new NotFoundException('Utilizador não encontrado');
        }

        const deletedAt = new Date();
        const user = await transaction.user.update({
          where: { id },
          data: {
            firebaseUid: `deleted_${id}`,
            email: `deleted+${id}@reporta.com`,
            name: 'Utilizador removido',
            avatarUrl: null,
            phone: null,
            alertsEnabled: false,
            status: AccountStatus.DELETED,
            statusReason: options.reason ?? null,
            statusChangedAt: deletedAt,
            statusChangedBy: options.actorId,
          },
        });
        await transaction.$executeRaw`
          UPDATE users
          SET "lastLocation" = NULL,
              "lastLocationAt" = NULL
          WHERE id = ${id}
        `;
        await transaction.pushToken.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
        await transaction.userInterestZone.deleteMany({
          where: { userId: id },
        });
        await transaction.userStatusHistory.create({
          data: {
            userId: id,
            fromStatus: currentUser.status,
            toStatus: AccountStatus.DELETED,
            changedBy: options.actorId,
            reason: options.reason,
          },
        });
        return user;
      });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Utilizador não encontrado');
      }
      throw error;
    }
  }

  /**
   * Reativa uma suspensão expirada e regista o histórico e a auditoria.
   * @param {string} id identificador interno do utilizador
   * @returns {Promise<User | null>} utilizador atualizado ou estado relido após concorrência
   */
  async liftExpiredSuspension(id: string): Promise<User | null> {
    return this.prismaService.$transaction(async (transaction) => {
      const changedAt = new Date();
      const result = await transaction.user.updateMany({
        where: {
          id,
          status: AccountStatus.SUSPENDED,
          suspendedUntil: { lte: changedAt },
        },
        data: {
          status: AccountStatus.ACTIVE,
          statusReason: null,
          statusChangedAt: changedAt,
          statusChangedBy: null,
          suspendedUntil: null,
        },
      });

      if (result.count === 0) {
        return transaction.user.findUnique({ where: { id } });
      }
      await this.recordExpiredSuspensions(transaction, [id]);
      return transaction.user.findUnique({ where: { id } });
    });
  }

  /** Reativa um lote de suspensões vencidas com exclusão concorrente e auditoria atómica.
   * @param {number} batchSize limite de utilizadores por lote
   * @returns {Promise<string[]>} identificadores reativados nesta transação
   */
  async liftExpiredSuspensions(batchSize: number): Promise<string[]> {
    return this.prismaService.$transaction(
      async (transaction) => {
        const changed = await transaction.$queryRaw<{ id: string }[]>`
        WITH expired AS (
          SELECT id FROM users
          WHERE status = 'SUSPENDED' AND "suspendedUntil" <= now()
          ORDER BY "suspendedUntil", id
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE users AS u
        SET status = 'ACTIVE', "suspendedUntil" = NULL, "statusReason" = NULL,
            "statusChangedAt" = now(), "statusChangedBy" = NULL, "updatedAt" = now()
        FROM expired
        WHERE u.id = expired.id AND u.status = 'SUSPENDED'
          AND u."suspendedUntil" <= now()
        RETURNING u.id
      `;
        const ids = changed.map((user) => user.id);
        await this.recordExpiredSuspensions(transaction, ids);
        return ids;
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  }

  /** Regista histórico e auditoria para utilizadores reativados numa transação existente.
   * @param {Prisma.TransactionClient} transaction transação do repository
   * @param {string[]} userIds utilizadores reativados
   * @returns {Promise<void>} conclusão dos registos
   */
  private async recordExpiredSuspensions(
    transaction: Prisma.TransactionClient,
    userIds: string[],
  ): Promise<void> {
    const reason = 'Suspensão expirada automaticamente';
    for (const userId of userIds) {
      await transaction.userStatusHistory.create({
        data: {
          userId,
          fromStatus: AccountStatus.SUSPENDED,
          toStatus: AccountStatus.ACTIVE,
          reason,
          changedBy: null,
        },
      });
      await transaction.moderationLog.create({
        data: {
          action: ModerationAction.UNSUSPEND_USER,
          adminId: null,
          targetUserId: userId,
          reason,
          metadata: { auto: true },
        },
      });
    }
  }

  /**
   * Remove uma zona de interesse pertencente ao utilizador indicado.
   * @param {string} userId identificador do proprietário da zona
   * @param {string} zoneId identificador da zona de interesse
   * @returns {Promise<void>} conclusão da remoção
   * @throws {NotFoundException} se a zona não pertencer ao utilizador ou não existir
   */
  async deleteInterestZone(userId: string, zoneId: string): Promise<void> {
    try {
      await this.prismaService.userInterestZone.delete({
        where: { id: zoneId, userId },
      });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Zona de interesse não encontrada');
      }
      throw error;
    }
  }
}
