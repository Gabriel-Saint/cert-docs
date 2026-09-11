import type { LoginRequest, LoginResponse } from '@cert-docs/shared';
import { InvalidCredentialsError } from '../../../domain/errors';
import type {
  HashPort,
  TokenPort,
  UserRepositoryPort,
} from '../../../domain/ports';

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly hash: HashPort,
    private readonly token: TokenPort,
  ) {}

  async execute(input: LoginRequest): Promise<LoginResponse> {
    const user = await this.userRepo.findByEmail(input.email);
    const passwordMatches =
      user !== null &&
      (await this.hash.compare(input.password, user.passwordHash));

    // Mesma mensagem para email inexistente e senha errada: não revela qual dos dois falhou.
    if (!user || !passwordMatches) throw new InvalidCredentialsError();

    const accessToken = await this.token.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken };
  }
}
