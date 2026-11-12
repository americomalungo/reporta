import { BadRequestException } from '@nestjs/common';

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
