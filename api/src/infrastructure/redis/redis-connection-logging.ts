import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

/**
 * Registers connection lifecycle logs without exposing Redis credentials.
 * @param {Redis} client Redis-compatible client to observe
 * @param {Logger} logger logger receiving connection lifecycle messages
 * @param {string} connectionName non-sensitive label for the connection
 * @returns {void} completion of listener registration
 */
export function registerRedisConnectionLogging(
  client: Redis,
  logger: Logger,
  connectionName: string,
): void {
  let failureLogged = false;
  client.on('error', (error: Error) => {
    const code = getRedisErrorCode(error);
    if (failureLogged) {
      logger.debug(`${connectionName} connection error: ${code}`);
      return;
    }
    failureLogged = true;
    logger.warn(`${connectionName} connection interrupted: ${code}`);
  });
  client.on('ready', () => {
    failureLogged = false;
    logger.log(
      `${connectionName} connected to ${client.options.host ?? 'unknown'}:${client.options.port ?? 6379}`,
    );
  });
}

/**
 * Extracts a safe error code without logging an error message or connection URL.
 * @param {Error} error Redis connection error
 * @returns {string} error code or UNKNOWN when no code is available
 */
function getRedisErrorCode(error: Error): string {
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
}
