import { Injectable } from '@nestjs/common';
import type { Document as PrismaDocument } from '../../../generated/prisma/client';
import { DocumentEntity } from '../../../domain/entities/document.entity';
import type {
  DocumentChanges,
  DocumentRepositoryPort,
  NewDocument,
} from '../../../domain/ports';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaDocumentRepository implements DocumentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveById(id: string): Promise<DocumentEntity | null> {
    const row = await this.prisma.document.findFirst({
      where: { id, isActive: true },
    });
    return row && toDomain(row);
  }

  async findAllActive(): Promise<DocumentEntity[]> {
    const rows = await this.prisma.document.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async create(data: NewDocument): Promise<DocumentEntity> {
    const row = await this.prisma.document.create({ data });
    return toDomain(row);
  }

  async update(
    id: string,
    changes: DocumentChanges,
  ): Promise<DocumentEntity | null> {
    // updateMany permite filtrar por isActive e não lança erro quando nada é encontrado
    const { count } = await this.prisma.document.updateMany({
      where: { id, isActive: true },
      data: changes,
    });
    return count === 0 ? null : this.findActiveById(id);
  }

  async deactivate(id: string): Promise<boolean> {
    const { count } = await this.prisma.document.updateMany({
      where: { id, isActive: true },
      data: { isActive: false },
    });
    return count > 0;
  }
}

function toDomain(row: PrismaDocument): DocumentEntity {
  return new DocumentEntity(
    row.id,
    row.title,
    row.description,
    row.content,
    row.isActive,
    row.createdAt,
  );
}
