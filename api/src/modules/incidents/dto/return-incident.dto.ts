import type { VoteType as VoteTypeEnum } from '@/src/common/types/incidents.types';
import { ReturnMediaDto } from '../../media/dto/return-media.dto';

/**
 * DTO público de resposta de um incidente.
 */
export class ReturnIncidentDto {
  /**
   * Identificador único do incidente.
   */
  id: string;
  /**
   * Identificador do autor do incidente.
   */
  authorId: string;
  /**
   * Identificador da categoria associada.
   */
  categoryId: string;
  /**
   * Título do incidente.
   */
  title: string;
  /**
   * Descrição detalhada do incidente.
   */
  description: string;
  /**
   * Endereço textual do incidente, quando disponível.
   */
  address: string | null;
  /**
   * Estado atual do incidente.
   */
  status: string;
  /**
   * Data de expiração do incidente.
   */
  expiresAt: Date;
  /**
   * Quantidade de confirmações recebidas.
   */
  confirmCount: number;
  /**
   * Quantidade de desconfirmações recebidas.
   */
  disconfirmCount: number;
  /**
   * Número de comentários associados.
   */
  commentCount: number;
  /**
   * Data de criação do incidente.
   */
  createdAt: Date;
  /**
   * Data da última atualização do incidente.
   */
  updatedAt: Date;
  /**
   * Latitude da localização do incidente.
   */
  latitude: number;
  /**
   * Longitude da localização do incidente.
   */
  longitude: number;
  /**
   * Distância em metros até o ponto de referência do filtro, ou null quando não existe filtro de proximidade.
   */
  distanceM: number | null;
  /**
   * Voto atual do utilizador autenticado, se existir.
   */
  myVote: VoteTypeEnum | null;
  /**
   * Fotos associadas ao incidente, ordenadas por sortOrder e data de criação.
   */
  media: ReturnMediaDto[];
}
