/** Opções para percorrer uma página de objetos do armazenamento. */
export interface StorageListObjectsOptions {
  /** Token de continuação recebido na página anterior. */
  continuationToken?: string;
  /** Máximo de objetos, entre 1 e 1000. */
  maxKeys?: number;
}

/** Resultado de uma página de objetos do armazenamento. */
export interface StorageListObjectsResult {
  /** Chaves e datas de alteração encontradas. */
  objects: { key: string; lastModified: Date }[];
  /** Token da página seguinte ou null quando terminou. */
  nextToken: string | null;
}
