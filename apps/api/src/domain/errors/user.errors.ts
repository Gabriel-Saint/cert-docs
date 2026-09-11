import { DomainError } from './domain.error';

export class InvalidCpfError extends DomainError {
  readonly code = 'INVALID_CPF';

  constructor() {
    super('CPF inválido');
  }
}

export class EmailOrCpfAlreadyInUseError extends DomainError {
  readonly code = 'EMAIL_OR_CPF_IN_USE';

  constructor(options?: ErrorOptions) {
    super('Email ou CPF já cadastrado', options);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Credenciais inválidas');
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('Usuário não encontrado');
  }
}
