import { IsEnum } from 'class-validator';
import type { VoteType as VoteTypeEnum } from '@/src/common/types/incidents.types';
import { VoteType } from '@/src/common/enums/incidents.enums';

/**
 * DTO do voto a aplicar num incidente.
 */
export class VoteIncidentDto {
  /**
   * Tipo do voto: confirmação ou desconfirmação.
   */
  @IsEnum(VoteType)
  type: VoteTypeEnum;
}
