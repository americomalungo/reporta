import {
  BadRequestException,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  HttpCode,
  HttpStatus,
  HttpException,
  Injectable,
  NestInterceptor,
  Param,
  PayloadTooLargeException,
  Post,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { catchError, Observable, throwError } from 'rxjs';
import { CurrentDbUser } from '@/src/common/decorators/current-user.decorator';
import type { User } from '@/src/common/types/entities.types';
import { ReturnMediaDto } from '../dto/return-media.dto';
import { IncidentMediaService } from '../services/incident-media.service';
import type { UploadedImageInput } from '../services/image-processor.service';

/**
 * Traduz as exceções HTTP que o Nest cria a partir dos erros do Multer.
 */
@Injectable()
export class MulterUploadErrorInterceptor implements NestInterceptor {
  /**
   * Traduz limites de tamanho e quantidade dos ficheiros multipart.
   * @param {ExecutionContext} _context contexto da execução HTTP
   * @param {CallHandler} next próximo interceptor ou handler
   * @returns {Observable<unknown>} resposta observável com erros de upload traduzidos
   */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof PayloadTooLargeException) {
          return throwError(
            () =>
              new PayloadTooLargeException(
                'Cada imagem deve ter no máximo 5 MB',
              ),
          );
        }
        if (error instanceof BadRequestException) {
          const message = this.getExceptionMessage(error);
          if (
            message.includes('Unexpected file field') ||
            message.includes('Unexpected field') ||
            message.includes('Too many files')
          ) {
            return throwError(
              () =>
                new BadRequestException(
                  'Envie no máximo 3 ficheiros no campo files',
                ),
            );
          }
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Extrai uma mensagem de resposta sem assumir o formato da exceção Nest.
   * @param {HttpException} error exceção HTTP a inspecionar
   * @returns {string} mensagem encontrada ou texto vazio
   */
  private getExceptionMessage(error: HttpException): string {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const message = response.message;
      if (typeof message === 'string') return message;
      if (
        Array.isArray(message) &&
        message.every((item): item is string => typeof item === 'string')
      ) {
        return message.join(' ');
      }
    }
    return '';
  }
}

/**
 * Expõe as operações de upload e remoção das fotos de incidentes.
 */
@ApiTags('Incidentes')
@Controller('incidents/:incidentId/media')
export class IncidentMediaController {
  /**
   * Injeta o serviço de gestão das fotos.
   * @param {IncidentMediaService} incidentMediaService gestão das imagens
   */
  constructor(private readonly incidentMediaService: IncidentMediaService) {}

  /**
   * Envia entre uma e três imagens para um incidente.
   * Método HTTP: POST /incidents/:incidentId/media.
   * @param {string} incidentId identificador do incidente
   * @param {Express.Multer.File[]} files ficheiros recebidos em memória
   * @param {User} user utilizador autenticado carregado da base de dados
   * @returns {Promise<ReturnMediaDto[]>} imagens guardadas com os respetivos metadados públicos
   * @throws {PayloadTooLargeException} se algum ficheiro exceder 5 MB
   * @throws {BadRequestException} se o pedido exceder três ficheiros ou contiver uma imagem inválida
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(
    MulterUploadErrorInterceptor,
    FilesInterceptor('files', 3, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('incidentId') incidentId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentDbUser() user: User,
  ): Promise<ReturnMediaDto[]> {
    const inputs: UploadedImageInput[] = (files ?? []).map((file) => ({
      buffer: file.buffer,
      originalname: file.originalname,
      size: file.size,
    }));
    return this.incidentMediaService.upload(user, incidentId, inputs);
  }

  /**
   * Remove uma foto do incidente.
   * Método HTTP: DELETE /incidents/:incidentId/media/:mediaId.
   * @param {string} incidentId identificador do incidente
   * @param {string} mediaId identificador da imagem
   * @param {User} user utilizador autenticado carregado da base de dados
   * @returns {Promise<{ message: string }>} confirmação da remoção
   * @throws {NotFoundException} se o incidente ou a imagem não existir ou não estiver acessível
   */
  @Delete(':mediaId')
  remove(
    @Param('incidentId') incidentId: string,
    @Param('mediaId') mediaId: string,
    @CurrentDbUser() user: User,
  ): Promise<{ message: string }> {
    return this.incidentMediaService.remove(user, incidentId, mediaId);
  }
}
