import { ConflictException, Injectable } from '@nestjs/common';
import type { PushToken } from '@/generated/prisma';
import { isPrismaError } from '../prisma/prisma-errors';
import type { PushPlatform } from '@/src/common/types/devices.types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Repositório responsável pela persistência dos tokens push dos utilizadores.
 */
@Injectable()
export class PushTokenRepository {
  /**
   * Cria um repositório de tokens push.
   * @param {PrismaService} prismaService cliente Prisma da aplicação
   */
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Regista ou transfere um token push para o utilizador indicado.
   * @param {{ userId: string; token: string; platform: PushPlatform; deviceId?: string }} data dados do token e do utilizador
   * @returns {Promise<PushToken>} registo atualizado do token
   * @throws {ConflictException} se outro registo concorrente usar o mesmo token
   */
  async registerForUser(data: {
    userId: string;
    token: string;
    platform: PushPlatform;
    deviceId?: string;
  }): Promise<PushToken> {
    try {
      return await this.prismaService.$transaction(async (transaction) => {
        const pushToken = await transaction.pushToken.upsert({
          where: { token: data.token },
          create: {
            userId: data.userId,
            token: data.token,
            platform: data.platform,
            deviceId: data.deviceId ?? null,
            isActive: true,
          },
          update: {
            userId: data.userId,
            platform: data.platform,
            deviceId: data.deviceId ?? null,
            isActive: true,
          },
        });

        if (data.deviceId) {
          await transaction.pushToken.updateMany({
            where: {
              userId: data.userId,
              deviceId: data.deviceId,
              token: { not: data.token },
            },
            data: { isActive: false },
          });
        }

        return pushToken;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          'Registo em processamento, tente novamente',
        );
      }
      throw error;
    }
  }

  /**
   * Remove um token apenas quando pertence ao utilizador indicado.
   * @param {string} userId id do utilizador
   * @param {string} token token push a remover
   * @returns {Promise<number>} quantidade de registos removidos
   */
  async removeForUser(userId: string, token: string): Promise<number> {
    const result = await this.prismaService.pushToken.deleteMany({
      where: { token, userId },
    });
    return result.count;
  }

  /**
   * Busca os tokens ativos dos utilizadores indicados.
   * @param {string[]} userIds ids dos utilizadores
   * @returns {Promise<{ userId: string; token: string }[]>} tokens ativos agrupáveis por utilizador
   */
  findActiveByUserIds(
    userIds: string[],
  ): Promise<{ userId: string; token: string }[]> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prismaService.pushToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      select: {
        userId: true,
        token: true,
      },
    });
  }

  /**
   * Desativa um conjunto de tokens FCM.
   * @param {string[]} tokens tokens inválidos ou já não registados
   * @returns {Promise<number>} quantidade de tokens desativados
   */
  async deactivateTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) {
      return 0;
    }

    const result = await this.prismaService.pushToken.updateMany({
      where: {
        token: { in: tokens },
        isActive: true,
      },
      data: { isActive: false },
    });
    return result.count;
  }
}
