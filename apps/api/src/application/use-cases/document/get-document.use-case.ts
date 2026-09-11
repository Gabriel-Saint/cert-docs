import type { DocumentEntity } from '../../../domain/entities/document.entity';
import { DocumentNotFoundError } from '../../../domain/errors';
import type { DocumentRepositoryPort } from '../../../domain/ports';

export class GetDocumentUseCase {
  constructor(private readonly documentRepo: DocumentRepositoryPort) {}

  async execute(id: string): Promise<DocumentEntity> {
    const document = await this.documentRepo.findActiveById(id);
    if (!document) throw new DocumentNotFoundError();
    return document;
  }
}
