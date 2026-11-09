import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from '@modules/users/dto/update-user.dto';
import { CreateUserDto } from '@modules/users/dto/create-user.dto';
import { Prisma } from '@/generated/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(
    dto: CreateUserDto,
    firebaseUid: string,
    email: string,
  ): Promise<Prisma.UserCreateInput> {
    const data = {
      name: dto.name,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl ? dto.avatarUrl : undefined,
      alertRadiusM: dto?.alertRadiusM,
      alertsEnable: dto?.alertsEnabled,
      lastLatitude: dto?.lastLatitude,
      lastLongitude: dto?.lastLongitude,
      firebaseUid,
      email,
    };
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

  async update(where: Prisma.UserWhereUniqueInput, data: UpdateUserDto) {
    return await this.prismaService.user.update({
      where,
      data,
    });
  }
}
