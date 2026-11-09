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

  @IsLatitude()
  @IsOptional()
  lastLatitude?: number;

  @IsLongitude()
  @IsOptional()
  lastLongitude?: number;

  @IsBoolean()
  @IsOptional()
  alertsEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  alertRadiusM?: number;
}
