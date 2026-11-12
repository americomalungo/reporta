import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/src/common/decorators/roles.decorator';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import { UserRole } from '@/src/common/enums/users.enums';
import type { User } from '@/src/common/types/entities.types';
import { AdminUserDto } from './dto/admin-user.dto';
import { ModerationService } from './moderation.service';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { RestrictPostingDto } from './dto/restrict-posting.dto';

/**
 * Endpoints administrativos para a gestão de contas.
 */
@ApiTags('Admin')
@Controller('admin/users')
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  /** Cria o controller administrativo de utilizadores.
   * @param {ModerationService} moderationService coordenação das ações
   */
  constructor(private readonly moderationService: ModerationService) {}
  /** POST /admin/users/:id/suspend — suspende uma conta.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @param {SuspendUserDto} dto motivo e prazo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ): Promise<AdminUserDto> {
    return this.moderationService.suspendUser(admin, id, dto);
  }
  /** POST /admin/users/:id/unsuspend — reativa uma conta suspensa.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  unsuspend(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
  ): Promise<AdminUserDto> {
    return this.moderationService.unsuspendUser(admin, id);
  }
  /** POST /admin/users/:id/ban — bane uma conta.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @param {BanUserDto} dto motivo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  ban(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ): Promise<AdminUserDto> {
    return this.moderationService.banUser(admin, id, dto);
  }
  /** POST /admin/users/:id/unban — reativa uma conta banida.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  unban(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
  ): Promise<AdminUserDto> {
    return this.moderationService.unbanUser(admin, id);
  }
  /** POST /admin/users/:id/restrict-posting — restringe publicações.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @param {RestrictPostingDto} dto dados da restrição @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/restrict-posting')
  @HttpCode(HttpStatus.OK)
  restrict(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
    @Body() dto: RestrictPostingDto,
  ): Promise<AdminUserDto> {
    return this.moderationService.restrictPosting(admin, id, dto);
  }
  /** POST /admin/users/:id/lift-posting-restriction — remove o bloqueio de publicação.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/lift-posting-restriction')
  @HttpCode(HttpStatus.OK)
  lift(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
  ): Promise<AdminUserDto> {
    return this.moderationService.liftPostingRestriction(admin, id);
  }
  /** POST /admin/users/:id/promote — promove a conta a administrador.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/promote')
  @HttpCode(HttpStatus.OK)
  promote(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
  ): Promise<AdminUserDto> {
    return this.moderationService.promoteUser(admin, id);
  }
  /** POST /admin/users/:id/demote — despromove outro administrador.
   * @param {User} admin administrador autenticado @param {string} id conta alvo @returns {Promise<AdminUserDto>} conta atualizada
   */
  @Post(':id/demote')
  @HttpCode(HttpStatus.OK)
  demote(
    @CurrentDbUser() admin: User,
    @Param('id') id: string,
  ): Promise<AdminUserDto> {
    return this.moderationService.demoteUser(admin, id);
  }
}
