import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    data: Prisma.UserCreateInput,
    latitude?: number,
    longitude?: number,
  ): Promise<User> {
    return this.prismaService.$transaction(async (transaction) => {
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
  }

  async setLastLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await this.prismaService.$executeRaw`
      UPDATE users
      SET "lastLocation" = ST_SetSRID(ST_MakePoint(${longitude}::float8, ${latitude}::float8), 4326)::geography,
          "lastLocationAt" = now()
      WHERE id = ${userId}
    `;
  }

  async clearLastLocation(
    userId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = transaction ?? this.prismaService;
    await client.$executeRaw`
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
    return await this.prismaService.user.update({
      where,
      data,
    });
  }

  async softDeleteUser(
    where: Prisma.UserWhereUniqueInput,
    data: Prisma.UserUpdateInput,
    statusHistory: Prisma.UserStatusHistoryCreateInput,
  ): Promise<User> {
    return this.prismaService.$transaction(async (transaction) => {
      const user = await transaction.user.update({ where, data });
      await this.clearLastLocation(user.id, transaction);
      await transaction.pushToken.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });
      await this.createUserStatusHistory(statusHistory, transaction);
      return user;
    });
  }

  async createUserStatusHistory(
    data: Prisma.UserStatusHistoryCreateInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prismaService;
    return client.userStatusHistory.create({
      data,
    });
  }

  async deleteUserInterestZone(where: Prisma.UserInterestZoneWhereUniqueInput) {
    return await this.prismaService.userInterestZone.delete({
      where,
    });
  }
}
