import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { IncidentStatus } from '@/src/common/enums/incidents.enums';
import {
  CommentRepository,
  CommentWithAuthor,
} from '@/src/infrastructure/repositories/comment.repository';
import { IncidentsRepository } from '@/src/infrastructure/repositories/incident.repository';
import { UserRole } from '@/src/common/enums/users.enums';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { decodeCursor, encodeCursor } from '@/src/common/utils/cursor';
import { CommentsQueryDto } from '../dto/comments-query.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { ReturnCommentDto } from '../dto/return-comment.dto';

/**
 * Dados validados de um cursor de comentários.
 */
interface CommentCursor {
  /**
   * Data ISO do último comentário devolvido.
   */
  t: string;
  /**
   * Identificador do último comentário devolvido.
   */
  id: string;
}

function isCommentCursor(value: unknown): value is CommentCursor {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !('t' in value) ||
    !('id' in value)
  ) {
    return false;
  }

  if (typeof value.t !== 'string' || typeof value.id !== 'string') {
    return false;
  }

  const timestamp = new Date(value.t);
  return (
    value.id.length > 0 &&
    Number.isFinite(timestamp.getTime()) &&
    timestamp.toISOString() === value.t
  );
}

/**
 * Serviço responsável pela gestão de comentários nos incidentes.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly incidentsRepository: IncidentsRepository,
  ) {}

  /**
   * Cria um comentário ou uma resposta num incidente.
   * @param {string} incidentId id do incidente
   * @param {User} user utilizador autenticado
   * @param {CreateCommentDto} dto dados do comentário
   * @returns {Promise<ReturnCommentDto>} comentário criado com a árvore vazia
   * @throws {NotFoundException} se o incidente não existir ou estiver removido
   * @throws {BadRequestException} se a resposta for feita a uma resposta
   */
  async create(
    incidentId: string,
    user: User,
    dto: CreateCommentDto,
  ): Promise<ReturnCommentDto> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });

    if (
      !incident ||
      incident.status === IncidentStatus.REMOVED ||
      incident.status === IncidentStatus.DELETED
    ) {
      throw new NotFoundException('Incidente não encontrado');
    }

    let parentId: string | undefined;
    if (dto.parentId) {
      const parentComment = await this.commentRepository.findById(dto.parentId);

      if (
        !parentComment ||
        parentComment.incidentId !== incidentId ||
        parentComment.isHidden
      ) {
        throw new NotFoundException('Comentário não encontrado');
      }

      if (parentComment.parentId !== null) {
        throw new BadRequestException(
          'Não é possível responder a uma resposta',
        );
      }

      parentId = parentComment.id;
    }

    const createdComment = await this.commentRepository.create({
      incidentId,
      userId: user.id,
      content: dto.content,
      parentId,
    });

    return this.toReturnCommentDto(createdComment, []);
  }

  /**
   * Lista comentários principais de um incidente com as respostas visíveis aninhadas.
   * @param {string} incidentId id do incidente
   * @param {CommentsQueryDto} query parâmetros de paginação
   * @returns {Promise<CursorPage<ReturnCommentDto>>} árvore de comentários paginada
   * @throws {NotFoundException} se o incidente não existir ou estiver removido
   */
  async findAll(
    incidentId: string,
    query: CommentsQueryDto,
  ): Promise<CursorPage<ReturnCommentDto>> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });
    if (
      !incident ||
      incident.status === IncidentStatus.REMOVED ||
      incident.status === IncidentStatus.DELETED
    ) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const limit = query.limit ?? 20;
    const cursor =
      query.cursor !== undefined
        ? decodeCursor(query.cursor, isCommentCursor)
        : undefined;

    const topLevelComments =
      await this.commentRepository.findTopLevelAfterCursor(
        incidentId,
        cursor ? { createdAt: new Date(cursor.t), id: cursor.id } : undefined,
        limit + 1,
      );

    const hasNextPage = topLevelComments.length > limit;
    const commentsPage = topLevelComments.slice(0, limit);

    const parentIds = commentsPage.map((comment) => comment.id);
    const replies =
      await this.commentRepository.findRepliesByParentIds(parentIds);
    const repliesByParent = new Map<string, CommentWithAuthor[]>();

    replies.forEach((reply) => {
      if (!reply.parentId) {
        return;
      }

      const currentReplies = repliesByParent.get(reply.parentId) ?? [];
      currentReplies.push(reply);
      repliesByParent.set(reply.parentId, currentReplies);
    });

    const data = commentsPage.map((comment) =>
      this.toReturnCommentDto(comment, repliesByParent.get(comment.id) ?? []),
    );

    const lastComment = commentsPage.at(-1);
    const nextCursor =
      hasNextPage && lastComment
        ? encodeCursor({
            t: lastComment.createdAt.toISOString(),
            id: lastComment.id,
          })
        : null;

    return { data, nextCursor, hasNextPage };
  }

  /**
   * Remove um comentário ou resposta por soft-delete.
   * @param {string} incidentId id do incidente
   * @param {string} commentId id do comentário
   * @param {User} user utilizador autenticado
   * @returns {{ message: string }} confirmação da remoção
   * @throws {NotFoundException} se o comentário não existir no incidente
   * @throws {ForbiddenException} se o utilizador não tiver permissão
   */
  async remove(
    incidentId: string,
    commentId: string,
    user: User,
  ): Promise<{ message: string }> {
    const incident = await this.incidentsRepository.findUnique({
      id: incidentId,
    });
    if (
      !incident ||
      incident.status === IncidentStatus.REMOVED ||
      incident.status === IncidentStatus.DELETED
    ) {
      throw new NotFoundException('Incidente não encontrado');
    }

    const comment = await this.commentRepository.findById(commentId);
    if (!comment || comment.incidentId !== incidentId || comment.isHidden) {
      throw new NotFoundException('Comentário não encontrado');
    }

    if (comment.userId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Não tem permissão para apagar este comentário',
      );
    }

    await this.commentRepository.hide(commentId, incidentId);

    return {
      message: 'Comentário removido com sucesso',
    };
  }

  /**
   * Converte um comentário com autor para o DTO público de resposta.
   * @param {CommentWithAuthor} comment comentário a converter
   * @param {CommentWithAuthor[]} replies respostas visíveis do comentário
   * @returns {ReturnCommentDto} DTO pronto para serialização
   */
  private toReturnCommentDto(
    comment: CommentWithAuthor,
    replies: CommentWithAuthor[],
  ): ReturnCommentDto {
    return {
      id: comment.id,
      incidentId: comment.incidentId,
      parentId: comment.parentId,
      content: comment.content,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        avatarUrl: comment.user.avatarUrl,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: replies.map((reply) => this.toReturnCommentDto(reply, [])),
    };
  }
}
