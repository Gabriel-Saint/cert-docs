export class DownloadLogEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly documentId: string,
    public readonly ipAddress: string | null,
    public readonly createdAt: Date,
  ) {}
}
