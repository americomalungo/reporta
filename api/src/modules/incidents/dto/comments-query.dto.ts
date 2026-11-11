import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO para paginação da listagem de comentários.
 */
export class CommentsQueryDto {
  /**
   * Número da página atual.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  /**
   * Quantidade máxima de comentários por página.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
