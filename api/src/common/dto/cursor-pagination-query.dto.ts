import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Parâmetros comuns para percorrer resultados por cursor.
 */
export class CursorPaginationQueryDto {
  /**
   * Cursor opaco devolvido pela página anterior.
   */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  /**
   * Quantidade máxima de elementos por página, 20 por omissão.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}
