/**
 * Página de resultados percorrida por cursor.
 */
export interface CursorPage<T> {
  /**
   * Elementos da página atual.
   */
  data: T[];

  /**
   * Cursor para obter a página seguinte, ou null quando não existe.
   */
  nextCursor: string | null;

  /**
   * Indica se existem mais resultados após esta página.
   */
  hasNextPage: boolean;
}
