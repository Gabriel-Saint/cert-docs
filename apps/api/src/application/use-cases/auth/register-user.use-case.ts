import { Role, type RegisterRequest } from '@cert-docs/shared';
import type { UserEntity } from '../../../domain/entities/user.entity';
import { EmailOrCpfAlreadyInUseError } from '../../../domain/errors';
import type { HashPort, UserRepositoryPort } from '../../../domain/ports';
import { Cpf } from '../../../domain/value-objects/cpf';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly hash: HashPort,
  ) {}

  async execute(input: RegisterRequest): Promise<UserEntity> {
    const cpf = Cpf.create(input.cpf);

    const [byEmail, byCpf] = await Promise.all([
      this.userRepo.findByEmail(input.email),
      this.userRepo.findByCpf(cpf),
    ]);
    if (byEmail || byCpf) throw new EmailOrCpfAlreadyInUseError();

    // Se duas requisições passarem juntas pela checagem acima, o repositório
    // converte a violação de unicidade do banco em EmailOrCpfAlreadyInUseError.
    return this.userRepo.create({
      name: input.name,
      email: input.email,
      cpf,
      passwordHash: await this.hash.hash(input.password),
      role: Role.USER,
    });
  }
}
