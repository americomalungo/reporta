import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from '@infra/repositories/users.repository';
import { AccountStatus } from '@/generated/prisma';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '@/src/infrastructure/firebase/firebase.constants';
import { UserRole } from '@/src/common/enums/users.enums';
import { ReturnUserDto } from './dto/return-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    private readonly repository: UserRepository,
  ) {}

  /**
   * Função que apresenta o perfil do usuario autenticado
   *
   * 
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
   *
   * 
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

    const existing = await this.repository.findUnique({ firebaseUid });
    if (existing) throw new ConflictException('User already exists');

    const defaultRole = UserRole.USER;
    await this.auth.setCustomUserClaims(firebaseUid, { role: defaultRole });

    const user = await this.repository.create(dto, firebaseUid, email);

    if (!user) {
      throw new InternalServerErrorException(
        'Não foi possivel criar o usuario',
      );
    }

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
   * Função que retorna todos usuarios ativos
   *
   * 
   * @returns {Promise<ReturnUserDto[]>}
   */
  async findAll(): Promise<ReturnUserDto[]> {
    const where = {
      status: AccountStatus.ACTIVE,
    };

    const users = await this.repository.findMany(where);

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      phone: user.phone ? user.phone : undefined,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
      alertRadiusM: user?.alertRadiusM,
    }));
  }

  /**
   * Função que retorna o perfil de um usuário
   *
   * 
   * @param {{ id: string }} where
   * @returns {Promise<ReturnUserDto>}
   */
  async findOne(where: { id: string }): Promise<ReturnUserDto> {
    const user = await this.repository.findUnique(where);

    if (!user || user.status !== AccountStatus.ACTIVE) {
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
   *
   * 
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
    if (
      (await this.repository.findUnique(where))?.firebaseUid !== currentUser.uid
    ) {
      throw new ForbiddenException('Não autorizado');
    }
    const user = await this.repository.update(where, dto);

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role ? user.role : UserRole.USER,
      email: user.email,
      phone: user.phone ? user.phone : undefined,
      alertsEnabled: user.alertsEnabled,
      avatarUrl: user.avatarUrl ? user.avatarUrl : undefined,
      alertRadiusM: user?.alertRadiusM,
    };
  }

  /**
   * Função que elimina (soft delete) um usuário
   *
   * 
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
      throw new NotFoundException('Usuario não encontrado');
    }

    if (targetUser.firebaseUid !== currentUser.uid) {
      throw new ForbiddenException('Não autorizado');
    }

    const dataToUpdate = await this.generateAnonymizedUserData(where.id);

    const user = await this.repository.update(where, dataToUpdate);

    if (!user) {
      throw new InternalServerErrorException(
        'Usuário não deletado. Erro interno do servidor',
      );
    }

    return {
      message: `Usuario com id ${where.id} removido com sucesso.`,
    };
  }

  /**
   * Função que altera dados do usuário para ser deletado(soft delete)
   *
   * @private
   * 
   * @param {string} id
   * @returns {Promise<
   *     ReturnUserDto & {
   *       lastLongitude: undefined;
   *       lastLatitude: undefined;
   *       firebaseUid: string;
   *       alertRadiusM: undefined;
   *       status: AccountStatus;
   *       statusChangedAt: Date;
   *     }
   *   >}
   */
  private async generateAnonymizedUserData(id: string): Promise<
    ReturnUserDto & {
      lastLongitude: undefined;
      lastLatitude: undefined;
      firebaseUid: string;
      alertRadiusM: undefined;
      status: AccountStatus;
      statusChangedAt: Date;
    }
  > {
    const user = await this.findOne({ id });

    if (!user) {
      throw new NotFoundException(
        `Usuário com ID ${id} não encontrado para anonimização.`,
      );
    }

    return {
      id: user.id,
      firebaseUid: `deleted_${user.id}`,
      role: user.role ?? UserRole.USER,
      email: `deleted+${user.id}@reporta.com`,
      name: 'Utilizador removido',
      avatarUrl: undefined,
      phone: undefined,
      alertsEnabled: false,
      lastLongitude: undefined,
      lastLatitude: undefined,
      alertRadiusM: undefined,
      status: AccountStatus.DELETED,
      statusChangedAt: new Date(),
    };
  }
}
