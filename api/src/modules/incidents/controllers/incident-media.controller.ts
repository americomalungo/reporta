import {
  BadRequestException,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  HttpCode,
  HttpStatus,
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

/** Converte erros do Multer em respostas HTTP com mensagens em português. */
@Injectable()
export class MulterUploadErrorInterceptor implements NestInterceptor {
  /** Traduz limites de tamanho e quantidade dos ficheiros multipart. */
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (error instanceof Error && 'code' in error) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            return throwError(
              () =>
                new PayloadTooLargeException(
                  'Cada imagem deve ter no máximo 5 MB',
                ),
            );
          }
          if (error.code === 'LIMIT_UNEXPECTED_FILE') {
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
}

/** Expõe as operações de upload e remoção das fotos de incidentes. */
@ApiTags('Incidentes')
@Controller('incidents/:incidentId/media')
export class IncidentMediaController {
  /** Injeta o serviço de gestão das fotos. */
  constructor(private readonly incidentMediaService: IncidentMediaService) {}

  /** Envia entre uma e três imagens para um incidente. Método HTTP: POST /incidents/:incidentId/media. */
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

  /** Remove uma foto do incidente. Método HTTP: DELETE /incidents/:incidentId/media/:mediaId. */
  @Delete(':mediaId')
  remove(
    @Param('incidentId') incidentId: string,
    @Param('mediaId') mediaId: string,
    @CurrentDbUser() user: User,
  ): Promise<{ message: string }> {
    return this.incidentMediaService.remove(user, incidentId, mediaId);
  }
}
