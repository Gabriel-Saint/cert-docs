import type { DocumentEntity } from '../../entities/document.entity';

export interface NewDocument {
  title: string;
  description: string | null;
  content: string;
}

export type DocumentChanges = Partial<NewDocument>;

export interface DocumentRepositoryPort {
  findActiveById(id: string): Promise<DocumentEntity | null>;
  findAllActive(): Promise<DocumentEntity[]>;
  create(data: NewDocument): Promise<DocumentEntity>;
  /** Retorna null se não existir documento ativo com esse id. */
  update(id: string, changes: DocumentChanges): Promise<DocumentEntity | null>;
  /** Soft delete. Retorna false se não existir documento ativo com esse id. */
  deactivate(id: string): Promise<boolean>;
}
