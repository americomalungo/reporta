/**
 * Localização atualizada devolvida ao utilizador.
 */
export class ReturnLocationDto {
  /**
   * Latitude da localização, em graus decimais.
   */
  latitude: number;

  /**
   * Longitude da localização, em graus decimais.
   */
  longitude: number;

  /**
   * Data em que a localização foi atualizada.
   */
  updatedAt: Date;
}
