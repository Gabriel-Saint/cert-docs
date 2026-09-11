import { Role } from '@cert-docs/shared';
import { InvalidCredentialsError } from '../../../domain/errors';
import {
  FakeHash,
  FakeToken,
  InMemoryUserRepository,
  makeUser,
} from '../../../testing/in-memory';
import { AuthenticateUserUseCase } from './authenticate-user.use-case';

describe('AuthenticateUserUseCase', () => {
  const makeSut = () => {
    const users = new InMemoryUserRepository();
    users.users.push(makeUser({ id: 'u1', role: Role.ADMIN }));
    return new AuthenticateUserUseCase(users, new FakeHash(), new FakeToken());
  };

  it('retorna token com sub e role do usuário', async () => {
    const result = await makeSut().execute({
      email: 'joao@example.com',
      password: 'senha12345',
    });

    expect(result).toEqual({ accessToken: 'token:u1:ADMIN' });
  });

  it.each([
    ['email inexistente', { email: 'nao@existe.com', password: 'senha12345' }],
    ['senha errada', { email: 'joao@example.com', password: 'errada' }],
  ])('lança o mesmo erro para %s', async (_, input) => {
    await expect(makeSut().execute(input)).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});
