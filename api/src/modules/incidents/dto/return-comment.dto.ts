import type { PublicUserDto } from '@/src/modules/users/dto/public-user.dto';

/**
 * DTO de resposta de um comentário ou resposta.
 */
export class ReturnCommentDto {
  /**
   * Id do comentário.
   */
  id: string;

  /**
   * Id do incidente a que o comentário pertence.
   */
  incidentId: string;

  /**
   * Id do comentário pai, ou null quando é um comentário principal.
   */
  parentId: string | null;

  /**
   * Conteúdo do comentário.
   */
  content: string;

  /**
   * Dados públicos do autor do comentário.
   */
  author: PublicUserDto;

  /**
   * Data de criação do comentário.
   */
  createdAt: Date;

  /**
   * Data da última atualização do comentário.
   */
  updatedAt: Date;

  /**
   * Respostas visíveis do comentário.
   */
  replies: ReturnCommentDto[];
}
