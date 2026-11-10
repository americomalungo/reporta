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
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import { ReturnUserDto } from './dto/return-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    private readonly repository: UserRepository,
  ) {}

  /**
   * Função que apresenta o perfil do usuario autenticado
   * @param {DecodedIdToken} currentUser
   * @returns {Promise<ReturnUserDto>}
   */
  async me(currentUser: DecodedIdToken): Promise<ReturnUserDto> {
    const user = await this.repository.findUnique({
      firebaseUid: currentUser.uid,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      phone: currentUser.phone_number,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
      alertRadiusM: user?.alertRadiusM,
    };
  }

  /**
   * Função que cria um usuário no banco de dados
   * @param {CreateUserDto} dto
   * @param {DecodedIdToken} currentUser
   * @returns {Promise<ReturnUserDto>}
   */
  async create(
    dto: CreateUserDto,
    currentUser: DecodedIdToken,
  ): Promise<ReturnUserDto> {
    const firebaseUid = currentUser.uid;
    const email = currentUser.email;

    if (!email) {
      throw new BadRequestException('Conta firebase sem email');
    }

    const hasLatitude = dto.lastLatitude !== undefined;
    const hasLongitude = dto.lastLongitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Latitude e longitude devem ser informadas em conjunto',
      );
    }
    const lastLocation =
      dto.lastLatitude !== undefined && dto.lastLongitude !== undefined
        ? {
            latitude: dto.lastLatitude,
            longitude: dto.lastLongitude,
          }
        : undefined;

    const existing = await this.repository.findUnique({ firebaseUid });
    if (existing) throw new ConflictException('User already exists');

    await this.auth.setCustomUserClaims(firebaseUid, { role: UserRole.USER });

    const data = {
      name: dto.name,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl ? dto.avatarUrl : undefined,
      alertRadiusM: dto.alertRadiusM,
      alertsEnabled: dto.alertsEnabled,
      firebaseUid,
      email,
    };

    const user = await this.repository.create(
      data,
      lastLocation?.latitude,
      lastLocation?.longitude,
    );

    return {
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      alertRadiusM: user.alertRadiusM,
      alertsEnabled: user.alertsEnabled,
      phone: user.phone ? user.phone : undefined,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
    };
  }

  /**
   * Função que retorna todos usuarios
   * Se o usuario atenticado for admin, retorna todos. Senão retorna somente os ativos
   * @param {DecodedIdToken} user
   * @returns {Promise<ReturnUserDto[]>}
   */
  async findAll(user: DecodedIdToken): Promise<ReturnUserDto[]> {
    const where =
      user.role === UserRole.ADMIN ? {} : { status: AccountStatus.ACTIVE };

    const users = await this.repository.findMany(where);

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role ?? UserRole.USER,
      email: u.email,
      phone: u.phone ?? undefined,
      alertsEnabled: u.alertsEnabled,
      avatarUrl: u.avatarUrl ?? undefined,
      alertRadiusM: u.alertRadiusM,
    }));
  }

  /**
   * Função que retorna o perfil de um usuário
   * @param {DecodedIdToken} currentUser
   * @param {{ id: string }} param
   * @returns {Promise<ReturnUserDto>}
   */
  async findOne(
    currentUser: DecodedIdToken,
    param: { id: string },
  ): Promise<ReturnUserDto> {
    const user =
      currentUser.role === UserRole.ADMIN
        ? await this.repository.findUnique(param)
        : await this.repository.findFirst({
            id: param.id,
            status: AccountStatus.ACTIVE,
          });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      role: user.role ? user.role : UserRole.USER,
      name: user.name,
      email: user.email,
      phone: user.phone ? user.phone : undefined,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
      alertRadiusM: user?.alertRadiusM,
    };
  }

  /**
   * Função que atualiza um usuário
   * @param {{ id: string }} where
   * @param {UpdateUserDto} dto
   * @param {DecodedIdToken} currentUser
   * @returns {Promise<ReturnUserDto>}
   */
  async update(
    where: { id: string },
    dto: UpdateUserDto,
    currentUser: DecodedIdToken,
  ): Promise<ReturnUserDto> {
    const hasLatitude = dto.lastLatitude !== undefined;
    const hasLongitude = dto.lastLongitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Latitude e longitude devem ser informadas em conjunto',
      );
    }
    const lastLocation =
      dto.lastLatitude !== undefined && dto.lastLongitude !== undefined
        ? {
            latitude: dto.lastLatitude,
            longitude: dto.lastLongitude,
          }
        : undefined;

    const targetUser = await this.repository.findUnique(where);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (
      targetUser.firebaseUid !== currentUser.uid &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Não autorizado');
    }

    const userData: UpdateUserDto = {
      name: dto.name,
      avatarUrl: dto.avatarUrl,
      phone: dto.phone,
      alertsEnabled: dto.alertsEnabled,
      alertRadiusM: dto.alertRadiusM,
      email: dto.email,
    };
    const user = await this.repository.update(where, userData);
    if (lastLocation) {
      await this.repository.setLastLocation(
        user.id,
        lastLocation.latitude,
        lastLocation.longitude,
      );
    }
    return {
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      phone: user.phone ? user.phone : undefined,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
      alertRadiusM: user.alertRadiusM,
    };
  }

  /**
   * Função que elimina (soft delete) um usuário
   * @param {{ id: string }} where
   * @param {DecodedIdToken} currentUser
   * @returns {Promise<{ message: string }>}
   */
  async remove(
    where: { id: string },
    currentUser: DecodedIdToken,
  ): Promise<{ message: string }> {
    const targetUser = await this.repository.findUnique(where);

    if (!targetUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (
      targetUser.firebaseUid !== currentUser.uid &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Não autorizado');
    }

    const actor =
      targetUser.firebaseUid === currentUser.uid
        ? targetUser
        : await this.repository.findUnique({ firebaseUid: currentUser.uid });
    if (!actor) {
      throw new ForbiddenException(
        'O utilizador que executa a ação não foi encontrado',
      );
    }

    const originalFirebaseUid = targetUser.firebaseUid;
    await this.auth.updateUser(originalFirebaseUid, { disabled: true });
    await this.auth.revokeRefreshTokens(originalFirebaseUid);

    const statusChangedAt = new Date();
    const dataToUpdate = {
      firebaseUid: `deleted_${targetUser.id}`,
      email: `deleted+${targetUser.id}@reporta.com`,
      name: 'Utilizador removido',
      avatarUrl: null,
      phone: null,
      alertsEnabled: false,
      status: AccountStatus.DELETED,
      statusChangedAt,
      statusChangedBy: actor.id,
    };

    await this.repository.softDeleteUser(where, dataToUpdate, {
      fromStatus: targetUser.status,
      toStatus: AccountStatus.DELETED,
      changedBy: actor.id,
      user: { connect: { id: targetUser.id } },
    });

    return {
      message: `Usuário com id ${where.id} removido com sucesso.`,
    };
  }
}
