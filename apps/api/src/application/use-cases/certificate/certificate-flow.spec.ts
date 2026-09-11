import {
  CertificateRequestStatus,
  CertificateStatus,
  Role,
} from '@cert-docs/shared';
import fc from 'fast-check';
import {
  CertificateAlreadyRequestedError,
  CertificateAlreadyRevokedError,
  CertificateIssuanceError,
  CertificateNotFoundError,
  CertificateRequestAlreadyReviewedError,
  CourseNotFoundError,
  InvalidCertificatePeriodError,
} from '../../../domain/errors';
import { canonicalize } from '../../../domain/services/canonical-json';
import { sha256Hex } from '../../../domain/services/hash';
import { toPublicVerification } from '../../../presentation/presenters/certificate.presenter';
import { InMemoryUserRepository, makeUser } from '../../../testing/in-memory';
import {
  FakeCertificateRenderer,
  FixedClock,
  InMemoryCertificateRepository,
  InMemoryCertificateRequestRepository,
  InMemoryCertificateStorage,
  InMemoryCourseRepository,
  InMemoryRegistryCounter,
  InMemoryUnitOfWork,
  SequenceRandom,
} from '../../../testing/in-memory-certificates';
import type { CertificateSettings } from '../../certificate-settings';
import {
  ApproveCertificateRequestUseCase,
  RejectCertificateRequestUseCase,
  RequestCertificateUseCase,
} from '../certificate-request/certificate-request.use-cases';
import {
  CheckCertificateFileUseCase,
  GetCertificateFileUseCase,
  ListCertificatesUseCase,
  RevokeCertificateUseCase,
  VerifyCertificateUseCase,
} from './certificate.use-cases';
import { IssueCertificateUseCase } from './issue-certificate.use-case';

const SETTINGS: CertificateSettings = {
  publicWebUrl: 'https://certificados.example.com/',
  institution: {
    name: 'Academia Horizonte',
    city: 'São Paulo',
    director: 'Dra. Helena Duarte',
    directorRole: 'Diretora Acadêmica',
  },
};

function makeSystem() {
  const users = new InMemoryUserRepository();
  const courses = new InMemoryCourseRepository();
  const requests = new InMemoryCertificateRequestRepository(users, courses);
  const certificates = new InMemoryCertificateRepository(users);
  const registry = new InMemoryRegistryCounter();
  const unitOfWork = new InMemoryUnitOfWork(requests, certificates, registry);
  const storage = new InMemoryCertificateStorage();
  const renderer = new FakeCertificateRenderer();
  const clock = new FixedClock();

  users.users.push(
    makeUser({
      id: 'student',
      name: 'Maria Clara Souza',
      cpf: '93541134780',
      email: 'maria@example.com',
    }),
    makeUser({
      id: 'other-student',
      name: 'João Silva',
      cpf: '11144477735',
      email: 'joao@example.com',
    }),
    makeUser({
      id: 'admin',
      name: 'Administrador',
      cpf: '52998224725',
      email: 'admin@example.com',
      role: Role.ADMIN,
    }),
  );
  courses.courses.push({
    id: 'course',
    title: 'NestJS com Arquitetura Hexagonal',
    description: null,
    coordinator: 'Prof. Ricardo Menezes',
    isActive: true,
    modules: [
      { title: 'Fundamentos', hours: 16 },
      { title: 'Hexagonal', hours: 24 },
    ],
    createdAt: new Date(),
  });

  const issue = new IssueCertificateUseCase(
    unitOfWork,
    users,
    courses,
    renderer,
    storage,
    new SequenceRandom(),
    clock,
    SETTINGS,
  );

  return {
    users,
    courses,
    requests,
    certificates,
    registry,
    storage,
    renderer,
    clock,
    request: new RequestCertificateUseCase(courses, requests, certificates),
    approve: new ApproveCertificateRequestUseCase(requests, issue),
    reject: new RejectCertificateRequestUseCase(requests, clock),
    revoke: new RevokeCertificateUseCase(certificates, clock),
    verify: new VerifyCertificateUseCase(certificates),
    checkFile: new CheckCertificateFileUseCase(certificates),
    getFile: new GetCertificateFileUseCase(certificates, storage),
    history: new ListCertificatesUseCase(certificates),
  };
}

async function requestAndApprove(
  system: ReturnType<typeof makeSystem>,
  userId = 'student',
) {
  const { request } = await system.request.execute({
    userId,
    courseId: 'course',
  });
  return system.approve.execute({
    requestId: request.id,
    reviewerId: 'admin',
    startDate: '2026-08-04',
    completionDate: '2026-09-11',
  });
}

describe('Fluxo de certificados', () => {
  describe('solicitação', () => {
    it('cria pedido pendente e barra pedido duplicado', async () => {
      const system = makeSystem();
      const { request } = await system.request.execute({
        userId: 'student',
        courseId: 'course',
      });

      expect(request.status).toBe(CertificateRequestStatus.PENDING);
      await expect(
        system.request.execute({ userId: 'student', courseId: 'course' }),
      ).rejects.toThrow(CertificateAlreadyRequestedError);
    });

    it('rejeita curso inexistente ou desativado', async () => {
      const system = makeSystem();
      await system.courses.deactivate('course');

      await expect(
        system.request.execute({ userId: 'student', courseId: 'course' }),
      ).rejects.toThrow(CourseNotFoundError);
      await expect(
        system.request.execute({ userId: 'student', courseId: 'nope' }),
      ).rejects.toThrow(CourseNotFoundError);
    });
  });

  describe('emissão', () => {
    it('congela os dados, gera registro, código, hash de dados e guarda o PDF', async () => {
      const system = makeSystem();
      const certificate = await requestAndApprove(system);

      expect(certificate.status).toBe(CertificateStatus.VALID);
      expect(certificate.snapshot).toEqual({
        holder: { name: 'Maria Clara Souza', cpf: '93541134780' },
        course: {
          title: 'NestJS com Arquitetura Hexagonal',
          coordinator: 'Prof. Ricardo Menezes',
          workloadHours: 40,
          modules: [
            { title: 'Fundamentos', hours: 16 },
            { title: 'Hexagonal', hours: 24 },
          ],
        },
        period: { startDate: '2026-08-04', completionDate: '2026-09-11' },
        institution: SETTINGS.institution,
        issuedAt: '2026-09-11T15:00:00.000Z',
      });
      expect([certificate.registryYear, certificate.registrySequence]).toEqual([
        2026, 1,
      ]);

      const [render] = system.renderer.calls;
      expect(render.verificationUrl).toBe(
        `https://certificados.example.com/verificar/${render.code}`,
      );
      expect(certificate.dataHash).toBe(
        sha256Hex(
          canonicalize({
            snapshot: certificate.snapshot,
            code: render.code,
            registry: '2026.000001',
          }),
        ),
      );
      const stored = await system.storage.read(certificate.fileKey);
      expect(certificate.fileHash).toBe(sha256Hex(stored));
      expect(
        (await system.requests.findById(certificate.requestId))?.status,
      ).toBe(CertificateRequestStatus.APPROVED);
    });

    // Property 3: Snapshot imutável
    it('alterar aluno ou curso depois da emissão não muda o certificado', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 60 }),
          fc.string({ minLength: 2, maxLength: 60 }),
          fc.integer({ min: 1, max: 999 }),
          async (newName, newTitle, newHours) => {
            const system = makeSystem();
            const certificate = await requestAndApprove(system);
            const before = structuredClone(certificate);

            system.users.users[0] = makeUser({
              id: 'student',
              name: newName,
              cpf: '11144477735',
            });
            await system.courses.update('course', {
              title: newTitle,
              modules: [{ title: 'Novo módulo', hours: newHours }],
            });

            const after = await system.verify.execute(before.code);
            expect(after.snapshot).toEqual(before.snapshot);
            expect(after.dataHash).toBe(before.dataHash);
            expect(after.fileHash).toBe(before.fileHash);
          },
        ),
        { numRuns: 25 },
      );
    });

    // Property 4: Aprovação emite exatamente um certificado (e falha não deixa rastro)
    it.each([
      [
        'renderização',
        (s: ReturnType<typeof makeSystem>) =>
          (s.renderer.failNextRender = true),
      ],
      [
        'gravação do arquivo',
        (s: ReturnType<typeof makeSystem>) => (s.storage.failNextSave = true),
      ],
    ])(
      'falha na %s mantém o pedido pendente e não grava nada',
      async (_, breakIt) => {
        const system = makeSystem();
        const { request } = await system.request.execute({
          userId: 'student',
          courseId: 'course',
        });
        breakIt(system);

        await expect(
          system.approve.execute({
            requestId: request.id,
            reviewerId: 'admin',
            completionDate: '2026-09-11',
          }),
        ).rejects.toThrow(CertificateIssuanceError);

        expect((await system.requests.findById(request.id))?.status).toBe(
          CertificateRequestStatus.PENDING,
        );
        expect(system.certificates.certificates).toHaveLength(0);
        expect(system.storage.files.size).toBe(0);
        expect(system.registry.counters.size).toBe(0);

        // e a nova tentativa funciona, com o registro começando em 1
        const certificate = await system.approve.execute({
          requestId: request.id,
          reviewerId: 'admin',
          completionDate: '2026-09-11',
        });
        expect(certificate.registrySequence).toBe(1);
      },
    );

    it('não aprova duas vezes nem com datas inválidas', async () => {
      const system = makeSystem();
      const { request } = await system.request.execute({
        userId: 'student',
        courseId: 'course',
      });

      await expect(
        system.approve.execute({
          requestId: request.id,
          reviewerId: 'admin',
          completionDate: '2026-09-12',
        }),
      ).rejects.toThrow(InvalidCertificatePeriodError);

      await system.approve.execute({
        requestId: request.id,
        reviewerId: 'admin',
        completionDate: '2026-09-11',
      });
      await expect(
        system.approve.execute({
          requestId: request.id,
          reviewerId: 'admin',
          completionDate: '2026-09-11',
        }),
      ).rejects.toThrow(CertificateRequestAlreadyReviewedError);
    });

    // Property 5 (em memória): sequência contínua por ano
    it('numera o registro em sequência e reinicia no ano seguinte', async () => {
      const system = makeSystem();
      const first = await requestAndApprove(system, 'student');
      const second = await requestAndApprove(system, 'other-student');

      system.clock.current = new Date('2027-01-02T12:00:00Z');
      await system.revoke.execute({
        certificateId: first.id,
        revokerId: 'admin',
        reason: 'Reemissão no ano novo.',
      });
      const third = await requestAndApprove(system, 'student');

      expect([first.registrySequence, second.registrySequence]).toEqual([1, 2]);
      expect([third.registryYear, third.registrySequence]).toEqual([2027, 1]);
    });
  });

  // Property 6: no máximo um pedido pendente e um certificado válido por aluno e curso
  it('qualquer sequência de ações nunca gera dois pendentes nem dois válidos', async () => {
    type Action = 'request' | 'approve' | 'reject' | 'revoke';
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom<Action>('request', 'approve', 'reject', 'revoke'),
          { maxLength: 15 },
        ),
        async (actions) => {
          const system = makeSystem();
          for (const action of actions) {
            const pending = system.requests.requests.find(
              (r) => r.status === 'PENDING',
            );
            const valid = system.certificates.certificates.find(
              (c) => c.status === 'VALID',
            );
            try {
              if (action === 'request')
                await system.request.execute({
                  userId: 'student',
                  courseId: 'course',
                });
              if (action === 'approve' && pending)
                await system.approve.execute({
                  requestId: pending.id,
                  reviewerId: 'admin',
                  completionDate: '2026-09-11',
                });
              if (action === 'reject' && pending)
                await system.reject.execute({
                  requestId: pending.id,
                  reviewerId: 'admin',
                  reason: 'Motivo de teste suficiente.',
                });
              if (action === 'revoke' && valid)
                await system.revoke.execute({
                  certificateId: valid.id,
                  revokerId: 'admin',
                  reason: 'Motivo de teste suficiente.',
                });
            } catch (error) {
              expect(error).toBeInstanceOf(CertificateAlreadyRequestedError);
            }

            expect(
              system.requests.requests.filter((r) => r.status === 'PENDING')
                .length,
            ).toBeLessThanOrEqual(1);
            expect(
              system.certificates.certificates.filter(
                (c) => c.status === 'VALID',
              ).length,
            ).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  describe('recusa, revogação e acesso', () => {
    it('recusa com motivo e permite pedir de novo', async () => {
      const system = makeSystem();
      const { request } = await system.request.execute({
        userId: 'student',
        courseId: 'course',
      });
      await system.reject.execute({
        requestId: request.id,
        reviewerId: 'admin',
        reason: 'Falta o projeto final.',
      });

      const rejected = await system.requests.findById(request.id);
      expect(rejected?.status).toBe(CertificateRequestStatus.REJECTED);
      expect(rejected?.rejectionReason).toBe('Falta o projeto final.');
      await expect(
        system.request.execute({ userId: 'student', courseId: 'course' }),
      ).resolves.toBeDefined();
    });

    // Property 11: Revogação é definitiva e visível
    it('revogação aparece na verificação, não repete e libera novo pedido', async () => {
      const system = makeSystem();
      const certificate = await requestAndApprove(system);

      await system.revoke.execute({
        certificateId: certificate.id,
        revokerId: 'admin',
        reason: 'Curso errado.',
      });
      const verified = toPublicVerification(
        await system.verify.execute(certificate.code),
      );

      expect(verified.status).toBe(CertificateStatus.REVOKED);
      expect(verified.revocation).toEqual({
        revokedAt: '2026-09-11T15:00:00.000Z',
        reason: 'Curso errado.',
      });
      await expect(
        system.revoke.execute({
          certificateId: certificate.id,
          revokerId: 'admin',
          reason: 'Curso errado.',
        }),
      ).rejects.toThrow(CertificateAlreadyRevokedError);
      expect((await system.history.execute({})).total).toBe(1);
      await expect(
        system.request.execute({ userId: 'student', courseId: 'course' }),
      ).resolves.toBeDefined();
    });

    it('só o dono ou um ADMIN baixam o PDF', async () => {
      const system = makeSystem();
      const certificate = await requestAndApprove(system);

      const owner = await system.getFile.execute({
        certificateId: certificate.id,
        requester: {
          sub: 'student',
          email: 'maria@example.com',
          role: Role.USER,
        },
      });
      expect(owner.fileName).toMatch(/^certificado-CERT-[0-9A-Z-]+\.pdf$/);
      await expect(
        system.getFile.execute({
          certificateId: certificate.id,
          requester: {
            sub: 'admin',
            email: 'admin@example.com',
            role: Role.ADMIN,
          },
        }),
      ).resolves.toBeDefined();
      await expect(
        system.getFile.execute({
          certificateId: certificate.id,
          requester: {
            sub: 'other-student',
            email: 'joao@example.com',
            role: Role.USER,
          },
        }),
      ).rejects.toThrow(CertificateNotFoundError);
    });
  });

  describe('verificação pública', () => {
    // Property 7: Verificação pública nunca expõe dados sensíveis
    it('não expõe CPF completo, email, ids internos, arquivo nem quem aprovou', async () => {
      const system = makeSystem();
      const certificate = await requestAndApprove(system);
      const json = JSON.stringify(toPublicVerification(certificate));

      for (const secret of [
        '93541134780',
        '935.411.347-80',
        'maria@example.com',
        certificate.fileKey,
        'admin',
        'student',
        certificate.id,
      ]) {
        expect(json).not.toContain(secret);
      }
      expect(json).toContain('935.***.***-80');
    });

    // Property 8: Conferência de arquivo detecta qualquer alteração
    it('arquivo original confere e qualquer byte alterado não confere', async () => {
      const system = makeSystem();
      const certificate = await requestAndApprove(system);
      const original = await system.storage.read(certificate.fileKey);

      await expect(
        system.checkFile.execute({ code: certificate.code, content: original }),
      ).resolves.toEqual({ matches: true });

      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: original.length - 1 }),
          fc.integer({ min: 1, max: 255 }),
          async (index, delta) => {
            const tampered = Buffer.from(original);
            tampered[index] = (tampered[index] + delta) % 256;
            await expect(
              system.checkFile.execute({
                code: certificate.code,
                content: tampered,
              }),
            ).resolves.toEqual({ matches: false });
          },
        ),
      );
    });
  });

  it('histórico filtra por texto, status e período no fuso de Brasília', async () => {
    const system = makeSystem();
    const maria = await requestAndApprove(system, 'student');
    system.clock.current = new Date('2026-09-12T02:30:00Z'); // ainda dia 11 em Brasília
    await requestAndApprove(system, 'other-student');
    await system.revoke.execute({
      certificateId: maria.id,
      revokerId: 'admin',
      reason: 'Motivo de teste.',
    });

    expect((await system.history.execute({ q: 'maria' })).total).toBe(1);
    expect(
      (await system.history.execute({ status: 'REVOKED' })).items[0].id,
    ).toBe(maria.id);
    expect(
      (await system.history.execute({ from: '2026-09-11', to: '2026-09-11' }))
        .total,
    ).toBe(2);
    expect((await system.history.execute({ from: '2026-09-12' })).total).toBe(
      0,
    );
    expect(
      await system.history.execute({ page: 2, pageSize: 1 }),
    ).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect((await system.history.execute({ pageSize: 5000 })).pageSize).toBe(
      100,
    );
  });
});
