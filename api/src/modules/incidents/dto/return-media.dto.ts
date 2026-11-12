/**
 * Representação pública de uma imagem de incidente.
 */
export class ReturnMediaDto {
  /**
   * Identificador da imagem.
   */
  id: string;
  /**
   * URL assinado de leitura, que expira após pelo menos seis horas.
   */
  url: string;
  /**
   * Largura em píxeis, quando disponível.
   */
  width: number | null;
  /**
   * Altura em píxeis, quando disponível.
   */
  height: number | null;
  /**
   * Posição da imagem dentro do incidente.
   */
  sortOrder: number;
}
