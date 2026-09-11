import { DomainError } from './domain.error';

export class CertificateAlreadyRequestedError extends DomainError {
  readonly code = 'CERTIFICATE_ALREADY_REQUESTED';

  constructor(options?: ErrorOptions) {
    super(
      'Já existe um pedido pendente ou um certificado válido para este curso',
      options,
    );
  }
}

export class CertificateRequestNotFoundError extends DomainError {
  readonly code = 'CERTIFICATE_REQUEST_NOT_FOUND';

  constructor() {
    super('Pedido de certificado não encontrado');
  }
}

export class CertificateRequestAlreadyReviewedError extends DomainError {
  readonly code = 'CERTIFICATE_REQUEST_ALREADY_REVIEWED';

  constructor() {
    super('Este pedido já foi analisado');
  }
}

export class InvalidCertificatePeriodError extends DomainError {
  readonly code = 'INVALID_CERTIFICATE_PERIOD';

  constructor(message: string) {
    super(message);
  }
}

export class CertificateIssuanceError extends DomainError {
  readonly code = 'CERTIFICATE_ISSUANCE_FAILED';

  constructor(options?: ErrorOptions) {
    super('Erro ao emitir o certificado', options);
  }
}

export class CertificateNotFoundError extends DomainError {
  readonly code = 'CERTIFICATE_NOT_FOUND';

  constructor() {
    super('Certificado não encontrado');
  }
}

export class CertificateAlreadyRevokedError extends DomainError {
  readonly code = 'CERTIFICATE_ALREADY_REVOKED';

  constructor() {
    super('Este certificado já foi revogado');
  }
}

export class InvalidVerificationCodeError extends DomainError {
  readonly code = 'INVALID_VERIFICATION_CODE';

  constructor() {
    super('Código de verificação inválido');
  }
}
