export type DomainErrorCode =
  | 'INVALID_CPF'
  | 'EMAIL_OR_CPF_IN_USE'
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'PDF_GENERATION_FAILED'
  | 'DOWNLOAD_LOG_FAILED';

/**
 * Base de todos os erros de negócio.
 * O domínio não conhece HTTP: a tradução para status code acontece no DomainExceptionFilter.
 */
export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
