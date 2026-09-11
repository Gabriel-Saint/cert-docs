import type { UpdateDocumentRequest } from '@cert-docs/shared';
import type { DocumentEntity } from '../../../domain/entities/document.entity';
import { DocumentNotFoundError } from '../../../domain/errors';
import type { DocumentRepositoryPort } from '../../../domain/ports';

export class UpdateDocumentUseCase {
  constructor(private readonly documentRepo: DocumentRepositoryPort) {}

  async execute(
    id: string,
    changes: UpdateDocumentRequest,
  ): Promise<DocumentEntity> {
    const updated = await this.documentRepo.update(id, changes);
    if (!updated) throw new DocumentNotFoundError();
    return updated;
  }
}
