import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AccountStatus, UserRole } from '@/src/common/enums/users.enums';
import type { UpdateUserData } from '@/src/common/types/users.types';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { PublicUserDto } from './dto/public-user.dto';
import { ReturnUserDto } from './dto/return-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly authService: AuthService,
    private readonly repository: UserRepository,
  ) {}

  /**
   * Função que apresenta o perfil do usuario autenticado
   * @param {DecodedIdToken} currentUser
   * @returns {Promise<ReturnUserDto>}
   */
  async me(currentUser: DecodedIdToken): Promise<ReturnUserDto> {
    const user = await this.repository.findByFirebaseUid(currentUser.uid);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      phone: user.phone ?? undefined,
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

    const existing = await this.repository.findByFirebaseUid(firebaseUid);
    if (existing) {
      throw new ConflictException('Utilizador já registado');
    }

    const data = {
      name: dto.name,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl ? dto.avatarUrl : undefined,
      alertRadiusM: dto.alertRadiusM,
      alertsEnabled: dto.alertsEnabled,
      firebaseUid,
      email,
    };

    await this.authService.setRole(firebaseUid, UserRole.USER);
    const user = await this.repository.createUser(
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
   * @returns {Promise<ReturnUserDto[] | PublicUserDto[]>}
   */
  async findAll(
    user: DecodedIdToken,
  ): Promise<ReturnUserDto[] | PublicUserDto[]> {
    const isAdmin = user.role === UserRole.ADMIN;
    const users = await this.repository.listUsers(isAdmin);

    if (!isAdmin) {
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
      }));
    }

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
   * @returns {Promise<ReturnUserDto | PublicUserDto>}
   */
  async findOne(
    currentUser: DecodedIdToken,
    id: string,
  ): Promise<ReturnUserDto | PublicUserDto> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role !== UserRole.ADMIN) {
      if (user.firebaseUid === currentUser.uid) {
        return {
          id: user.id,
          role: user.role ? user.role : UserRole.USER,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
          alertsEnabled: user.alertsEnabled,
          avatarUrl: user.avatarUrl ?? undefined,
          alertRadiusM: user.alertRadiusM,
        };
      }
      if (user.status !== AccountStatus.ACTIVE) {
        throw new NotFoundException('User not found');
      }
      return {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
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
    id: string,
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

    const targetUser = await this.repository.findById(id);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (
      targetUser.firebaseUid !== currentUser.uid &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Não autorizado');
    }

    const userData: UpdateUserData = {
      name: dto.name,
      avatarUrl: dto.avatarUrl,
      phone: dto.phone,
      alertsEnabled: dto.alertsEnabled,
      alertRadiusM: dto.alertRadiusM,
    };
    const user = await this.repository.updateProfile(id, userData);
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
    id: string,
    currentUser: DecodedIdToken,
  ): Promise<{ message: string }> {
    const targetUser = await this.repository.findById(id);

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
        : await this.repository.findByFirebaseUid(currentUser.uid);
    if (!actor) {
      throw new ForbiddenException(
        'O utilizador que executa a ação não foi encontrado',
      );
    }

    const originalFirebaseUid = targetUser.firebaseUid;
    try {
      await this.authService.disableUser(originalFirebaseUid);
      await this.authService.revokeUserSessions(originalFirebaseUid);
      await this.repository.softDelete(id, {
        actorId: actor.id,
        reason: 'Pedido de remoção da conta',
      });
      return {
        message: `Usuário com id ${id} removido com sucesso.`,
      };
    } catch (error) {
      try {
        await this.authService.enableUser(originalFirebaseUid);
      } catch {
        // Mantém a falha original e tenta reativar o utilizador no Firebase.
      }
      throw error;
    }
  }
}
