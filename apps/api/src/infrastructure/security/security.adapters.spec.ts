import { Role } from '@cert-docs/shared';
import { JwtService } from '@nestjs/jwt';
import fc from 'fast-check';
import { BcryptHashAdapter } from './bcrypt-hash.adapter';
import { JWT_EXPIRES_IN, JwtTokenAdapter } from './jwt-token.adapter';

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

describe('BcryptHashAdapter', () => {
  const adapter = new BcryptHashAdapter();

  // Property 4: Senhas jamais são armazenadas em texto puro
  it('nunca devolve a senha em texto puro e valida a senha original', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 64 }),
        async (password) => {
          const hashed = await adapter.hash(password);

          expect(hashed).not.toBe(password);
          expect(hashed).not.toContain(password);
          expect(await adapter.compare(password, hashed)).toBe(true);
          expect(await adapter.compare(`${password}x`, hashed)).toBe(false);
        },
      ),
      { numRuns: 5 },
    );
  }, 30_000);
});

describe('JwtTokenAdapter', () => {
  const jwt = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: JWT_EXPIRES_IN },
  });
  const adapter = new JwtTokenAdapter(jwt);

  // Property 9: JWT gerado no login contém os campos obrigatórios
  it('assina sub, email e role com expiração de no máximo 24h', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.emailAddress(),
        fc.constantFrom(Role.ADMIN, Role.USER),
        async (sub, email, role) => {
          const token = await adapter.sign({ sub, email, role });
          const payload = await jwt.verifyAsync<Record<string, unknown>>(token);

          expect(payload).toMatchObject({ sub, email, role });
          expect(
            Number(payload['exp']) - Number(payload['iat']),
          ).toBeLessThanOrEqual(ONE_DAY_IN_SECONDS);
        },
      ),
      { numRuns: 20 },
    );
  });
});
