import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

/** Public liveness endpoints for the HTTP service. */
@Controller()
export class AppController {
  /** Returns the process liveness response.
   * @returns {string} short health status
   */
  @Get('health')
  @Public()
  @SkipThrottle()
  healthCheck(): string {
    return 'Reporta API is running...!';
  }
}
