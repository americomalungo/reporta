import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from './geo-point.dto';

/** Dados validados para criar uma zona de interesse. */
export class CreateInterestZoneDto {
  /** Nome da zona, aparado e com 2 a 60 caracteres. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 60)
  name: string;

  /** Vértices do polígono, sem repetir o primeiro no fim. */
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GeoPointDto)
  points: GeoPointDto[];
}
