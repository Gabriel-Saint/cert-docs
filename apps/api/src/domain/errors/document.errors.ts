import { DomainError } from './domain.error';

export class DocumentNotFoundError extends DomainError {
  readonly code = 'DOCUMENT_NOT_FOUND';

  constructor() {
    super('Documento não encontrado');
  }
}

export class PdfGenerationError extends DomainError {
  readonly code = 'PDF_GENERATION_FAILED';

  constructor(options?: ErrorOptions) {
    super('Erro ao gerar PDF', options);
  }
}

export class DownloadLogPersistenceError extends DomainError {
  readonly code = 'DOWNLOAD_LOG_FAILED';

  constructor(options?: ErrorOptions) {
    super('Erro ao registrar download', options);
  }
}
