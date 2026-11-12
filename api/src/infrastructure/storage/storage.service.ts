import {
  DeleteObjectsCommand,
  S3Client,
  type ObjectIdentifier,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnvService } from '../env/env.service';

/**
 * Gere o envio e a remoção de objetos no bucket Cloudflare R2.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  /**
   * Cria uma instância do cliente S3 configurada para Cloudflare R2.
   * @param {EnvService} env serviço com as credenciais e a configuração do bucket
   */
  constructor(private readonly env: EnvService) {
    const { accountId, accessKeyId, secretAccessKey } = env.r2;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // Evita checksums opcionais que o endpoint compatível do R2 pode não suportar.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Envia um objeto e devolve o respetivo URL público.
   * @param {string} key chave única do objeto no bucket
   * @param {Buffer} data conteúdo binário do objeto
   * @param {string} contentType tipo MIME do objeto
   * @returns {Promise<string>} URL pública do objeto enviado
   * @throws {ServiceUnavailableException} se o R2 não aceitar o envio
   */
  async upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<string> {
    const { publicUrl } = this.env.r2;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.getBucketName(),
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    } catch (error: unknown) {
      this.logger.error('Falha ao enviar objeto para o armazenamento', error);
      throw new ServiceUnavailableException(
        'Falha ao guardar o ficheiro no armazenamento',
      );
    }
  }

  /**
   * Remove as chaves indicadas em lotes de até 1000, ignorando chaves ausentes.
   * @param {string[]} keys chaves dos objetos a remover
   * @returns {Promise<void>} conclusão da remoção
   * @throws {ServiceUnavailableException} se o R2 não conseguir remover algum objeto
   */
  async remove(keys: string[]): Promise<void> {
    for (let index = 0; index < keys.length; index += 1000) {
      const objects: ObjectIdentifier[] = keys
        .slice(index, index + 1000)
        .map((Key) => ({ Key }));
      try {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.getBucketName(),
            Delete: { Objects: objects, Quiet: true },
          }),
        );
        if (result.Errors?.length) {
          this.logger.error('Falha ao remover objetos do armazenamento');
          throw new ServiceUnavailableException(
            'Falha ao remover ficheiros do armazenamento',
          );
        }
      } catch (error: unknown) {
        if (error instanceof ServiceUnavailableException) throw error;
        this.logger.error('Falha ao remover objetos do armazenamento', error);
        throw new ServiceUnavailableException(
          'Falha ao remover ficheiros do armazenamento',
        );
      }
    }
  }

  /**
   * Devolve o nome do bucket R2 configurado.
   * @returns {string} nome do bucket
   */
  getBucketName(): string {
    return this.env.r2.bucket;
  }
}
