import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/src/infrastructure/cache/cache.constants';
import { EnvService } from '@/src/infrastructure/env/env.service';

/** Resilient JSON cache backed by the shared Redis-compatible client. */
@Injectable()
export class CacheService {
  /** Logger for non-sensitive cache failure notices. */
  private readonly logger = new Logger(CacheService.name);

  /** Creates the cache adapter.
   * @param {Redis} redis shared Redis-compatible client
   * @param {EnvService} env configuration containing the cache key prefix
   */
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly env: EnvService,
  ) {}

  /** Reads and validates a cached JSON value.
   * @param {string} key logical cache key
   * @param {(value: unknown) => value is T} guard runtime value validator
   * @returns {Promise<T | null>} validated value or cache miss
   */
  async get<T>(
    key: string,
    guard: (value: unknown) => value is T,
  ): Promise<T | null> {
    try {
      const serialized = await this.redis.get(this.cacheKey(key));
      if (serialized === null) return null;
      const value: unknown = JSON.parse(serialized);
      return guard(value) ? value : null;
    } catch {
      this.logger.warn('Cache read failed; treating as cache miss');
      return null;
    }
  }

  /** Writes a JSON value with a millisecond time to live.
   * @param {string} key logical cache key
   * @param {unknown} value JSON serializable value
   * @param {number} ttlMs cache lifetime in milliseconds
   * @returns {Promise<void>} completion of the best effort write
   */
  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) return;
      await this.redis.set(
        this.cacheKey(key),
        serialized,
        'PX',
        Math.max(1, Math.floor(ttlMs)),
      );
    } catch {
      this.logger.warn('Cache write failed');
    }
  }

  /** Deletes one cache entry.
   * @param {string} key logical cache key
   * @returns {Promise<void>} completion of the best effort deletion
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.cacheKey(key));
    } catch {
      this.logger.warn('Cache delete failed');
    }
  }

  /** Deletes entries matching a logical prefix using SCAN.
   * @param {string} prefix logical cache key prefix
   * @returns {Promise<void>} completion of the best effort deletion
   */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const escapedPrefix = prefix
        .replaceAll('\\', '\\\\')
        .replaceAll('*', '\\*')
        .replaceAll('?', '\\?')
        .replaceAll('[', '\\[')
        .replaceAll(']', '\\]');
      const match = `${this.cacheKey(escapedPrefix)}*`;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          match,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch {
      this.logger.warn('Cache prefix delete failed');
    }
  }

  /** Loads a value and caches it when available.
   * @param {string} key logical cache key
   * @param {number} ttlMs cache lifetime in milliseconds
   * @param {(value: unknown) => value is T} guard runtime value validator
   * @param {() => Promise<T>} loader source of the cache value
   * @returns {Promise<T>} cached or freshly loaded value
   * @throws {Error} if the source loader fails
   */
  async wrap<T>(
    key: string,
    ttlMs: number,
    guard: (value: unknown) => value is T,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get(key, guard);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttlMs);
    return value;
  }

  /** Builds the fully namespaced cache key.
   * @param {string} key logical cache key
   * @returns {string} namespaced Redis key
   */
  private cacheKey(key: string): string {
    return `${this.env.redisKeyPrefix}:cache:${key}`;
  }
}
