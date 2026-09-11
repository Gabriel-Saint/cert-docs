/**
 * Integração com o PostgreSQL real (o do docker compose). Roda em `nx run api:test-integration`.
 * Usa um ano fictício (1900) e registros com prefixo próprio, apagados ao final.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';
import { CertificateAlreadyRequestedError } from '../../../domain/errors';
import { PrismaCertificateRequestRepository } from './prisma-certificate-request.repository';
import { PrismaRegistryCounter } from './prisma-registry-counter';

const TEST_YEAR = 1900;
const PREFIX = 'it-cert-';

describe('Persistência de certificados (integração com Postgres)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  async function cleanUp() {
    await prisma.registryCounter.deleteMany({ where: { year: TEST_YEAR } });
    await prisma.certificateRequest.deleteMany({
      where: { userId: { startsWith: PREFIX } },
    });
    await prisma.course.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  }

  beforeAll(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  // Property 5: Registro sequencial sem repetição, sob concorrência real
  it('20 emissões simultâneas recebem as sequências 1..20 sem repetir', async () => {
    const sequences = await Promise.all(
      Array.from({ length: 20 }, () =>
        prisma.$transaction(
          (tx) => new PrismaRegistryCounter(tx).next(TEST_YEAR),
          {
            timeout: 30_000,
            maxWait: 30_000,
          },
        ),
      ),
    );

    expect([...sequences].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  }, 60_000);

  it('uma transação desfeita devolve o número do registro', async () => {
    const before = await prisma.$transaction((tx) =>
      new PrismaRegistryCounter(tx).next(TEST_YEAR),
    );

    await expect(
      prisma.$transaction(async (tx) => {
        await new PrismaRegistryCounter(tx).next(TEST_YEAR);
        throw new Error('falha simulada depois de reservar o número');
      }),
    ).rejects.toThrow('falha simulada');

    const after = await prisma.$transaction((tx) =>
      new PrismaRegistryCounter(tx).next(TEST_YEAR),
    );
    expect(after).toBe(before + 1);
  });

  // Property 6 (no banco): dois pedidos simultâneos para o mesmo aluno e curso
  it('a chave única barra o segundo pedido pendente mesmo em paralelo', async () => {
    await prisma.user.create({
      data: {
        id: `${PREFIX}user`,
        name: 'Aluno Integração',
        email: `${PREFIX}user@example.com`,
        cpf: '12345678909',
        passwordHash: 'x',
      },
    });
    await prisma.course.create({
      data: {
        id: `${PREFIX}course`,
        title: 'Curso Integração',
        coordinator: 'Coordenação',
      },
    });
    const repository = new PrismaCertificateRequestRepository(prisma);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        repository.create({
          userId: `${PREFIX}user`,
          courseId: `${PREFIX}course`,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(
      rejected.every(
        (r) => r.reason instanceof CertificateAlreadyRequestedError,
      ),
    ).toBe(true);
  });
});
