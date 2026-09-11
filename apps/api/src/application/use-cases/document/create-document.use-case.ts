import type { CreateDocumentRequest } from '@cpf-pdf/shared';
import type { DocumentEntity } from '../../../domain/entities/document.entity';
import type { DocumentRepositoryPort } from '../../../domain/ports';

export class CreateDocumentUseCase {
  constructor(private readonly documentRepo: DocumentRepositoryPort) {}

  execute(input: CreateDocumentRequest): Promise<DocumentEntity> {
    return this.documentRepo.create({
      title: input.title,
      description: input.description ?? null,
      content: input.content,
    });
  }
}
