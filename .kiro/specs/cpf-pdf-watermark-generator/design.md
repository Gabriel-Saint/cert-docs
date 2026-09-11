# Design: CPF PDF Watermark Generator

## Overview

Sistema web para geração de PDFs personalizados com o CPF do usuário inserido no cabeçalho e rodapé de cada página. Utilizado para rastrear vazamentos de conteúdo restrito (apostilas, materiais de curso). Construído como monorepo Nx com Angular 21 (`apps/web`) e NestJS (`apps/api`), seguindo arquitetura hexagonal e princípios SOLID no backend.

**Stack Definida:**

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 21 (Standalone, Signals, `httpResource`, Control Flow, Angular Material, zoneless) |
| Backend | NestJS (arquitetura hexagonal) |
| Banco de dados | PostgreSQL 16 |
| ORM | Prisma 7 (`prisma.config.ts`, generator `prisma-client`, adapter `@prisma/adapter-pg`) |
| Geração de PDF | PDFKit |
| Auth | JWT (NestJS + Passport) |
| Monorepo | Nx Workspace (npm) |
| Testes | Jest (api), Vitest (web e shared), fast-check (property tests), Supertest (e2e) |
| Containerização | Docker + Docker Compose |
| Runtime | Node.js 22 LTS |

---

## Architecture

### Estrutura do Monorepo Nx

```
cpf-pdf-watermark-generator/          <- raiz do repositório / workspace Nx
├── apps/
│   ├── web/                          <- Angular 21
│   │   ├── proxy.conf.json           <- /api -> http://localhost:3000 (dev)
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   └── api/                          <- NestJS (hexagonal)
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── prisma.config.ts
│       └── Dockerfile
├── libs/
│   └── shared/                       <- @cpf-pdf/shared (sem dependências externas)
├── docker-compose.yml
├── .env.example
├── nx.json
├── package.json
└── tsconfig.base.json
```

**Por que `apps/api` e `apps/web`?** É a convenção mais comum em monorepos Nx/Turborepo: o nome descreve *o que a aplicação entrega* (uma API, um site), não a camada. Escala melhor quando surgem outros apps (`apps/admin`, `apps/worker`, `apps/mobile`), onde "frontend/backend" deixaria de fazer sentido.

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        Nx Monorepo                          │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │    apps/web      │        │        apps/api          │  │
│  │  (Angular 21)    │◄──────►│        (NestJS)          │  │
│  │                  │  /api  │                          │  │
│  │  - Standalone    │  REST  │  - Arquitetura Hexagonal │  │
│  │  - Signals       │  JWT   │  - SOLID                 │  │
│  └────────┬─────────┘        └────┬─────────────┬───────┘  │
│           │                       │             │ Prisma    │
│           │   ┌──────────────┐    │             ▼           │
│           └──►│ libs/shared  │◄───┘  ┌──────────────────┐  │
│               │ - Role       │       │   PostgreSQL     │  │
│               │ - contratos  │       │ users, documents,│  │
│               │ - cpf utils  │       │ download_logs    │  │
│               └──────────────┘       └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Regra da `libs/shared`:** somente tipos, interfaces, constantes e funções puras. Nada de `class-validator`, `@nestjs/*` ou `@angular/*` — senão essas dependências vazam para o bundle do outro app. DTOs com decorators de validação ficam em `apps/api` e *implementam* os contratos da lib.

### Camadas da Arquitetura Hexagonal (apps/api)

```
apps/api/src/
├── domain/              <- NÚCLEO — sem NestJS, sem Prisma
│   ├── entities/        <- UserEntity, DocumentEntity, DownloadLogEntity
│   ├── value-objects/   <- Cpf
│   ├── errors/          <- DomainError e subclasses
│   └── ports/
│       ├── repositories/   UserRepositoryPort, DocumentRepositoryPort, DownloadLogRepositoryPort
│       └── services/       PdfGeneratorPort, HashPort, TokenPort
│
├── application/         <- CASOS DE USO — classes TypeScript puras, dependem só de ports
│   └── use-cases/
│       ├── auth/        <- RegisterUser, AuthenticateUser
│       ├── document/    <- CreateDocument, UpdateDocument, DeleteDocument,
│       │                   ListDocuments, GetDocument, GeneratePersonalizedPdf
│       └── user/        <- ListUsers
│
├── infrastructure/      <- ADAPTERS — podem usar NestJS e libs externas
│   ├── database/        <- PrismaService, PrismaUserRepository, PrismaDocumentRepository,
│   │                       PrismaDownloadLogRepository
│   ├── pdf/             <- PdfKitGeneratorAdapter
│   └── security/        <- BcryptHashAdapter, JwtTokenAdapter
│
├── presentation/        <- ENTRADA HTTP
│   ├── controllers/     <- AuthController, DocumentController, UserController
│   ├── dtos/            <- RegisterDto, LoginDto, CreateDocumentDto... (class-validator)
│   ├── guards/          <- JwtStrategy, JwtAuthGuard, RolesGuard
│   ├── decorators/      <- @Roles(), @CurrentUser()
│   └── filters/         <- DomainExceptionFilter
│
├── modules/             <- COMPOSITION ROOT — liga ports aos adapters
│   ├── tokens.ts        <- Symbols de injeção
│   ├── database.module.ts
│   ├── auth.module.ts, document.module.ts, user.module.ts
│   └── app.module.ts
│
├── generated/prisma/    <- cliente Prisma gerado (no .gitignore)
└── main.ts              <- setGlobalPrefix('api'), ValidationPipe, filtro global
```

**Regra de dependência:** `presentation` e `infrastructure` → `application` → `domain`. `domain` e `application` não importam `@nestjs/*` nem o cliente Prisma. Isso permite testar casos de uso com `new UseCase(mocks)`, sem `TestingModule`.

### Fluxo de Dados — Geração de PDF

```
[Angular 21]                 [NestJS]                   [PostgreSQL]
    │                           │                            │
    │  POST /api/auth/login     │                            │
    │──────────────────────────►│── AuthenticateUserUseCase ─►│
    │◄── { accessToken: JWT } ──│◄───────────────────────────│
    │                           │                            │
    │  GET /api/documents       │                            │
    │  Authorization: Bearer    │                            │
    │──────────────────────────►│── ListDocumentsUseCase ────►│
    │◄── lista de documentos ───│◄───────────────────────────│
    │                           │                            │
    │  GET /api/documents/:id/pdf                            │
    │──────────────────────────►│── GeneratePersonalizedPdf  │
    │                           │   busca document + user ──►│
    │                           │◄───────────────────────────│
    │                           │   PDFKit: conteúdo, depois │
    │                           │   carimbo em cada página   │
    │                           │── salva DownloadLog ──────►│
    │◄── PDF + Content-Disposition                           │
    │  [download automático]    │                            │
```

### Perfis de Usuário e Permissões

| Role | Pode | Não pode |
|---|---|---|
| USER | Login, listar documentos, baixar PDF | CRUD de documentos, listar usuários |
| ADMIN | Tudo do USER + CRUD de documentos + listar usuários | — |

O primeiro ADMIN é criado pelo seed (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), já que o cadastro público sempre cria `USER`.

### Endpoints da API REST

Todas as rotas têm o prefixo global `/api`.

| Método | Rota | Auth | Role | Descrição |
|---|---|---|---|---|
| POST | /api/auth/register | ❌ | - | Cadastro de usuário |
| POST | /api/auth/login | ❌ | - | Login, retorna JWT |
| GET | /api/documents | ✅ | USER/ADMIN | Lista documentos ativos |
| GET | /api/documents/:id | ✅ | USER/ADMIN | Detalhe do documento |
| GET | /api/documents/:id/pdf | ✅ | USER/ADMIN | Download do PDF personalizado |
| POST | /api/documents | ✅ | ADMIN | Cria novo documento |
| PATCH | /api/documents/:id | ✅ | ADMIN | Atualiza documento |
| DELETE | /api/documents/:id | ✅ | ADMIN | Desativa documento (soft delete) |
| GET | /api/users | ✅ | ADMIN | Lista usuários (CPF mascarado) |

---

### Ambiente de Desenvolvimento

```bash
docker compose up -d postgres     # só o banco
npx nx run api:prisma-migrate     # aplica migrations
npx nx run api:prisma-seed        # cria ADMIN + documentos de exemplo
npx nx serve api                  # http://localhost:3000/api
npx nx serve web                  # http://localhost:4200 (proxy /api -> :3000)
```

`apps/web/proxy.conf.json`:

```json
{
  "/api": { "target": "http://localhost:3000", "secure": false }
}
```

Com o proxy, o navegador enxerga front e back na mesma origem: não há CORS e o header `Content-Disposition` fica legível pelo Angular — o mesmo comportamento que o Nginx dá em produção.

### Containerização (Docker)

```
docker-compose.yml
├── web       ← Nginx servindo build Angular (porta 80) + proxy /api
├── api       ← Node.js NestJS (porta 3000, só na rede interna)
└── postgres  ← PostgreSQL 16 (porta 5432, volume persistente, healthcheck)
```

**Comunicação entre containers:**

```
[browser] → web:80 (Nginx)
               ├── /       → arquivos estáticos do Angular (fallback index.html)
               └── /api/   → api:3000/api/...
[api:3000] → postgres:5432
```

**`apps/web/nginx.conf`:**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://api:3000;          # sem barra no final: mantém o /api na URL
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri $uri/ /index.html;    # F5 em /documents não dá 404
  }
}
```

**`docker-compose.yml`:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
```

**Estratégia de build:**

- **Contexto de build é a raiz do repo** (o monorepo inteiro), com `.dockerignore` excluindo `node_modules`, `dist`, `.nx`, `.git` e `.env`.
- **web**: stage 1 `node:22-alpine` roda `npm ci` + `nx build web --configuration=production`; stage 2 `nginx:alpine` copia `dist/apps/web/browser` e o `nginx.conf`.
- **api**: stage 1 roda `npm ci`, `nx run api:prisma-generate` e `nx build api` (com `generatePackageJson: true`); stage 2 `node:22-alpine` copia `dist/apps/api`, `apps/api/prisma/` e `prisma.config.ts`, instala dependências de produção **mais `prisma` e `dotenv`** (necessários para `migrate deploy` e para o config) e inicia com `sh -c "npx prisma migrate deploy && node main.js"`.
- Validar a imagem da api **cedo** (logo após a fatia de auth), porque é a parte mais propensa a ajustes (Prisma 7 + bundle do Nx).

**`.env.example`:**

```dotenv
# Banco (local: localhost / docker compose: sobrescrito para o host "postgres")
POSTGRES_USER=cpfpdf
POSTGRES_PASSWORD=cpfpdf
POSTGRES_DB=cpfpdf
DATABASE_URL=postgresql://cpfpdf:cpfpdf@localhost:5432/cpfpdf

# Auth
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio

# Seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
```

---

## Components and Interfaces

### Shared Lib (`libs/shared`)

```typescript
// libs/shared/src/enums/role.ts
// Objeto const + union em vez de enum: compatível direto com o enum gerado pelo Prisma ('ADMIN' | 'USER')
export const Role = { ADMIN: 'ADMIN', USER: 'USER' } as const;
export type Role = (typeof Role)[keyof typeof Role];

// libs/shared/src/contracts/auth.contract.ts
export interface RegisterRequest { name: string; email: string; cpf: string; password: string; }
export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { accessToken: string; }
export interface PublicUser { id: string; name: string; email: string; role: Role; }

// libs/shared/src/contracts/document.contract.ts
export interface DocumentSummary { id: string; title: string; description: string | null; }
export interface DocumentDetail extends DocumentSummary { content: string; createdAt: string; }
export interface CreateDocumentRequest { title: string; description?: string; content: string; }
export type UpdateDocumentRequest = Partial<CreateDocumentRequest>;

// libs/shared/src/contracts/user.contract.ts
export interface UserListItem extends PublicUser { cpf: string; } // sempre mascarado

// libs/shared/src/cpf/cpf.utils.ts
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCpf(raw: string): boolean {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);
  // pesos: 10..2 para o 1º verificador, 11..2 para o 2º
  const checkDigit = (length: number) => {
    const sum = digits.slice(0, length).reduce((acc, d, i) => acc + d * (length + 1 - i), 0);
    return ((sum * 10) % 11) % 10;
  };

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export function formatCpf(raw: string): string {
  return normalizeCpf(raw).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** 52998224725 -> 529.***.***-25 */
export function maskCpf(raw: string): string {
  const cpf = normalizeCpf(raw);
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}

/** 52998224725 -> 529-25 (usado no nome do arquivo) */
export function partialCpf(raw: string): string {
  const cpf = normalizeCpf(raw);
  return `${cpf.slice(0, 3)}-${cpf.slice(9)}`;
}
```

### Erros de Domínio

Casos de uso lançam erros de domínio; **nunca** `NotFoundException`/`UnauthorizedException` do NestJS. A tradução para HTTP acontece só no `DomainExceptionFilter`.

```typescript
// domain/errors/domain.error.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

// domain/errors/document-not-found.error.ts
export class DocumentNotFoundError extends DomainError {
  readonly code = 'DOCUMENT_NOT_FOUND';
  constructor() {
    super('Documento não encontrado');
  }
}

// Demais erros seguem o mesmo formato:
// InvalidCpfError, EmailOrCpfAlreadyInUseError, InvalidCredentialsError,
// UserNotFoundError, PdfGenerationError, DownloadLogPersistenceError

// presentation/filters/domain-exception.filter.ts
const STATUS_BY_CODE: Record<string, HttpStatus> = {
  INVALID_CPF: HttpStatus.BAD_REQUEST,
  EMAIL_OR_CPF_IN_USE: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  DOCUMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  PDF_GENERATION_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  DOWNLOAD_LOG_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
};

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS_BY_CODE[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logger.error(error.message, error.cause);

    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      code: error.code,
      message: error.message,   // mensagem amigável; a causa técnica só vai para o log
    });
  }
}
```

### Ports (Interfaces do Domínio)

```typescript
// domain/ports/repositories/user.repository.port.ts
export interface NewUser { name: string; email: string; cpf: Cpf; passwordHash: string; role: Role; }

export interface UserRepositoryPort {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByCpf(cpf: Cpf): Promise<UserEntity | null>;
  create(data: NewUser): Promise<UserEntity>;   // lança EmailOrCpfAlreadyInUseError em P2002
  findAll(): Promise<UserEntity[]>;
}

// domain/ports/repositories/document.repository.port.ts
export interface DocumentRepositoryPort {
  findActiveById(id: string): Promise<DocumentEntity | null>;
  findAllActive(): Promise<DocumentEntity[]>;
  create(data: NewDocument): Promise<DocumentEntity>;
  update(id: string, data: Partial<NewDocument>): Promise<DocumentEntity | null>;
  deactivate(id: string): Promise<boolean>;
}

// domain/ports/repositories/download-log.repository.port.ts
export interface DownloadLogRepositoryPort {
  save(data: { userId: string; documentId: string }): Promise<void>;
}

// domain/ports/services/pdf-generator.port.ts
export interface PdfGenerationOptions { title: string; content: string; userCpf: string; userName: string; }
export interface PdfGeneratorPort {
  generate(options: PdfGenerationOptions): Promise<Buffer>;
}

// domain/ports/services/hash.port.ts
export interface HashPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hashed: string): Promise<boolean>;
}

// domain/ports/services/token.port.ts
export interface TokenPayload { sub: string; email: string; role: Role; }
export interface TokenPort {
  sign(payload: TokenPayload): Promise<string>;
}
```

### Value Object — CPF

```typescript
// domain/value-objects/cpf.ts
import { formatCpf, isValidCpf, maskCpf, normalizeCpf, partialCpf } from '@cpf-pdf/shared';
import { InvalidCpfError } from '../errors';

export class Cpf {
  private constructor(private readonly value: string) {}

  static create(raw: string): Cpf {
    if (!isValidCpf(raw)) throw new InvalidCpfError();
    return new Cpf(normalizeCpf(raw));
  }

  formatted(): string { return formatCpf(this.value); }  // 529.982.247-25
  masked(): string { return maskCpf(this.value); }        // 529.***.***-25
  partial(): string { return partialCpf(this.value); }    // 529-25
  toString(): string { return this.value; }               // 52998224725
}
```

### Casos de Uso Principais

Classes puras, sem `@Injectable()` nem `@Inject()`. A injeção é feita por `useFactory` no composition root.

```typescript
// application/use-cases/auth/register-user.use-case.ts
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

    // se duas requisições passarem juntas pela checagem acima, o repositório
    // converte o P2002 do banco em EmailOrCpfAlreadyInUseError (Req 1.8)
    return this.userRepo.create({
      name: input.name,
      email: input.email,
      cpf,
      passwordHash: await this.hash.hash(input.password),
      role: Role.USER,
    });
  }
}

// application/use-cases/auth/authenticate-user.use-case.ts
export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly hash: HashPort,
    private readonly token: TokenPort,
  ) {}

  async execute(input: LoginRequest): Promise<LoginResponse> {
    const user = await this.userRepo.findByEmail(input.email);
    const valid = user !== null && (await this.hash.compare(input.password, user.passwordHash));
    if (!user || !valid) throw new InvalidCredentialsError();

    const accessToken = await this.token.sign({ sub: user.id, email: user.email, role: user.role });
    return { accessToken };
  }
}

// application/use-cases/document/generate-personalized-pdf.use-case.ts
export interface PersonalizedPdf { buffer: Buffer; fileName: string; }

export class GeneratePersonalizedPdfUseCase {
  constructor(
    private readonly documentRepo: DocumentRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly logRepo: DownloadLogRepositoryPort,
    private readonly pdfGenerator: PdfGeneratorPort,
  ) {}

  async execute(documentId: string, userId: string): Promise<PersonalizedPdf> {
    const document = await this.documentRepo.findActiveById(documentId);
    if (!document) throw new DocumentNotFoundError();

    const user = await this.userRepo.findById(userId);
    if (!user) throw new UserNotFoundError();

    let buffer: Buffer;
    try {
      buffer = await this.pdfGenerator.generate({
        title: document.title,
        content: document.content,
        userCpf: user.cpf.formatted(),
        userName: user.name,
      });
    } catch (cause) {
      throw new PdfGenerationError({ cause });   // nenhum log gravado (Req 8.2)
    }

    try {
      await this.logRepo.save({ userId, documentId });   // antes de devolver (Req 8.3)
    } catch (cause) {
      throw new DownloadLogPersistenceError({ cause });  // PDF não sai (Req 8.4)
    }

    return { buffer, fileName: `documento-${document.id}-${user.cpf.partial()}.pdf` };
  }
}
```

### Composition Root (NestJS)

```typescript
// modules/tokens.ts
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');
export const DOWNLOAD_LOG_REPOSITORY = Symbol('DOWNLOAD_LOG_REPOSITORY');
export const PDF_GENERATOR = Symbol('PDF_GENERATOR');
export const HASH_SERVICE = Symbol('HASH_SERVICE');
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

// modules/database.module.ts
@Global()
@Module({
  providers: [
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: DOWNLOAD_LOG_REPOSITORY, useClass: PrismaDownloadLogRepository },
  ],
  exports: [USER_REPOSITORY, DOCUMENT_REPOSITORY, DOWNLOAD_LOG_REPOSITORY],
})
export class DatabaseModule {}

// modules/document.module.ts
@Module({
  controllers: [DocumentController],
  providers: [
    { provide: PDF_GENERATOR, useClass: PdfKitGeneratorAdapter },
    {
      provide: GeneratePersonalizedPdfUseCase,
      useFactory: (
        documents: DocumentRepositoryPort,
        users: UserRepositoryPort,
        logs: DownloadLogRepositoryPort,
        pdf: PdfGeneratorPort,
      ) => new GeneratePersonalizedPdfUseCase(documents, users, logs, pdf),
      inject: [DOCUMENT_REPOSITORY, USER_REPOSITORY, DOWNLOAD_LOG_REPOSITORY, PDF_GENERATOR],
    },
    // ...demais casos de uso no mesmo formato
  ],
})
export class DocumentModule {}

// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  await app.listen(3000);
}
```

### Controller de Documentos

```typescript
// presentation/controllers/document.controller.ts
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)   // ordem importa: 401 antes de 403 (Req 4.2)
export class DocumentController {
  constructor(private readonly generatePdf: GeneratePersonalizedPdfUseCase) {}

  @Get(':id/pdf')
  @Roles(Role.USER, Role.ADMIN)
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<StreamableFile> {
    const pdf = await this.generatePdf.execute(id, user.sub);   // sempre o usuário do token (Req 7.3)
    return new StreamableFile(pdf.buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${pdf.fileName}"`,
    });
  }
}
```

### Adapter PDFKit

Correção importante em relação à versão anterior: escrever o carimbo no evento `pageAdded` com texto abaixo da margem inferior faz o PDFKit criar páginas novas (páginas em branco / loop) e deixa o cursor no fim da página, empurrando o conteúdo. A solução é **escrever o conteúdo primeiro** e **carimbar depois**, página por página, com a margem inferior zerada temporariamente.

```typescript
// infrastructure/pdf/pdfkit-generator.adapter.ts
import PDFDocument from 'pdfkit';

const STAMP_COLOR = '#888888';
const LINE_COLOR = '#cccccc';

@Injectable()
export class PdfKitGeneratorAdapter implements PdfGeneratorPort {
  generate(options: PdfGenerationOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // margem 60 deixa o conteúdo longe das faixas de cabeçalho (y 20–35) e rodapé (height-35 em diante)
      const doc = new PDFDocument({ size: 'A4', margin: 60, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // 1) Conteúdo — o PDFKit quebra páginas sozinho quando o texto não cabe
      doc.fontSize(18).fillColor('#000000').text(options.title, { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).text(options.content, { align: 'left', lineGap: 5 });

      // 2) Carimbo em todas as páginas já existentes
      const stamp = `CPF: ${options.userCpf} | ${options.userName}`;
      const { start, count } = doc.bufferedPageRange();

      for (let i = start; i < start + count; i++) {
        doc.switchToPage(i);
        const { width, height, margins } = doc.page;
        const originalBottom = margins.bottom;
        margins.bottom = 0;   // impede que o texto do rodapé dispare uma página nova

        doc.fontSize(8).fillColor(STAMP_COLOR);
        doc.text(stamp, 50, 20, { width: width - 100, align: 'center' });
        doc.moveTo(50, 35).lineTo(width - 50, 35).strokeColor(LINE_COLOR).stroke();
        doc.moveTo(50, height - 35).lineTo(width - 50, height - 35).strokeColor(LINE_COLOR).stroke();
        doc.text(stamp, 50, height - 25, { width: width - 100, align: 'center' });

        margins.bottom = originalBottom;
      }

      doc.end();   // end() já faz o flush das páginas bufferizadas
    });
  }
}
```

### Prisma 7

```typescript
// apps/api/prisma.config.ts
// Caminhos são relativos a ESTE arquivo. Os comandos rodam pela raiz (targets do Nx),
// então o dotenv encontra o .env da raiz.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

// apps/api/src/infrastructure/database/prisma.service.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  onModuleInit() { return this.$connect(); }
  onModuleDestroy() { return this.$disconnect(); }
}
```

Targets no `apps/api/project.json`:

```json
{
  "targets": {
    "prisma-generate": { "command": "prisma generate --config apps/api/prisma.config.ts" },
    "prisma-migrate": { "command": "prisma migrate dev --config apps/api/prisma.config.ts" },
    "prisma-seed": { "command": "prisma db seed --config apps/api/prisma.config.ts" }
  }
}
```

### Angular 21 — Componentes Modernos

Convenções: sem `standalone: true` (padrão), `ChangeDetectionStrategy.OnPush`, `inject()` em vez de construtor, `input()`/`output()`, Reactive Forms, control flow nativo, zoneless (padrão no v21).

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};

// app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'documents', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register').then(m => m.Register) },
    ],
  },
  {
    path: 'documents',
    canActivate: [authGuard],
    loadComponent: () => import('./features/documents/document-list/document-list').then(m => m.DocumentList),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(Role.ADMIN)],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes),
  },
  { path: '**', redirectTo: 'documents' },
];

// core/auth/auth.service.ts
const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly token = this.tokenSignal.asReadonly();
  readonly session = computed(() => decodeJwtPayload(this.tokenSignal()));   // { sub, email, role, exp } | null
  readonly isAdmin = computed(() => this.session()?.role === Role.ADMIN);

  login(credentials: LoginRequest): Observable<void> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
      map(({ accessToken }) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        this.tokenSignal.set(accessToken);
      }),
    );
  }

  /** Checado na hora da navegação — um computed não reavalia sozinho quando o token expira. */
  hasValidToken(): boolean {
    const exp = this.session()?.exp;
    return exp !== undefined && exp * 1000 > Date.now();
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }
}

// core/auth/auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthEndpoint = req.url.startsWith('/api/auth/');
  const token = auth.token();

  const request = token && !isAuthEndpoint
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // 401 no login é "senha errada", não "sessão expirada" — deixa o formulário tratar (Req 3.8)
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint) {
        auth.logout();
        void router.navigateByUrl('/auth/login');
      }
      return throwError(() => error);
    }),
  );
};

// core/auth/auth.guard.ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasValidToken()) return true;
  auth.logout();
  return router.parseUrl('/auth/login');
};

export const roleGuard = (role: Role): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.session()?.role === role || router.parseUrl('/documents');
};

// features/documents/document-list/document-list.ts
@Component({
  selector: 'app-document-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <h1>Documentos disponíveis</h1>

    @if (documents.isLoading()) {
      <mat-spinner aria-label="Carregando documentos" />
    } @else if (documents.error()) {
      <p role="alert">Não foi possível carregar os documentos.</p>
      <button mat-button (click)="documents.reload()">Tentar novamente</button>
    } @else {
      <div class="grid">
        @for (doc of documents.value(); track doc.id) {
          <mat-card>
            <mat-card-header><mat-card-title>{{ doc.title }}</mat-card-title></mat-card-header>
            <mat-card-content>{{ doc.description }}</mat-card-content>
            <mat-card-actions>
              <button mat-flat-button [disabled]="downloadingId() === doc.id" (click)="download(doc.id)">
                Baixar PDF
              </button>
            </mat-card-actions>
          </mat-card>
        } @empty {
          <p>Nenhum documento disponível no momento.</p>
        }
      </div>
    }
  `,
  styles: `
    .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    @media (min-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 960px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  `,
})
export class DocumentList {
  private readonly documentService = inject(DocumentService);

  protected readonly documents = httpResource<DocumentSummary[]>(() => '/api/documents', { defaultValue: [] });
  protected readonly downloadingId = signal<string | null>(null);

  protected download(id: string): void {
    this.downloadingId.set(id);
    this.documentService.downloadPdf(id)
      .pipe(finalize(() => this.downloadingId.set(null)))
      .subscribe();
  }
}

// features/documents/document.service.ts
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  downloadPdf(id: string): Observable<void> {
    return this.http
      .get(`/api/documents/${id}/pdf`, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((response) => {
          if (!response.body) throw new Error('PDF vazio');
          const fileName =
            parseFileName(response.headers.get('Content-Disposition')) ?? `documento-${id}.pdf`;

          const url = URL.createObjectURL(response.body);
          const link = this.document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          URL.revokeObjectURL(url);
        }),
      );
  }
}
```

> `httpResource` ainda é marcado como experimental no Angular 21. Se incomodar, a alternativa estável é `toSignal(this.http.get(...))`.

---

## Data Models

### Schema Prisma

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"   // NestJS roda em CommonJS; sem isso: "exports is not defined in ES module scope"
}

datasource db {
  provider = "postgresql"
  // a URL fica no prisma.config.ts (Prisma 7)
}

model User {
  id           String        @id @default(cuid())
  name         String
  email        String        @unique
  cpf          String        @unique   // só dígitos
  passwordHash String
  role         Role          @default(USER)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  downloadLogs DownloadLog[]

  @@map("users")
}

model Document {
  id           String        @id @default(cuid())
  title        String        @db.VarChar(255)
  description  String?       @db.VarChar(1000)
  content      String
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  downloadLogs DownloadLog[]

  @@map("documents")
}

model DownloadLog {
  id         String   @id @default(cuid())
  userId     String
  documentId String
  ipAddress  String?
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  document   Document @relation(fields: [documentId], references: [id])

  @@index([documentId])
  @@index([userId])
  @@map("download_logs")
}

enum Role {
  ADMIN
  USER
}
```

### Entidades do Domínio

```typescript
// domain/entities/user.entity.ts
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly cpf: Cpf,
    public readonly passwordHash: string,
    public readonly role: Role,
    public readonly createdAt: Date,
  ) {}
}

// domain/entities/document.entity.ts
export class DocumentEntity {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string | null,
    public readonly content: string,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
  ) {}
}
```

Os repositórios Prisma convertem linha do banco ↔ entidade (ex.: `cpf: string` → `Cpf.create(row.cpf)`). O tipo gerado pelo Prisma é importado com alias (`import type { Document as PrismaDocument } ...`) para não confundir com a entidade.

O `tsconfig.app.json` do `apps/api` deve definir `"lib": ["ES2022"]` (sem `DOM`), para que um `Document` sem import dê erro de compilação em vez de virar o tipo do navegador.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PDF contém exatamente o CPF do usuário solicitante

*Para todo* par (usuário, documento) onde o usuário possui um CPF válido, o texto extraído do PDF gerado deve conter a string `CPF: <cpf_formatado_do_usuario>` e nunca o CPF formatado de qualquer outro usuário registrado no sistema.

**Validates: Requirements 7.2, 7.3**

---

### Property 2: Validação dos dígitos verificadores do CPF

*Para todo* CPF de 11 dígitos, `isValidCpf()` deve retornar `true` se e somente se ambos os dígitos verificadores passam pelo algoritmo módulo 11, e `false` para qualquer sequência onde todos os dígitos são iguais.

**Validates: Requirements 2.1, 2.2**

---

### Property 3: CPF válido sempre produz formato correto

*Para todo* CPF que passa na validação, `formatted()` deve retornar uma string que corresponde ao padrão `^\d{3}\.\d{3}\.\d{3}-\d{2}$`.

**Validates: Requirements 2.4**

---

### Property 4: Senhas jamais são armazenadas em texto puro

*Para todo* usuário criado com qualquer senha, o `passwordHash` persistido nunca deve ser igual à senha em texto plano, e `compare(senha, hash)` deve retornar `true`.

**Validates: Requirements 1.5**

---

### Property 5: Unicidade de email e CPF no cadastro

*Para todo* par de tentativas de cadastro com o mesmo email ou o mesmo CPF, a segunda requisição deve sempre ser rejeitada com HTTP 409 — inclusive quando a violação só é detectada pela restrição única do banco.

**Validates: Requirements 1.3, 1.4, 1.8**

---

### Property 6: Download Log criado exatamente uma vez por geração bem-sucedida

*Para todo* download de PDF concluído com sucesso, deve existir exatamente um registro em `download_logs` vinculando o `userId` ao `documentId`; nenhum registro deve ser criado quando a geração do PDF falha.

**Validates: Requirements 8.1, 8.2**

---

### Property 7: Isolamento de roles — usuário USER não acessa endpoints ADMIN

*Para todo* token JWT com `role = USER`, qualquer requisição aos endpoints `POST /documents`, `PATCH /documents/:id`, `DELETE /documents/:id` e `GET /users` deve ser rejeitada com HTTP 403, independentemente do conteúdo da requisição.

**Validates: Requirements 4.1, 4.4**

---

### Property 8: Listagem de documentos retorna somente registros ativos

*Para qualquer* conjunto de documentos (com variações de `isActive`), a resposta de `GET /documents` deve conter apenas documentos onde `isActive = true`.

**Validates: Requirements 5.5, 6.1**

---

### Property 9: JWT gerado no login contém os campos obrigatórios

*Para todo* usuário registrado que realiza login com credenciais corretas, o payload decodificado do token deve conter `sub`, `email`, `role` e `exp`, com `exp - iat ≤ 24h`.

**Validates: Requirements 3.1, 3.5**

---

### Property 10: Carimbo em todas as páginas, sem páginas extras

*Para todo* conteúdo de tamanho arbitrário (de 1 linha a dezenas de páginas), cada página do PDF gerado deve conter o carimbo duas vezes (cabeçalho e rodapé), e o número de páginas deve ser igual ao do mesmo conteúdo gerado sem carimbo.

**Validates: Requirements 7.2, 7.4**

---

### Property 11: CPF mascarado e parcial nunca expõem os dígitos do meio

*Para todo* CPF válido, `maskCpf()` deve corresponder a `^\d{3}\.\*{3}\.\*{3}-\d{2}$` e `partialCpf()` a `^\d{3}-\d{2}$`, e nenhum dos dois deve conter os dígitos das posições 4 a 9.

**Validates: Requirements 7.7, 9.1**

---

## Error Handling

| Situação | Erro de domínio | HTTP | Mensagem |
|---|---|---|---|
| Campos ausentes/inválidos no body | — (`ValidationPipe`) | 400 | Lista dos campos inválidos |
| CPF inválido no cadastro | `InvalidCpfError` | 400 | "CPF inválido" |
| Credenciais inválidas (login) | `InvalidCredentialsError` | 401 | "Credenciais inválidas" |
| Token JWT ausente ou expirado | — (`JwtAuthGuard`) | 401 | "Unauthorized" |
| Acesso a rota sem permissão de role | — (`RolesGuard`) | 403 | "Forbidden" |
| Documento não encontrado ou inativo | `DocumentNotFoundError` | 404 | "Documento não encontrado" |
| Usuário não encontrado | `UserNotFoundError` | 404 | "Usuário não encontrado" |
| Email ou CPF duplicado (inclusive P2002) | `EmailOrCpfAlreadyInUseError` | 409 | "Email ou CPF já cadastrado" |
| Erro interno na geração do PDF | `PdfGenerationError` | 500 | "Erro ao gerar PDF" |
| Falha ao salvar o log de download | `DownloadLogPersistenceError` | 500 | "Erro ao registrar download" |

No Angular, o `authInterceptor` trata 401 de endpoints protegidos (logout + redirect). Erros de formulário (401 no login, 400/409 no cadastro) são exibidos pelos próprios componentes com `mat-error` / `MatSnackBar`.

---

## Testing Strategy

| Camada | Tipo | Ferramenta | Foco |
|---|---|---|---|
| `libs/shared` (cpf utils) | Unit + property | Vitest + fast-check | Properties 2, 3, 11 |
| Value Object `Cpf` | Unit | Jest | `create()` lança `InvalidCpfError` |
| Casos de uso | Unit (mocks dos ports) | Jest (+ fast-check) | Lógica de negócio isolada, Properties 5, 6, 8 |
| `PdfKitGeneratorAdapter` | Integration | Jest + `pdf-parse` | Properties 1, 10 |
| `BcryptHashAdapter` / `JwtTokenAdapter` | Unit | Jest | Properties 4, 9 |
| Repositórios Prisma | Integration | Jest + Postgres de teste | Queries, mapeamento, P2002 → 409 |
| Controllers + guards | e2e | Supertest + NestJS TestingModule | Fluxo HTTP, Property 7 |
| Componentes Angular | Unit | Vitest + Angular Testing Library | Renderização e interações |
| Services / interceptor Angular | Unit | Vitest + `HttpTestingController` | Headers, 401 com e sem redirect |

**Notas:**

- **Texto do PDF:** não dá para buscar `CPF: ...` direto no buffer — o PDFKit comprime os streams e codifica o texto. Extraia com `pdf-parse` (texto e número de páginas).
- **Gerador de CPF válido (fast-check):** gere 9 dígitos aleatórios, descarte sequências de dígitos iguais e calcule os 2 verificadores. Para inválidos, altere um dos verificadores.

**Exemplo — teste unitário de caso de uso:**

```typescript
describe('GeneratePersonalizedPdfUseCase', () => {
  const cpf = Cpf.create('52998224725');
  const user = new UserEntity('u1', 'João', 'joao@example.com', cpf, 'hash', Role.USER, new Date());
  const doc = new DocumentEntity('d1', 'Apostila', null, 'Conteúdo...', true, new Date());

  const makeSut = () => {
    const documentRepo = { findActiveById: jest.fn().mockResolvedValue(doc) };
    const userRepo = { findById: jest.fn().mockResolvedValue(user) };
    const logRepo = { save: jest.fn().mockResolvedValue(undefined) };
    const pdf = { generate: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    const sut = new GeneratePersonalizedPdfUseCase(
      documentRepo as unknown as DocumentRepositoryPort,
      userRepo as unknown as UserRepositoryPort,
      logRepo,
      pdf,
    );
    return { sut, logRepo, pdf };
  };

  it('usa o CPF formatado do usuário e grava um log', async () => {
    const { sut, logRepo, pdf } = makeSut();

    const result = await sut.execute('d1', 'u1');

    expect(pdf.generate).toHaveBeenCalledWith(expect.objectContaining({ userCpf: '529.982.247-25' }));
    expect(logRepo.save).toHaveBeenCalledTimes(1);
    expect(result.fileName).toBe('documento-d1-529-25.pdf');
  });

  it('não grava log quando a geração falha', async () => {
    const { sut, logRepo, pdf } = makeSut();
    pdf.generate.mockRejectedValue(new Error('boom'));

    await expect(sut.execute('d1', 'u1')).rejects.toBeInstanceOf(PdfGenerationError);
    expect(logRepo.save).not.toHaveBeenCalled();
  });
});
```
