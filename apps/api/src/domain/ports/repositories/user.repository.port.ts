import type { Role } from '@cert-docs/shared';
import type { UserEntity } from '../../entities/user.entity';
import type { Cpf } from '../../value-objects/cpf';

export interface NewUser {
  name: string;
  email: string;
  cpf: Cpf;
  passwordHash: string;
  role: Role;
}

export interface UserRepositoryPort {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByCpf(cpf: Cpf): Promise<UserEntity | null>;
  /** Lança EmailOrCpfAlreadyInUseError se violar a unicidade no banco. */
  create(data: NewUser): Promise<UserEntity>;
  findAll(): Promise<UserEntity[]>;
}
