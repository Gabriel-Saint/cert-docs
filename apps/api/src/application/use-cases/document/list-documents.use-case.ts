import type { DocumentEntity } from '../../../domain/entities/document.entity';
import type { DocumentRepositoryPort } from '../../../domain/ports';

export class ListDocumentsUseCase {
  constructor(private readonly documentRepo: DocumentRepositoryPort) {}

  execute(): Promise<DocumentEntity[]> {
    return this.documentRepo.findAllActive();
  }
}
