import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

/**
 * Disponibiliza globalmente o serviço de armazenamento Cloudflare R2.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
