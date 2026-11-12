import { BadRequestException } from '@nestjs/common';

/** Valida um cursor com data ISO em `createdAt` e identificador.
 * @param {unknown} value valor descodificado do cursor
 * @returns {value is { createdAt: string; id: string }} indica se a estrutura é válida
 */
export function isCreatedAtIdCursor(
  value: unknown,
): value is { createdAt: string; id: string } {
  if (!isRecordWithExactKeys(value, ['createdAt', 'id'])) return false;
  return isStrictIsoDate(value.createdAt) && isNonEmptyString(value.id);
}

/** Valida cursores legados com data ISO em `t` e identificador.
 * @param {unknown} value valor descodificado do cursor
 * @returns {value is { t: string; id: string }} indica se a estrutura é válida
 */
export function isTimestampIdCursor(
  value: unknown,
): value is { t: string; id: string } {
  if (!isRecordWithExactKeys(value, ['t', 'id'])) return false;
  return isStrictIsoDate(value.t) && isNonEmptyString(value.id);
}

/** Verifica se o valor é um objeto com exatamente as chaves pedidas.
 * @param {unknown} value valor a validar
 * @param {string[]} keys conjunto de chaves permitido
 * @returns {value is Record<string, unknown>} resultado da validação estrutural
 */
function isRecordWithExactKeys(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/** Valida uma data ISO canónica sem aceitar datas inválidas.
 * @param {unknown} value valor a validar
 * @returns {value is string} indica data ISO exata
 */
function isStrictIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

/** Valida um identificador textual não vazio.
 * @param {unknown} value valor a validar
 * @returns {value is string} indica texto não vazio
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Codifica o conteúdo de um cursor em base64url.
 * @param {T} payload dados tipados do cursor
 * @returns {string} cursor opaco codificado
 */
export function encodeCursor<T extends object>(payload: T): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Descodifica e valida um cursor.
 * @param {string} raw cursor em base64url
 * @param {(value: unknown) => value is T} guard validação da estrutura descodificada
 * @returns {T} dados validados do cursor
 * @throws {BadRequestException} se o cursor não for válido
 */
export function decodeCursor<T>(
  raw: string,
  guard: (value: unknown) => value is T,
): T {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) {
      throw new Error('Invalid base64url');
    }

    const bytes = Buffer.from(raw, 'base64url');
    if (bytes.toString('base64url') !== raw) {
      throw new Error('Non-canonical base64url');
    }

    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!guard(value)) {
      throw new Error('Invalid cursor shape');
    }
    return value;
  } catch {
    throw new BadRequestException('Cursor inválido');
  }
}
