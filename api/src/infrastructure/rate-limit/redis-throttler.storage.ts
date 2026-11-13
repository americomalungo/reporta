import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/src/infrastructure/cache/cache.constants';
import { EnvService } from '@/src/infrastructure/env/env.service';

/** Storage response shape required by Nest throttler v6.7.1. */
interface ThrottlerStorageRecord {
  /** Total hits in the active window. */
  totalHits: number;
  /** Remaining window duration in milliseconds. */
  timeToExpire: number;
  /** Indicates whether the tracker is currently blocked. */
  isBlocked: boolean;
  /** Remaining block duration in milliseconds. */
  timeToBlockExpire: number;
}

/** Atomic Redis-backed storage for Nest throttler counters. */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  /** Logger for non-sensitive fail-open notices. */
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  /** Atomic counter and block window update implemented in Redis Lua. */
  private readonly script = `
    local blocked = redis.call('PTTL', KEYS[2])
    if blocked > 0 then
      local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
      return { hits, redis.call('PTTL', KEYS[1]), 1, blocked }
    end
    local hits = redis.call('INCR', KEYS[1])
    if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    local ttl = redis.call('PTTL', KEYS[1])
    local block = 0
    if hits > tonumber(ARGV[2]) then
      block = tonumber(ARGV[3])
      redis.call('SET', KEYS[2], '1', 'PX', block)
    end
    return { hits, ttl, block > 0 and 1 or 0, block }
  `;

  /** Creates the rate limit storage.
   * @param {Redis} redis shared Redis-compatible client
   * @param {EnvService} env configuration containing the throttle key prefix
   */
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly env: EnvService,
  ) {}

  /** Atomically increments a tracker and returns its current limit state.
   * @param {string} key tracker key supplied by Nest throttler
   * @param {number} ttl counter window in milliseconds
   * @param {number} limit maximum hits within the window
   * @param {number} blockDuration duration of a block in milliseconds
   * @param {string} throttlerName configured throttler name
   * @returns {Promise<ThrottlerStorageRecord>} current storage state, allowing requests when Redis fails
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `${this.env.redisKeyPrefix}:throttle:${throttlerName}:${key}`;
    try {
      const response: unknown = await this.redis.eval(
        this.script,
        2,
        counterKey,
        `${counterKey}:blocked`,
        Math.max(1, ttl),
        limit,
        Math.max(1, blockDuration),
      );
      if (!Array.isArray(response) || response.length !== 4) {
        throw new Error('Unexpected throttler response');
      }
      const [totalHits, timeToExpire, blocked, timeToBlockExpire] = response;
      if (
        typeof totalHits !== 'number' ||
        typeof timeToExpire !== 'number' ||
        typeof blocked !== 'number' ||
        typeof timeToBlockExpire !== 'number'
      ) {
        throw new Error('Unexpected throttler values');
      }
      return {
        totalHits,
        timeToExpire: Math.ceil(Math.max(0, timeToExpire) / 1000),
        isBlocked: blocked > 0,
        timeToBlockExpire: Math.ceil(Math.max(0, timeToBlockExpire) / 1000),
      };
    } catch {
      this.logger.warn('Rate limit storage failed; allowing request');
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
