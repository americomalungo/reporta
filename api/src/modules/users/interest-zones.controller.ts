import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { User } from '@/src/common/types/entities.types';
import { ReturnInterestZoneDto } from './dto/return-interest-zone.dto';
import { CreateInterestZoneDto } from './dto/create-interest-zone.dto';
import { UpdateInterestZoneDto } from './dto/update-interest-zone.dto';
import { InterestZonesService } from './interest-zones.service';

/** Endpoints CRUD das zonas pertencentes ao utilizador autenticado. */
@ApiTags('Zonas de interesse')
@Controller('users/me/interest-zones')
@Roles(UserRole.ADMIN, UserRole.USER)
export class InterestZonesController {
  /** Cria o controller de zonas.
   * @param {InterestZonesService} service operações das zonas
   */
  constructor(private readonly service: InterestZonesService) {}

  /** POST /users/me/interest-zones — cria uma zona geográfica.
   * @param {User} user utilizador autenticado
   * @param {CreateInterestZoneDto} dto nome e pontos
   * @returns {Promise<ReturnInterestZoneDto>} zona criada
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  create(
    @CurrentDbUser() user: User,
    @Body() dto: CreateInterestZoneDto,
  ): Promise<ReturnInterestZoneDto> {
    return this.service.create(user, dto);
  }

  /** GET /users/me/interest-zones — lista as zonas do utilizador.
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnInterestZoneDto[]>} zonas ordenadas por criação
   */
  @Get()
  list(@CurrentDbUser() user: User): Promise<ReturnInterestZoneDto[]> {
    return this.service.list(user);
  }

  /** PATCH /users/me/interest-zones/:zoneId — renomeia uma zona.
   * @param {User} user utilizador autenticado
   * @param {string} zoneId identificador da zona
   * @param {UpdateInterestZoneDto} dto novo nome
   * @returns {Promise<ReturnInterestZoneDto>} zona atualizada
   */
  @Patch(':zoneId')
  rename(
    @CurrentDbUser() user: User,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateInterestZoneDto,
  ): Promise<ReturnInterestZoneDto> {
    return this.service.rename(user, zoneId, dto);
  }

  /** DELETE /users/me/interest-zones/:zoneId — apaga uma zona.
   * @param {User} user utilizador autenticado
   * @param {string} zoneId identificador da zona
   * @returns {Promise<{ message: string }>} confirmação
   */
  @Delete(':zoneId')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentDbUser() user: User,
    @Param('zoneId') zoneId: string,
  ): Promise<{ message: string }> {
    return this.service.remove(user, zoneId);
  }
}
