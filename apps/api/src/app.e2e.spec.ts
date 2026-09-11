/**
 * Fluxo HTTP completo (guards, pipes, filtro de erros e controllers) com os
 * repositórios em memória no lugar do Prisma — não precisa de banco.
 */
import { Role } from '@cpf-pdf/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import fc from 'fast-check';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from './app.setup';
import { PrismaService } from './infrastructure/database/prisma.service';
import { BcryptHashAdapter } from './infrastructure/security/bcrypt-hash.adapter';
import { AppModule } from './modules/app.module';
import {
  DOCUMENT_REPOSITORY,
  DOWNLOAD_LOG_REPOSITORY,
  USER_REPOSITORY,
} from './modules/tokens';
import { setupSwagger, SWAGGER_BEARER_AUTH } from './swagger.setup';
import {
  InMemoryDocumentRepository,
  InMemoryDownloadLogRepository,
  InMemoryUserRepository,
  makeDocument,
  makeUser,
} from './testing/in-memory';

describe('API (e2e)', () => {
  let app: INestApplication<App>;
  let userToken: string;
  let adminToken: string;
  const users = new InMemoryUserRepository();
  const documents = new InMemoryDocumentRepository();
  const logs = new InMemoryDownloadLogRepository();

  beforeAll(async () => {
    const hash = new BcryptHashAdapter();
    users.users.push(
      makeUser({
        id: 'admin-1',
        email: 'admin@example.com',
        cpf: '52998224725',
        passwordHash: await hash.hash('admin12345'),
        role: Role.ADMIN,
      }),
    );
    documents.documents = [makeDocument({ id: 'd1', title: 'Apostila' })];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(DOCUMENT_REPOSITORY)
      .useValue(documents)
      .overrideProvider(DOWNLOAD_LOG_REPOSITORY)
      .useValue(logs)
      .compile();

    app = configureApp(
      moduleRef.createNestApplication(),
    ) as INestApplication<App>;
    setupSwagger(app);
    await app.init();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Maria',
        email: 'maria@example.com',
        cpf: '111.444.777-35',
        password: 'senha12345',
      })
      .expect(201);

    userToken = (await login('maria@example.com', 'senha12345')).body
      .accessToken;
    adminToken = (await login('admin@example.com', 'admin12345')).body
      .accessToken;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  describe('documentação (Swagger)', () => {
    it('publica a especificação OpenAPI com todas as rotas e o esquema JWT', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs-json')
        .expect(200);

      const spec = response.body as {
        paths: Record<string, Record<string, { security?: unknown[] }>>;
        components: { securitySchemes: Record<string, unknown> };
      };

      expect(Object.keys(spec.paths).sort()).toEqual([
        '/api/auth/login',
        '/api/auth/register',
        '/api/certificate-requests',
        '/api/certificate-requests/{id}/approve',
        '/api/certificate-requests/{id}/reject',
        '/api/certificates',
        '/api/certificates/{id}',
        '/api/certificates/{id}/pdf',
        '/api/certificates/{id}/revoke',
        '/api/courses',
        '/api/courses/{id}',
        '/api/documents',
        '/api/documents/{id}',
        '/api/documents/{id}/pdf',
        '/api/me/certificate-requests',
        '/api/me/certificates',
        '/api/public/certificates/{code}',
        '/api/public/certificates/{code}/file-check',
        '/api/users',
      ]);
      expect(spec.components.securitySchemes).toHaveProperty(
        SWAGGER_BEARER_AUTH,
      );
      // rotas protegidas exigem o token; login e cadastro não
      expect(spec.paths['/api/users']['get'].security).toEqual([
        { [SWAGGER_BEARER_AUTH]: [] },
      ]);
      expect(spec.paths['/api/auth/login']['post'].security).toBeUndefined();
    });

    it('serve a interface do Swagger', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
    });
  });

  describe('auth', () => {
    it('registro não expõe passwordHash', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Ana',
          email: 'ana@example.com',
          cpf: '935.411.347-80',
          password: 'senha12345',
        })
        .expect(201);

      expect(Object.keys(response.body).sort()).toEqual([
        'email',
        'id',
        'name',
        'role',
      ]);
      expect(response.body.role).toBe(Role.USER);
    });

    it('mapeia erros de domínio para 400, 409 e 401', async () => {
      const server = app.getHttpServer();
      const base = {
        name: 'Zé',
        email: 'ze@example.com',
        password: 'senha12345',
      };

      await request(server)
        .post('/api/auth/register')
        .send({ ...base, cpf: '111.444.777-36' })
        .expect(400);
      await request(server)
        .post('/api/auth/register')
        .send({ ...base, cpf: '111.444.777-35' })
        .expect(409);
      await login('maria@example.com', 'senha-errada').expect(401);
    });

    it('rejeita body com campos ausentes ou desconhecidos', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'x@example.com', extra: true })
        .expect(400);
    });
  });

  describe('documentos', () => {
    it('exige token (401) e aceita USER na listagem', async () => {
      await request(app.getHttpServer()).get('/api/documents').expect(401);
      await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);

      const response = await request(app.getHttpServer())
        .get('/api/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toEqual([
        { id: 'd1', title: 'Apostila', description: null },
      ]);
    });

    it('baixa o PDF com Content-Disposition e grava o log do usuário do token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/documents/d1/pdf')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="documento-d1-111-35.pdf"',
      );
      expect(logs.logs.at(-1)).toMatchObject({ documentId: 'd1' });
    });

    it('retorna 404 para documento inexistente', async () => {
      await request(app.getHttpServer())
        .get('/api/documents/nao-existe/pdf')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('autorização por role', () => {
    const adminEndpoints = [
      { method: 'post', path: '/api/documents' },
      { method: 'patch', path: '/api/documents/d1' },
      { method: 'delete', path: '/api/documents/d1' },
      { method: 'get', path: '/api/users' },
    ] as const;

    // Property 7: usuário USER não acessa endpoints ADMIN
    it('USER recebe 403 em qualquer endpoint ADMIN, com qualquer body', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...adminEndpoints),
          fc.dictionary(fc.string(), fc.jsonValue()),
          async ({ method, path }, body) => {
            await request(app.getHttpServer())
              [method](path)
              .set('Authorization', `Bearer ${userToken}`)
              .send(body)
              .expect(403);
          },
        ),
        { numRuns: 25 },
      );
    });

    it('sem token recebe 401 antes da checagem de role', async () => {
      for (const { method, path } of adminEndpoints) {
        await request(app.getHttpServer())[method](path).expect(401);
      }
    });

    it('ADMIN lista usuários com CPF mascarado', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const cpfs = (response.body as { cpf: string }[]).map((u) => u.cpf);
      expect(cpfs).toContain('529.***.***-25');
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });
  });
});
