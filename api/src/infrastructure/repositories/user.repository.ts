import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<Prisma.UserCreateInput> {
    return await this.prismaService.user.create({
      data,
    });
  }

  async findMany(where?: Prisma.UserWhereInput) {
    return await this.prismaService.user.findMany({
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

  async createUserStatusHistory(data: Prisma.UserStatusHistoryCreateInput) {
    return await this.prismaService.userStatusHistory.create({
      data,
    });
  }

  async deleteUserInterestZone(where: Prisma.UserInterestZoneWhereUniqueInput) {
    return await this.prismaService.userInterestZone.delete({
      where,
    });
  }
}
