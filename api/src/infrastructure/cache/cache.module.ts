import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_CACHE_COMMAND_TIMEOUT_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_MAX_RETRY_DELAY_MS,
} from '@/src/common/constants/queues.constants';
import { EnvService } from '@/src/infrastructure/env/env.service';
import { registerRedisConnectionLogging } from '@/src/infrastructure/redis/redis-connection-logging';
import { REDIS_CLIENT } from './cache.constants';
import { CacheService } from './cache.service';

/** Provides the shared Redis-compatible client used by cache and rate limits. */
@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: REDIS_CLIENT,
      inject: [EnvService],
      useFactory: (env: EnvService): Redis => {
        const logger = new Logger('RedisClient');
        const client = new Redis(env.redisUrl, {
          commandTimeout: REDIS_CACHE_COMMAND_TIMEOUT_MS,
          connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (attempt: number): number =>
            Math.min(attempt * 100, REDIS_MAX_RETRY_DELAY_MS),
        });
        registerRedisConnectionLogging(
          client,
          logger,
          'Redis cache/rate-limit',
        );
        return client;
      },
    },
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
