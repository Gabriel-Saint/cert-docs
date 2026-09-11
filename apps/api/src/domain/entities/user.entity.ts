import type { Role } from '@cert-docs/shared';
import type { Cpf } from '../value-objects/cpf';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly cpf: Cpf,
    public readonly passwordHash: string,
    public readonly role: Role,
    public readonly createdAt: Date,
  ) {}
}
