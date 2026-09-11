import { Role } from '@cert-docs/shared';
import fc from 'fast-check';
import {
  EmailOrCpfAlreadyInUseError,
  InvalidCpfError,
} from '../../../domain/errors';
import { FakeHash, InMemoryUserRepository } from '../../../testing/in-memory';
import { RegisterUserUseCase } from './register-user.use-case';

const VALID_INPUT = {
  name: 'João Silva',
  email: 'joao@example.com',
  cpf: '529.982.247-25',
  password: 'senha12345',
};

describe('RegisterUserUseCase', () => {
  const makeSut = () => {
    const users = new InMemoryUserRepository();
    return { users, sut: new RegisterUserUseCase(users, new FakeHash()) };
  };

  it('cria usuário com role USER, CPF normalizado e senha em hash', async () => {
    const { sut } = makeSut();

    const user = await sut.execute(VALID_INPUT);

    expect(user.role).toBe(Role.USER);
    expect(user.cpf.toString()).toBe('52998224725');
    expect(user.passwordHash).not.toBe(VALID_INPUT.password);
  });

  it('rejeita CPF inválido sem gravar nada', async () => {
    const { sut, users } = makeSut();

    await expect(
      sut.execute({ ...VALID_INPUT, cpf: '52998224724' }),
    ).rejects.toThrow(InvalidCpfError);
    expect(users.users).toHaveLength(0);
  });

  // Property 5: Unicidade de email e CPF no cadastro
  it('rejeita qualquer segundo cadastro que repita o email ou o CPF', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('email', 'cpf'),
        fc.string({ minLength: 2, maxLength: 30 }),
        async (repeatedField, otherName) => {
          const { sut } = makeSut();
          await sut.execute(VALID_INPUT);

          const second =
            repeatedField === 'email'
              ? { ...VALID_INPUT, name: otherName, cpf: '111.444.777-35' }
              : { ...VALID_INPUT, name: otherName, email: 'outro@example.com' };

          await expect(sut.execute(second)).rejects.toThrow(
            EmailOrCpfAlreadyInUseError,
          );
        },
      ),
      { numRuns: 30 },
    );
  });
});
