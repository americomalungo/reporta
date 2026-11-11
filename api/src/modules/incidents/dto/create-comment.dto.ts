import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO de criação de um comentário ou resposta num incidente.
 */
export class CreateCommentDto {
  /**
   * Conteúdo do comentário, com trim e limite máximo de 1000 caracteres.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  /**
   * Id do comentário pai quando a mensagem for uma resposta.
   */
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  parentId?: string;
}
