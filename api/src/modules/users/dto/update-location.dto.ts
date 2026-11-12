import { IsLatitude, IsLongitude } from 'class-validator';

/**
 * Coordenadas da última localização conhecida do utilizador.
 */
export class UpdateLocationDto {
  /**
   * Latitude da localização, em graus decimais.
   */
  @IsLatitude()
  latitude: number;

  /**
   * Longitude da localização, em graus decimais.
   */
  @IsLongitude()
  longitude: number;
}
