import { Body, Controller, Delete, Put, Query } from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { RemovePushTokenQueryDto } from './dto/remove-push-token-query.dto';
import { ReturnLocationDto } from './dto/return-location.dto';
import { ReturnPushTokenDto } from './dto/return-push-token.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UserDeviceService } from './user-device.service';

/**
 * Controller para gerir o token push e a localização do utilizador autenticado.
 */
@Controller('users/me')
export class UserDeviceController {
  /**
   * Cria o controller das operações do dispositivo do utilizador.
   * @param {UserDeviceService} userDeviceService serviço de dispositivos do utilizador
   */
  constructor(private readonly userDeviceService: UserDeviceService) {}

  /**
   * Regista ou atualiza o token push do utilizador.
   * HTTP PUT /users/me/push-token
   * @param {User} user utilizador autenticado
   * @param {RegisterPushTokenDto} dto dados do token e do dispositivo
   * @returns {Promise<ReturnPushTokenDto>} dados atualizados do token
   */
  @Put('push-token')
  registerPushToken(
    @CurrentDbUser() user: User,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<ReturnPushTokenDto> {
    return this.userDeviceService.registerPushToken(user, dto);
  }

  /**
   * Remove o token push do utilizador autenticado.
   * HTTP DELETE /users/me/push-token
   * @param {User} user utilizador autenticado
   * @param {RemovePushTokenQueryDto} query token a remover
   * @returns {Promise<{ message: string }>} confirmação da remoção
   */
  @Delete('push-token')
  removePushToken(
    @CurrentDbUser() user: User,
    @Query() query: RemovePushTokenQueryDto,
  ): Promise<{ message: string }> {
    return this.userDeviceService.removePushToken(user, query);
  }

  /**
   * Atualiza a última localização conhecida do utilizador.
   * HTTP PUT /users/me/location
   * @param {User} user utilizador autenticado
   * @param {UpdateLocationDto} dto coordenadas a guardar
   * @returns {Promise<ReturnLocationDto>} coordenadas e data da atualização
   */
  @Put('location')
  updateLocation(
    @CurrentDbUser() user: User,
    @Body() dto: UpdateLocationDto,
  ): Promise<ReturnLocationDto> {
    return this.userDeviceService.updateLocation(user, dto);
  }

  /**
   * Apaga a última localização conhecida do utilizador.
   * HTTP DELETE /users/me/location
   * @param {User} user utilizador autenticado
   * @returns {Promise<{ message: string }>} confirmação da remoção
   */
  @Delete('location')
  clearLocation(@CurrentDbUser() user: User): Promise<{ message: string }> {
    return this.userDeviceService.clearLocation(user);
  }
}
