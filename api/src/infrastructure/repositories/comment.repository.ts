import { Injectable, NotFoundException } from '@nestjs/common';
import { Comment } from '@/generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tipo auxiliar com o autor do comentário já incluído.
 */
export type CommentWithAuthor = Comment & {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
};

/**
 * Repositório responsável pela persistência dos comentários dos incidentes.
 */
@Injectable()
export class CommentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Busca um comentário pelo id.
   * @param {string} commentId id do comentário
   * @returns {Promise<Comment | null>} comentário encontrado ou null
   */
  async findById(commentId: string): Promise<Comment | null> {
    return this.prismaService.comment.findUnique({
      where: { id: commentId },
    });
  }

  /**
   * Cria um comentário ou resposta e incrementa o contador do incidente.
   * @param {{ incidentId: string; userId: string; content: string; parentId?: string }} data dados do comentário
   * @returns {Promise<CommentWithAuthor>} comentário criado com o autor incluído
   */
  async create(data: {
    incidentId: string;
    userId: string;
    content: string;
    parentId?: string;
  }): Promise<CommentWithAuthor> {
    return this.prismaService.$transaction(async (transaction) => {
      const comment = await transaction.comment.create({
        data: {
          incidentId: data.incidentId,
          userId: data.userId,
          content: data.content,
          parentId: data.parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      await transaction.incident.update({
        where: { id: data.incidentId },
        data: {
          commentCount: { increment: 1 },
        },
      });

      return comment as CommentWithAuthor;
    });
  }

  /**
   * Busca os comentários de nível 1 visíveis de um incidente paginados.
   * @param {string} incidentId id do incidente
   * @param {number} skip quantidade a ignorar antes da página
   * @param {number} take quantidade máxima de comentários
   * @returns {Promise<CommentWithAuthor[]>} comentários principais visíveis
   */
  async findTopLevelPage(
    incidentId: string,
    skip: number,
    take: number,
  ): Promise<CommentWithAuthor[]> {
    return this.prismaService.comment.findMany({
      where: {
        incidentId,
        parentId: null,
        isHidden: false,
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }) as Promise<CommentWithAuthor[]>;
  }

  /**
   * Busca todas as respostas visíveis de um conjunto de comentários pais.
   * @param {string[]} parentIds ids dos comentários pais
   * @returns {Promise<CommentWithAuthor[]>} respostas visíveis ordenadas por data de criação
   */
  async findRepliesByParentIds(
    parentIds: string[],
  ): Promise<CommentWithAuthor[]> {
    if (parentIds.length === 0) {
      return [];
    }

    return this.prismaService.comment.findMany({
      where: {
        parentId: { in: parentIds },
        isHidden: false,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }) as Promise<CommentWithAuthor[]>;
  }

  /**
   * Oculta um comentário e, se for um comentário principal, também oculta as respostas visíveis.
   * @param {string} commentId id do comentário
   * @param {string} incidentId id do incidente
   * @returns {Promise<void>} conclusão da operação
   * @throws {NotFoundException} se o comentário não existir no incidente ou já estiver oculto
   */
  async hide(commentId: string, incidentId: string): Promise<void> {
    await this.prismaService.$transaction(async (transaction) => {
      const comment = await transaction.comment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          incidentId: true,
          parentId: true,
        },
      });

      if (!comment || comment.incidentId !== incidentId) {
        throw new NotFoundException('Comentário não encontrado');
      }

      const hiddenComment = await transaction.comment.updateMany({
        where: {
          id: commentId,
          incidentId,
          isHidden: false,
        },
        data: { isHidden: true },
      });

      if (hiddenComment.count === 0) {
        throw new NotFoundException('Comentário não encontrado');
      }

      let repliesCount = 0;
      if (comment.parentId === null) {
        const hiddenReplies = await transaction.comment.updateMany({
          where: {
            incidentId,
            parentId: commentId,
            isHidden: false,
          },
          data: { isHidden: true },
        });

        repliesCount = hiddenReplies.count;
      }

      await transaction.incident.update({
        where: { id: incidentId },
        data: {
          commentCount: {
            decrement: 1 + repliesCount,
          },
        },
      });
    });
  }
}
