export interface CertificateStoragePort {
  save(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Não falha se o arquivo não existir. */
  delete(key: string): Promise<void>;
}
