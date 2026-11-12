import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Entrada de imagem recebida em memória pelo controller.
 */
export interface UploadedImageInput {
  /**
   * Conteúdo binário recebido.
   */
  buffer: Buffer;
  /**
   * Nome original enviado pelo cliente.
   */
  originalname: string;
  /**
   * Tamanho original em bytes.
   */
  size: number;
}

/**
 * Imagem validada e convertida para WebP sem metadados.
 */
export interface ProcessedImage {
  /**
   * Conteúdo WebP processado.
   */
  buffer: Buffer;
  /**
   * Largura final em píxeis.
   */
  width: number;
  /**
   * Altura final em píxeis.
   */
  height: number;
  /**
   * Tamanho final em bytes.
   */
  sizeBytes: number;
  /**
   * MIME fixo do resultado.
   */
  mimeType: 'image/webp';
}

/**
 * Valida e normaliza imagens enviadas para incidentes.
 */
@Injectable()
export class ImageProcessorService {
  /**
   * Valida o formato real e converte a imagem para WebP otimizado.
   * @param {UploadedImageInput} file ficheiro recebido em memória
   * @returns {Promise<ProcessedImage>} imagem validada, redimensionada e convertida
   * @throws {BadRequestException} se o conteúdo não for JPEG, PNG ou WebP válido
   */
  async process(file: UploadedImageInput): Promise<ProcessedImage> {
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 20_000_000,
        failOn: 'error',
      });
      const metadata = await image.metadata();
      if (
        !metadata.format ||
        !['jpeg', 'png', 'webp'].includes(metadata.format)
      ) {
        throw new BadRequestException('Ficheiro de imagem inválido');
      }

      const { data, info } = await sharp(file.buffer, {
        limitInputPixels: 20_000_000,
        failOn: 'error',
      })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        width: info.width,
        height: info.height,
        sizeBytes: data.byteLength,
        mimeType: 'image/webp',
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Ficheiro de imagem inválido');
    }
  }
}
