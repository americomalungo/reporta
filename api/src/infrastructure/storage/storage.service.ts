import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type ObjectIdentifier,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  STORAGE_SIGNED_URL_TTL_SECONDS,
  STORAGE_SIGNED_URL_WINDOW_HOURS,
} from '@/src/common/constants/storage.constants';
import { EnvService } from '../env/env.service';
import type {
  StorageListObjectsOptions,
  StorageListObjectsResult,
} from '@/src/common/types/storage.types';

/** Gere objetos e URLs assinados através de uma API compatível com S3. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  /** Cria um cliente compatível com o endpoint de armazenamento configurado.
   * @param {EnvService} env serviço com credenciais e endpoint
   */
  constructor(private readonly env: EnvService) {
    const { endpoint, region, accessKeyId, secretAccessKey } = env.storage;
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Mantém compatibilidade com endpoints S3 não-AWS que não implementam checksums opcionais.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /** Envia um objeto privado com chave única.
   * @param {string} key chave do objeto no bucket
   * @param {Buffer} data conteúdo binário
   * @param {string} contentType tipo MIME do conteúdo
   * @returns {Promise<void>} conclusão do envio
   * @throws {ServiceUnavailableException} se o armazenamento não aceitar o envio
   */
  async upload(key: string, data: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.getBucketName(),
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: 'private, max-age=31536000, immutable',
        }),
      );
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao enviar objeto para o armazenamento',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Falha ao guardar o ficheiro no armazenamento',
      );
    }
  }

  /** Gera um URL de leitura com assinatura estável durante a janela atual de seis horas.
   * @param {string} key chave do objeto
   * @returns {Promise<string>} URL assinado válido por doze horas desde a assinatura
   * @throws {ServiceUnavailableException} se não for possível assinar o URL
   */
  async getSignedReadUrl(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.getBucketName(), Key: key }),
        {
          expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
          signingDate: this.getSigningDate(),
        },
      );
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao assinar URL de leitura no armazenamento',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Falha ao preparar a leitura da imagem',
      );
    }
  }

  /** Assina localmente várias chaves para uma página de resultados.
   * @param {string[]} keys chaves dos objetos a assinar
   * @returns {Promise<Map<string, string>>} associação de chave a URL assinado
   */
  async getSignedReadUrls(keys: string[]): Promise<Map<string, string>> {
    const uniqueKeys = [...new Set(keys)];
    const entries = await Promise.all(
      uniqueKeys.map(async (key) => ({
        key,
        url: await this.getSignedReadUrl(key),
      })),
    );
    return new Map(entries.map((entry) => [entry.key, entry.url]));
  }

  /** Remove objetos em lotes de até 1000, ignorando chaves ausentes.
   * @param {string[]} keys chaves a remover
   * @returns {Promise<void>} conclusão da remoção
   * @throws {ServiceUnavailableException} se o armazenamento rejeitar a remoção
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
        if (result.Errors?.length)
          throw new ServiceUnavailableException(
            'Falha ao remover ficheiros do armazenamento',
          );
      } catch (error: unknown) {
        this.logger.error(
          'Falha ao remover objetos do armazenamento',
          error instanceof Error ? error.stack : String(error),
        );
        throw new ServiceUnavailableException(
          'Falha ao remover ficheiros do armazenamento',
        );
      }
    }
  }

  /** Lista uma página de objetos com o prefixo indicado.
   * @param {string} prefix prefixo das chaves
   * @param {StorageListObjectsOptions} options token e limite da página
   * @returns {Promise<StorageListObjectsResult>} objetos e token da página seguinte
   * @throws {ServiceUnavailableException} se o armazenamento não responder
   */
  async listObjects(
    prefix: string,
    options: StorageListObjectsOptions = {},
  ): Promise<StorageListObjectsResult> {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.getBucketName(),
          Prefix: prefix,
          ContinuationToken: options.continuationToken,
          MaxKeys: Math.min(Math.max(options.maxKeys ?? 1000, 1), 1000),
        }),
      );
      return {
        objects: (response.Contents ?? []).flatMap((object) =>
          object.Key && object.LastModified
            ? [{ key: object.Key, lastModified: object.LastModified }]
            : [],
        ),
        nextToken: response.NextContinuationToken ?? null,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Falha ao listar objetos no armazenamento',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Falha ao listar objetos no armazenamento',
      );
    }
  }

  /** Devolve o nome do bucket configurado.
   * @returns {string} nome do bucket
   */
  getBucketName(): string {
    return this.env.storage.bucket;
  }

  /** Constrói a referência interna persistida na base de dados; não é URL público.
   * @param {string} key chave do objeto
   * @returns {string} referência interna que não deve ser devolvida ao cliente
   */
  getInternalReference(key: string): string {
    return `${this.env.storage.endpoint.replace(/\/$/, '')}/${this.getBucketName()}/${key}`;
  }

  /** Calcula o início da janela atual de assinatura.
   * @returns {Date} início da janela UTC de seis horas
   */
  private getSigningDate(): Date {
    const windowMs = STORAGE_SIGNED_URL_WINDOW_HOURS * 60 * 60 * 1000;
    return new Date(Math.floor(Date.now() / windowMs) * windowMs);
  }
}
