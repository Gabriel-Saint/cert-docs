/**
 * Fluxo HTTP completo de certificados (guards, pipes, filtro de erros, upload e throttler)
 * com repositórios, storage e renderer em memória — sem banco e sem Chromium.
 */
import { Role } from '@cpf-pdf/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from './app.setup';
import { PrismaService } from './infrastructure/database/prisma.service';
import { BcryptHashAdapter } from './infrastructure/security/bcrypt-hash.adapter';
import { AppModule } from './modules/app.module';
import {
  CERTIFICATE_RENDERER,
  CERTIFICATE_REPOSITORY,
  CERTIFICATE_REQUEST_REPOSITORY,
  CERTIFICATE_STORAGE,
  COURSE_REPOSITORY,
  UNIT_OF_WORK,
  USER_REPOSITORY,
} from './modules/tokens';
import { InMemoryUserRepository, makeUser } from './testing/in-memory';
import {
  FakeCertificateRenderer,
  InMemoryCertificateRepository,
  InMemoryCertificateRequestRepository,
  InMemoryCertificateStorage,
  InMemoryCourseRepository,
  InMemoryRegistryCounter,
  InMemoryUnitOfWork,
} from './testing/in-memory-certificates';

describe('Certificados (e2e)', () => {
  let app: INestApplication<App>;
  let studentToken: string;
  let otherToken: string;
  let adminToken: string;

  const users = new InMemoryUserRepository();
  const courses = new InMemoryCourseRepository();
  const requests = new InMemoryCertificateRequestRepository(users, courses);
  const certificates = new InMemoryCertificateRepository(users);
  const unitOfWork = new InMemoryUnitOfWork(
    requests,
    certificates,
    new InMemoryRegistryCounter(),
  );
  const storage = new InMemoryCertificateStorage();

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  beforeAll(async () => {
    const hash = new BcryptHashAdapter();
    const passwordHash = await hash.hash('senha12345');
    users.users.push(
      makeUser({
        id: 'student',
        name: 'Ana Luísa Conceição',
        email: 'ana@example.com',
        cpf: '93541134780',
        passwordHash,
      }),
      makeUser({
        id: 'other',
        name: 'Bruno Lima',
        email: 'bruno@example.com',
        cpf: '11144477735',
        passwordHash,
      }),
      makeUser({
        id: 'admin',
        name: 'Administradora',
        email: 'admin@example.com',
        cpf: '52998224725',
        passwordHash,
        role: Role.ADMIN,
      }),
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(COURSE_REPOSITORY)
      .useValue(courses)
      .overrideProvider(CERTIFICATE_REQUEST_REPOSITORY)
      .useValue(requests)
      .overrideProvider(CERTIFICATE_REPOSITORY)
      .useValue(certificates)
      .overrideProvider(UNIT_OF_WORK)
      .useValue(unitOfWork)
      .overrideProvider(CERTIFICATE_STORAGE)
      .useValue(storage)
      .overrideProvider(CERTIFICATE_RENDERER)
      .useValue(new FakeCertificateRenderer())
      .compile();

    app = configureApp(
      moduleRef.createNestApplication(),
    ) as INestApplication<App>;
    await app.init();

    const login = async (email: string) =>
      (
        await http()
          .post('/api/auth/login')
          .send({ email, password: 'senha12345' })
      ).body.accessToken as string;
    [studentToken, otherToken, adminToken] = await Promise.all([
      login('ana@example.com'),
      login('bruno@example.com'),
      login('admin@example.com'),
    ]);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('percorre o fluxo inteiro: curso → pedido → aprovação → download → verificação → revogação', async () => {
    // ADMIN cria o curso (a carga horária vem da soma dos módulos)
    const course = await http()
      .post('/api/courses')
      .set(auth(adminToken))
      .send({
        title: 'Angular Avançado',
        coordinator: 'Profa. Carla Nunes',
        modules: [
          { title: 'Signals', hours: 12 },
          { title: 'Testes', hours: 8 },
        ],
      })
      .expect(201);
    expect(course.body.workloadHours).toBe(20);

    // Aluno vê o curso e solicita
    await http().get('/api/courses').set(auth(studentToken)).expect(200);
    const created = await http()
      .post('/api/certificate-requests')
      .set(auth(studentToken))
      .send({ courseId: course.body.id })
      .expect(201);
    await http()
      .post('/api/certificate-requests')
      .set(auth(studentToken))
      .send({ courseId: course.body.id })
      .expect(409);

    // Aluno não aprova; ADMIN vê a fila e aprova
    await http()
      .post(`/api/certificate-requests/${created.body.id}/approve`)
      .set(auth(studentToken))
      .send({ completionDate: today })
      .expect(403);
    const queue = await http()
      .get('/api/certificate-requests?status=PENDING')
      .set(auth(adminToken))
      .expect(200);
    expect(queue.body[0].student.cpf).toBe('935.***.***-80');

    const issued = await http()
      .post(`/api/certificate-requests/${created.body.id}/approve`)
      .set(auth(adminToken))
      .send({ completionDate: today })
      .expect(201);
    expect(issued.body.code).toMatch(
      /^CERT-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/,
    );
    expect(issued.body.verificationUrl).toBe(
      `http://localhost:4200/verificar/${issued.body.code}`,
    );

    // Dono baixa, outro aluno recebe 404
    const file = await http()
      .get(`/api/certificates/${issued.body.id}/pdf`)
      .set(auth(studentToken))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.headers['content-disposition']).toBe(
      `attachment; filename="certificado-${issued.body.code}.pdf"`,
    );
    await http()
      .get(`/api/certificates/${issued.body.id}/pdf`)
      .set(auth(otherToken))
      .expect(404);

    // Verificação pública sem login, com código em minúsculas e sem hífens
    const loose = (issued.body.code as string).toLowerCase().replace(/-/g, '');
    const verified = await http()
      .get(`/api/public/certificates/${loose}`)
      .expect(200);
    expect(verified.body).toMatchObject({
      status: 'VALID',
      holderName: 'Ana Luísa Conceição',
      holderCpf: '935.***.***-80',
      workloadHours: 20,
      revocation: null,
    });

    // Conferência de arquivo
    const original = file.body as Buffer;
    const matches = await http()
      .post(`/api/public/certificates/${issued.body.code}/file-check`)
      .attach('file', original, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    expect(matches.body).toEqual({ matches: true });

    const tampered = Buffer.concat([original, Buffer.from(' ')]);
    const mismatch = await http()
      .post(`/api/public/certificates/${issued.body.code}/file-check`)
      .attach('file', tampered, {
        filename: 'certificado.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    expect(mismatch.body).toEqual({ matches: false });

    // Histórico e detalhe
    const history = await http()
      .get('/api/certificates?q=luísa')
      .set(auth(adminToken))
      .expect(200);
    expect(history.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    const detail = await http()
      .get(`/api/certificates/${issued.body.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.snapshot.holder.cpf).toBe('935.***.***-80');
    expect(detail.body.issuedBy.name).toBe('Administradora');

    // Revogação com acento no motivo
    await http()
      .post(`/api/certificates/${issued.body.id}/revoke`)
      .set(auth(adminToken))
      .send({ reason: 'Emissão com a data de conclusão errada.' })
      .expect(204);
    await http()
      .post(`/api/certificates/${issued.body.id}/revoke`)
      .set(auth(adminToken))
      .send({ reason: 'Emissão com a data de conclusão errada.' })
      .expect(409);
    const revoked = await http()
      .get(`/api/public/certificates/${issued.body.code}`)
      .expect(200);
    expect(revoked.body.status).toBe('REVOKED');
    expect(revoked.body.revocation.reason).toBe(
      'Emissão com a data de conclusão errada.',
    );

    // Depois da revogação o aluno pode pedir de novo; ADMIN recusa com motivo
    const second = await http()
      .post('/api/certificate-requests')
      .set(auth(studentToken))
      .send({ courseId: course.body.id })
      .expect(201);
    await http()
      .post(`/api/certificate-requests/${second.body.id}/reject`)
      .set(auth(adminToken))
      .send({ reason: 'Aguardando o projeto final.' })
      .expect(204);
    const mine = await http()
      .get('/api/me/certificate-requests')
      .set(auth(studentToken))
      .expect(200);
    expect(mine.body.map((r: { status: string }) => r.status)).toEqual([
      'REJECTED',
      'APPROVED',
    ]);
  });

  it('valida entradas com 400', async () => {
    await http()
      .post('/api/courses')
      .set(auth(adminToken))
      .send({ title: 'Sem módulos', coordinator: 'X', modules: [] })
      .expect(400);
    await http()
      .post('/api/certificate-requests/qualquer/approve')
      .set(auth(adminToken))
      .send({ completionDate: '11/09/2026' })
      .expect(400);
    await http()
      .get('/api/certificates?pageSize=500')
      .set(auth(adminToken))
      .expect(400);
    await http().get('/api/public/certificates/nao-e-um-codigo').expect(400);
    await http()
      .post('/api/public/certificates/CERT-0000-0000-0000/file-check')
      .attach('file', Buffer.from('texto'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('limita as rotas públicas a 30 requisições por minuto', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 35; i++) {
      statuses.push(
        (await http().get('/api/public/certificates/CERT-0000-0000-0000'))
          .status,
      );
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s !== 429).every((s) => s === 404)).toBe(
      true,
    );
  });
});
