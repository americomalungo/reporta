import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

/** Ponto geográfico WGS84 recebido pela API. */
export class GeoPointDto {
  /** Latitude decimal entre -90 e 90. */
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  /** Longitude decimal entre -180 e 180. */
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}
