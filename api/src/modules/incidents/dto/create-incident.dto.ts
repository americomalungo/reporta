import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}
