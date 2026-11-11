import type { VoteType as VoteTypeEnum } from '@/src/common/types/incidents.types';

/**
 * Resposta de estado do voto atual num incidente.
 */
export class ReturnVoteDto {
  /**
   * Identificador do incidente.
   */
  incidentId: string;

  /**
   * Voto atual do utilizador autenticado, ou null se ainda não votou.
   */
  myVote: VoteTypeEnum | null;

  /**
   * Total de confirmações do incidente.
   */
  confirmCount: number;

  /**
   * Total de desconfirmações do incidente.
   */
  disconfirmCount: number;
}
