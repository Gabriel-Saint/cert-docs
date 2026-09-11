import type { DocumentDetail, DocumentSummary } from '@cert-docs/shared';
import type { DocumentEntity } from '../../domain/entities/document.entity';

export function toDocumentSummary(document: DocumentEntity): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
  };
}

export function toDocumentDetail(document: DocumentEntity): DocumentDetail {
  return {
    ...toDocumentSummary(document),
    content: document.content,
    createdAt: document.createdAt.toISOString(),
  };
}
