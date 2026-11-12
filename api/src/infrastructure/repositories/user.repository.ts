import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@/generated/prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isPrismaError } from '../prisma/prisma-errors';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    data: Prisma.UserCreateInput,
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
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Utilizador já registado');
      }
      throw error;
    }
  }

  /**
   * Atualiza a última localização conhecida do utilizador.
   * @param {string} userId id do utilizador
   * @param {number} latitude latitude em graus decimais
   * @param {number} longitude longitude em graus decimais
   * @returns {Promise<Date>} data de atualização persistida pela base de dados
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
    if (!location) {
      throw new NotFoundException('Utilizador não encontrado');
    }
    return location.lastLocationAt;
  }

  async clearLastLocation(userId: string): Promise<void> {
    await this.prismaService.$executeRaw`
      UPDATE users
      SET "lastLocation" = NULL,
          "lastLocationAt" = NULL
      WHERE id = ${userId}
    `;
  }

  private async clearLastLocationInTransaction(
    userId: string,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    await transaction.$executeRaw`
      UPDATE users
      SET "lastLocation" = NULL,
          "lastLocationAt" = NULL
      WHERE id = ${userId}
    `;
  }

  async getLastLocation(
    userId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const locations = await this.prismaService.$queryRaw<
      { latitude: number; longitude: number }[]
    >`
      SELECT
        ST_Y("lastLocation"::geometry) AS latitude,
        ST_X("lastLocation"::geometry) AS longitude
      FROM users
      WHERE id = ${userId} AND "lastLocation" IS NOT NULL
    `;
    return locations[0] ?? null;
  }

  async findMany(where?: Prisma.UserWhereInput) {
    return await this.prismaService.user.findMany({
      where,
    });
  }

  async findFirst(where: Prisma.UserWhereInput) {
    return this.prismaService.user.findFirst({
      where,
    });
  }

  async findUnique(where: Prisma.UserWhereUniqueInput) {
    return await this.prismaService.user.findUnique({
      where,
    });
  }

  async update(
    where: Prisma.UserWhereUniqueInput,
    data: Prisma.UserUpdateInput,
  ) {
    try {
      return await this.prismaService.user.update({ where, data });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Utilizador não encontrado');
      }
      throw error;
    }
  }

  async softDeleteUser(
    where: Prisma.UserWhereUniqueInput,
    data: Prisma.UserUpdateInput,
    statusHistory: Prisma.UserStatusHistoryCreateInput,
  ): Promise<User> {
    try {
      return await this.prismaService.$transaction(async (transaction) => {
        const user = await transaction.user.update({ where, data });
        await this.clearLastLocationInTransaction(user.id, transaction);
        await transaction.pushToken.updateMany({
          where: { userId: user.id },
          data: { isActive: false },
        });
        await this.createUserStatusHistory(statusHistory, transaction);
        return user;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Utilizador não encontrado');
      }
      throw error;
    }
  }

  private async createUserStatusHistory(
    data: Prisma.UserStatusHistoryCreateInput,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    await transaction.userStatusHistory.create({
      data,
    });
  }

  async deleteUserInterestZone(where: Prisma.UserInterestZoneWhereUniqueInput) {
    try {
      return await this.prismaService.userInterestZone.delete({ where });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Zona de interesse não encontrada');
      }
      throw error;
    }
  }
}
