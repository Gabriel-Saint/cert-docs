import { DocumentNotFoundError } from '../../../domain/errors';
import type { DocumentRepositoryPort } from '../../../domain/ports';

/** Soft delete: o documento some da listagem, mas os logs de download continuam apontando para ele. */
export class DeleteDocumentUseCase {
  constructor(private readonly documentRepo: DocumentRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const deactivated = await this.documentRepo.deactivate(id);
    if (!deactivated) throw new DocumentNotFoundError();
  }
}
