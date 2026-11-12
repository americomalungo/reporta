import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ModerationAction } from '@/src/common/enums/moderation.enums';
import type { ModerationAction as ModerationActionType } from '@/src/common/types/moderation.types';
import { CursorPaginationQueryDto } from '@/src/common/dto/cursor-pagination-query.dto';
/** Filtros da pesquisa de auditoria administrativa. */
export class AdminModerationLogsQueryDto extends CursorPaginationQueryDto {
  /** Ação de moderação. */ @IsOptional()
  @IsEnum(ModerationAction)
  action?: ModerationActionType;
  /** Utilizador alvo. */ @IsOptional() @IsString() targetUserId?: string;
  /** Incidente associado. */ @IsOptional() @IsString() incidentId?: string;
  /** Administrador responsável. */ @IsOptional() @IsString() adminId?: string;
}
