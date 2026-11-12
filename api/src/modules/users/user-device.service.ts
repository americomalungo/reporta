import { Injectable } from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { RemovePushTokenQueryDto } from './dto/remove-push-token-query.dto';
import { ReturnLocationDto } from './dto/return-location.dto';
import { ReturnPushTokenDto } from './dto/return-push-token.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

/**
 * Serviço responsável pelos tokens push e pela localização do utilizador.
 */
@Injectable()
export class UserDeviceService {
  /**
   * Cria o serviço de gestão do dispositivo do utilizador.
   * @param {PushTokenRepository} pushTokenRepository repositório de tokens push
   * @param {UserRepository} userRepository repositório de utilizadores
   */
  constructor(
    private readonly pushTokenRepository: PushTokenRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Regista ou atualiza o token push do utilizador autenticado.
   * @param {User} user utilizador autenticado
   * @param {RegisterPushTokenDto} dto dados do token e do dispositivo
   * @returns {Promise<ReturnPushTokenDto>} registo do token sem expor o token FCM
   */
  async registerPushToken(
    user: User,
    dto: RegisterPushTokenDto,
  ): Promise<ReturnPushTokenDto> {
    const pushToken = await this.pushTokenRepository.registerForUser({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
      deviceId: dto.deviceId,
    });

    return {
      id: pushToken.id,
      platform: pushToken.platform,
      deviceId: pushToken.deviceId,
      isActive: pushToken.isActive,
      updatedAt: pushToken.updatedAt,
    };
  }

  /**
   * Remove o token push apenas se pertencer ao utilizador autenticado.
   * @param {User} user utilizador autenticado
   * @param {RemovePushTokenQueryDto} query token a remover
   * @returns {Promise<{ message: string }>} confirmação idempotente da remoção
   */
  async removePushToken(
    user: User,
    query: RemovePushTokenQueryDto,
  ): Promise<{ message: string }> {
    await this.pushTokenRepository.removeForUser(user.id, query.token);
    return { message: 'Token removido' };
  }

  /**
   * Atualiza a última localização conhecida do utilizador.
   * @param {User} user utilizador autenticado
   * @param {UpdateLocationDto} dto coordenadas a guardar
   * @returns {Promise<ReturnLocationDto>} coordenadas e data da atualização
   */
  async updateLocation(
    user: User,
    dto: UpdateLocationDto,
  ): Promise<ReturnLocationDto> {
    const updatedAt = await this.userRepository.setLastLocation(
      user.id,
      dto.latitude,
      dto.longitude,
    );

    return {
      latitude: dto.latitude,
      longitude: dto.longitude,
      updatedAt,
    };
  }

  /**
   * Apaga a última localização conhecida do utilizador autenticado.
   * @param {User} user utilizador autenticado
   * @returns {Promise<{ message: string }>} confirmação da remoção
   */
  async clearLocation(user: User): Promise<{ message: string }> {
    await this.userRepository.clearLastLocation(user.id);
    return { message: 'Localização removida' };
  }
}
