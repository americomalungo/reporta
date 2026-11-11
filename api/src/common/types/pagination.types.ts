/**
 * Tipo partilhado para respostas paginadas.
 */
export interface Paginated<T> {
  /**
   * Dados da página atual.
   */
  data: T[];

  /**
   * Número da página atual.
   */
  page: number;

  /**
   * Número máximo de itens por página.
   */
  limit: number;

  /**
   * Indica se existe uma página seguinte.
   */
  hasNextPage: boolean;
}
