/** Coordenada geográfica ordenada em latitude e longitude. */
export interface GeoPoint {
  /** Latitude WGS84 em graus decimais. */
  latitude: number;
  /** Longitude WGS84 em graus decimais. */
  longitude: number;
}

/** Dados de domínio para criar uma zona de interesse. */
export interface CreateInterestZoneData {
  /** Nome apresentado pelo utilizador. */
  name: string;
  /** Vértices do contorno sem repetição do ponto inicial. */
  points: GeoPoint[];
}

/** Zona de interesse convertida para coordenadas públicas. */
export interface InterestZoneRecord {
  /** Identificador da zona. */
  id: string;
  /** Nome apresentado. */
  name: string;
  /** Vértices do polígono sem o ponto final repetido. */
  points: GeoPoint[];
  /** Área aproximada calculada em metros quadrados. */
  areaM2: number;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última alteração. */
  updatedAt: Date;
}
