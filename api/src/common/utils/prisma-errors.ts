/**
 * Verifica se um erro originado pelo Prisma tem um código específico.
 * @param {unknown} error erro capturado
 * @param {string} code código Prisma a comparar
 * @returns {boolean} true quando o erro corresponde ao código passado
 */
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
