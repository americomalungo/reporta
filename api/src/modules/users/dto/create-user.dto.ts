import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ValidateIf((user: CreateUserDto) => user.lastLongitude !== undefined)
  @IsLatitude()
  lastLatitude?: number;

  @ValidateIf((user: CreateUserDto) => user.lastLatitude !== undefined)
  @IsLongitude()
  lastLongitude?: number;

  @IsBoolean()
  @IsOptional()
  alertsEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  alertRadiusM?: number;
}
