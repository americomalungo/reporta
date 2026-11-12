import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CursorPaginationQueryDto } from '@/src/common/dto/cursor-pagination-query.dto';

/**
 * DTO de query para a listagem do feed de incidentes.
 */
export class IncidentsQueryDto extends CursorPaginationQueryDto {
  /**
   * Identificador da categoria para filtrar os incidentes.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  /**
   * Texto livre para pesquisar no título ou na descrição do incidente.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  /**
   * Indica se o feed deve devolver apenas os incidentes do utilizador autenticado.
   */
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  mine?: boolean;

  /**
   * Latitude do ponto de referência para o filtro por proximidade.
   */
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;

  /**
   * Longitude do ponto de referência para o filtro por proximidade.
   */
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  @IsOptional()
  lng?: number;

  /**
   * Raio em metros para filtrar incidentes por proximidade.
   */
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  @IsOptional()
  radius?: number;
}
