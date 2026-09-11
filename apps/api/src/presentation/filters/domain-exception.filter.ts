import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainError, type DomainErrorCode } from '../../domain/errors';

const STATUS_BY_CODE: Record<DomainErrorCode, HttpStatus> = {
  INVALID_CPF: HttpStatus.BAD_REQUEST,
  EMAIL_OR_CPF_IN_USE: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  DOCUMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PDF_GENERATION_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  DOWNLOAD_LOG_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Traduz erros de domínio em respostas HTTP. A causa técnica vai só para o log. */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS_BY_CODE[error.code];

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(error.message, error.cause);
    }

    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode: status, code: error.code, message: error.message },
      status,
    );
  }
}
