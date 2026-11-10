import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsRgbColor,
  IsString,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsRgbColor()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsNotEmpty()
  isRisk: boolean;
}
