import { Module } from '@nestjs/common';
import { UserRepository } from '@/src/infrastructure/repositories/user.repository';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PushTokenRepository } from '@/src/infrastructure/repositories/push-token.repository';
import { UserDeviceController } from './user-device.controller';
import { UserDeviceService } from './user-device.service';
import { InterestZonesController } from './interest-zones.controller';
import { InterestZonesService } from './interest-zones.service';
import { InterestZoneRepository } from '@/src/infrastructure/repositories/interest-zone.repository';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, UserDeviceController, InterestZonesController],
  providers: [
    UsersService,
    UserDeviceService,
    InterestZonesService,
    InterestZoneRepository,
    UserRepository,
    PushTokenRepository,
  ],
  exports: [UserRepository],
})
export class UsersModule {}
