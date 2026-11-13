import { Global, Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { CacheModule } from '../cache/cache.module';

/** Provides the shared Valkey-backed rate limit storage. */
@Global()
@Module({
  imports: [CacheModule],
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class RateLimitModule {}
