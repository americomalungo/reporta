import type { InterestZoneRecord } from '@/src/common/types/interest-zones.types';

/** Zona de interesse devolvida ao respetivo utilizador. */
export class ReturnInterestZoneDto implements InterestZoneRecord {
  /** Identificador da zona. */
  id: string;
  /** Nome apresentado. */
  name: string;
  /** Vértices sem repetição do ponto final de fecho. */
  points: { latitude: number; longitude: number }[];
  /** Área geográfica em metros quadrados. */
  areaM2: number;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última alteração. */
  updatedAt: Date;
}
