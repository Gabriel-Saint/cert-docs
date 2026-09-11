export interface NewDownloadLog {
  userId: string;
  documentId: string;
  ipAddress?: string | null;
}

export interface DownloadLogRepositoryPort {
  save(data: NewDownloadLog): Promise<void>;
}
