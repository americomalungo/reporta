import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from '@infra/repositories/users.repository';
import { AccountStatus } from '@/generated/prisma';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import { UserRole } from '@/src/common/enums/users.enums';

@Injectable()
export class UsersService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    private readonly repository: UserRepository,
  ) {}

  async create(dto: CreateUserDto, currentUser: DecodedIdToken) {
    const firebaseUid = currentUser.uid;
    const email = currentUser.email;

    if (!email) {
      throw new BadRequestException('Conta firebase sem email');
    }

    const existing = await this.repository.findUnique({ firebaseUid });
    if (existing) throw new ConflictException('User already exists');

    const defaultRole = UserRole.USER;
    await this.auth.setCustomUserClaims(firebaseUid, { role: defaultRole });

    const user = await this.repository.create(dto, firebaseUid, email);

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      alertRadiusM: user.alertRadiusM,
      alertsEnabled: user.alertsEnabled,
      firebaseUid: user?.firebaseUid,
      phone: user?.phone,
      avatarUrl: user?.avatarUrl,
    };
  }

  async findAll() {
    const where = {
      status: AccountStatus.ACTIVE,
    };

    const users = await this.repository.findMany(where);

    return users.map((user) => ({
      return: {
        id: user.id,
        name: user.name,
        email: user.email,
        firebaseUid: user.firebaseUid,
        phone: user.phone,
        alertsEnabled: user.alertsEnabled,
        avatarUrl: user?.avatarUrl,
        alertRadiusM: user?.alertRadiusM,
      },
    }));
  }

  async findOne(where: { id: string }) {
    const user = await this.repository.findUnique(where);

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      firebaseUid: user.firebaseUid,
      phone: user.phone,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user?.avatarUrl,
      alertRadiusM: user?.alertRadiusM,
    };
  }

  async update(
    where: { id: string },
    dto: UpdateUserDto,
    currentUser: DecodedIdToken,
  ) {
    const user = await this.repository.update(where, dto);

    if (user.firebaseUid !== currentUser.uid) {
      throw new ForbiddenException('Não autorizado');
    }

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      firebaseUid: user.firebaseUid,
      phone: user.phone,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user?.avatarUrl,
      alertRadiusM: user?.alertRadiusM,
    };
  }

  async remove(where: { id: string }, currentUser: DecodedIdToken) {
    if ((await this.findOne(where)).firebaseUid !== currentUser.uid) {
      throw new ForbiddenException('Não autorizado');
    }

    const user = await this.generateAnonymizedUserData(where.id);

    const updatedUser = await this.repository.update(where, user);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: `User with id ${where.id} has been anonymized and removed.`,
    };
  }

  private async generateAnonymizedUserData(id: string) {
    const user = await this.findOne({ id });

    const dataToUpdate = {
      id: user.id,
      firebaseUid: `deleted_${user.id}`,
      email: `deleted+${user.id}@reporta.com`,
      name: 'Utilizador removido',
      avatarUrl: undefined,
      phone: undefined,
      alertsEnabled: false,
      alertRadiusM: undefined,
      status: AccountStatus.DELETED,
      statusChangedAt: new Date(),
    };

    return dataToUpdate;
  }
}
