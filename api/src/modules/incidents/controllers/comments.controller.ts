import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { User } from '@/src/common/types/entities.types';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import type { CursorPage } from '@/src/common/types/pagination.types';
import { CommentsQueryDto } from '../dto/comments-query.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { ReturnCommentDto } from '../dto/return-comment.dto';
import { CommentsService } from '../services/comments.service';

/**
 * Controller responsável pela gestão de comentários dos incidentes.
 */
@Controller('incidents/:incidentId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Cria um comentário ou resposta num incidente.
   * @param {string} incidentId id do incidente
   * @param {CreateCommentDto} dto conteúdo e comentário pai opcional
   * @param {User} user utilizador autenticado
   * @returns {Promise<ReturnCommentDto>} comentário criado
   */
  @Post()
  create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateCommentDto,
    @CurrentDbUser() user: User,
  ): Promise<ReturnCommentDto> {
    return this.commentsService.create(incidentId, user, dto);
  }

  /**
   * Lista os comentários visíveis do incidente.
   * @param {string} incidentId id do incidente
   * @param {CommentsQueryDto} query paginação da listagem
   * @returns {Promise<CursorPage<ReturnCommentDto>>} comentários paginados
   */
  @Get()
  findAll(
    @Param('incidentId') incidentId: string,
    @Query() query: CommentsQueryDto,
  ): Promise<CursorPage<ReturnCommentDto>> {
    return this.commentsService.findAll(incidentId, query);
  }

  /**
   * Remove um comentário ou resposta.
   * @param {string} incidentId id do incidente
   * @param {string} commentId id do comentário
   * @param {User} user utilizador autenticado
   * @returns {{ message: string }} confirmação da remoção
   */
  @Delete(':commentId')
  remove(
    @Param('incidentId') incidentId: string,
    @Param('commentId') commentId: string,
    @CurrentDbUser() user: User,
  ): Promise<{ message: string }> {
    return this.commentsService.remove(incidentId, commentId, user);
  }
}
