import { Injectable } from '@nestjs/common';
import type {
  DownloadLogRepositoryPort,
  NewDownloadLog,
} from '../../../domain/ports';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaDownloadLogRepository implements DownloadLogRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save({ userId, documentId, ipAddress }: NewDownloadLog): Promise<void> {
    // createdAt é gerado pelo banco (timestamp do servidor)
    await this.prisma.downloadLog.create({
      data: { userId, documentId, ipAddress: ipAddress ?? null },
    });
  }
}
