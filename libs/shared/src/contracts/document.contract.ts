export interface DocumentSummary {
  id: string;
  title: string;
  description: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  createdAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  description?: string;
  content: string;
}

export type UpdateDocumentRequest = Partial<CreateDocumentRequest>;
