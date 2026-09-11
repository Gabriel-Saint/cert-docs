# Implementation Plan: CPF PDF Watermark Generator

## Overview

Sistema web para geração de PDFs personalizados com CPF do usuário no cabeçalho/rodapé. Monorepo Nx com `apps/web` (Angular 21 + Angular Material), `apps/api` (NestJS hexagonal + Prisma 7 + PDFKit + JWT) e `libs/shared`, com Docker Compose para rodar tudo localmente.

O plano é organizado em **fatias verticais**: cada fatia entrega uma funcionalidade funcionando de ponta a ponta (banco → API → tela). Assim o repositório está sempre rodando e cada commit tem algo visível.

## Convenções de Commit

- Formato [Conventional Commits](https://www.conventionalcommits.org/): `tipo(escopo): descrição no imperativo`
- Tipos: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`, `build`
- Escopos: `api`, `web`, `shared`, `infra`
- Um commit por subtarefa (sugestão em cada uma) e push ao final de cada subtarefa
- Opcional (boa prática): uma branch por fatia (`feat/auth`, `feat/documents`...) com Pull Request para `main`

## Tasks

- [ ] 1. Fundação do repositório
  - [ ] 1.1 Preparar pasta e Git
    - Mover o projeto para fora do OneDrive, num caminho sem espaços nem acentos (ex.: `C:\dev\cpf-pdf-watermark-generator`) — o OneDrive sincronizando `node_modules` e `.nx/cache` causa lentidão e arquivos travados, e alguns tools falham com `Área de Trabalho` no caminho
    - `git init`, branch `main`, criar repositório no GitHub e fazer o primeiro push com a pasta `.kiro`
    - _Commit: `docs: add project specs`_
    - _Requirements: 14.4_

  - [x] 1.2 Criar workspace Nx
    - `npx create-nx-workspace@latest` (npm), conferir na documentação do Nx a compatibilidade da versão com Angular 21
    - Gerar `apps/web` (Angular, SCSS, Vitest), `apps/api` (NestJS, Jest) e `libs/shared` (lib TypeScript pura, Vitest, sem dependências)
    - Confirmar o alias `@cpf-pdf/shared` no `tsconfig.base.json`
    - Em `apps/api/tsconfig.app.json`, definir `"lib": ["ES2022"]` (sem `DOM`)
    - Garantir que `nx run-many -t lint test build` passa no projeto vazio
    - _Commit: `chore: scaffold nx workspace with web, api and shared`_
    - _Requirements: Architecture overview_

  - [x] 1.3 Ambiente local e arquivos do repositório
    - `docker-compose.yml` inicial só com `postgres` (imagem `postgres:16-alpine`, volume nomeado, healthcheck)
    - `.env.example` e `.env` local; completar o `.gitignore` (`node_modules`, `dist`, `coverage`, `.env`, `.nx/cache`, `.nx/workspace-data`, `apps/api/src/generated`)
    - `README.md` inicial: descrição, stack e como subir o banco
    - _Commit: `chore(infra): add postgres compose, env example and readme`_
    - _Requirements: 12.5, 12.7, 12.8, 12.9, 14.3, 14.4_

  - [x] 1.4 Configurar Prisma 7 na api
    - Instalar `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`, `tsx`
    - Criar `apps/api/prisma/schema.prisma` (generator `prisma-client`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`) com User, Document, DownloadLog e Role
    - Criar `apps/api/prisma.config.ts` e os targets `prisma-generate`, `prisma-migrate` e `prisma-seed` no `project.json`
    - Rodar a migration inicial
    - Criar `PrismaService` (com `PrismaPg`) e `DatabaseModule`
    - _Commit: `feat(api): configure prisma 7 with initial schema`_
    - _Requirements: Data Models, 1.5_

  - [x] 1.5 Bootstrap da API e proxy do front
    - `main.ts`: `setGlobalPrefix('api')` e `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
    - `ConfigModule` com validação de `DATABASE_URL` e `JWT_SECRET` na inicialização
    - `apps/web/proxy.conf.json` (`/api` → `http://localhost:3000`) configurado no target `serve`
    - `provideHttpClient(withInterceptors([]))` no `app.config.ts`
    - _Commit: `feat: add api global prefix, validation and dev proxy`_
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 2. Fatia 1 — Autenticação (api + web)
  - [x] 2.1 Shared: Role, contratos de auth e utilitários de CPF
    - `Role` (objeto const + union type)
    - `RegisterRequest`, `LoginRequest`, `LoginResponse`, `PublicUser`
    - `normalizeCpf`, `isValidCpf`, `formatCpf`, `maskCpf`, `partialCpf`
    - _Commit: `feat(shared): add role, auth contracts and cpf utils`_
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [x]* 2.2 Property tests dos utilitários de CPF
    - Instalar `fast-check`; criar arbitrary de CPF válido (9 dígitos + verificadores calculados)
    - **Property 2: Validação dos dígitos verificadores do CPF**
    - **Property 3: CPF válido sempre produz formato correto**
    - **Property 11: CPF mascarado e parcial nunca expõem os dígitos do meio**
    - _Commit: `test(shared): add property tests for cpf utils`_
    - **Validates: Requirements 2.1, 2.2, 2.4, 7.7, 9.1**

  - [x] 2.3 Domínio de usuário
    - `DomainError` e erros `InvalidCpfError`, `EmailOrCpfAlreadyInUseError`, `InvalidCredentialsError`, `UserNotFoundError`
    - Value Object `Cpf` (`create`, `formatted`, `masked`, `partial`)
    - `UserEntity`
    - Ports `UserRepositoryPort`, `HashPort`, `TokenPort`
    - _Commit: `feat(api): add user domain, cpf value object and ports`_
    - _Requirements: 1.1, 1.5, 2.3, 3.1_

  - [x] 2.4 Infraestrutura de usuário e segurança
    - `PrismaUserRepository` (mapeia linha ↔ entidade; converte `P2002` em `EmailOrCpfAlreadyInUseError`)
    - `BcryptHashAdapter`
    - `JwtTokenAdapter` com `JwtModule` configurado para expirar em `24h`
    - _Commit: `feat(api): add prisma user repository, bcrypt and jwt adapters`_
    - _Requirements: 1.5, 1.8, 3.1, 3.5_

  - [x]* 2.5 Testes dos adapters de segurança
    - **Property 4: Senhas jamais são armazenadas em texto puro**
    - **Property 9: JWT gerado no login contém os campos obrigatórios**
    - _Commit: `test(api): add hash and token adapter tests`_
    - **Validates: Requirements 1.5, 3.1, 3.5**

  - [x] 2.6 Casos de uso de autenticação
    - `RegisterUserUseCase` (valida CPF, checa unicidade, gera hash, role `USER`)
    - `AuthenticateUserUseCase` (mesma mensagem para email inexistente e senha errada)
    - Classes puras, sem decorators do NestJS
    - _Commit: `feat(api): add register and authenticate use cases`_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2_

  - [x]* 2.7 Testes dos casos de uso de autenticação
    - **Property 5: Unicidade de email e CPF no cadastro**
    - Teste de credenciais inválidas (email inexistente e senha errada retornam o mesmo erro)
    - _Commit: `test(api): add auth use case tests`_
    - **Validates: Requirements 1.3, 1.4, 1.8, 3.2**

  - [x] 2.8 Camada de apresentação de autenticação
    - `RegisterDto` e `LoginDto` com `class-validator` (limites de tamanho do Req 1.7), implementando os contratos da shared
    - `AuthController` (`POST /auth/register` retorna `PublicUser`, `POST /auth/login` retorna `LoginResponse`)
    - `DomainExceptionFilter` registrado globalmente
    - `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()`
    - `AuthModule` com `useFactory` ligando casos de uso aos adapters
    - Testar manualmente com um client HTTP (Insomnia, Bruno ou `.http` do VS Code)
    - _Commit: `feat(api): add auth controller, guards and domain exception filter`_
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.9, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

  - [ ] 2.9 Web: núcleo, Material e shell responsivo
    - Instalar e configurar Angular Material (tema) e Angular CDK
    - `AuthService` com signals (`token`, `session`, `isAdmin`, `hasValidToken`, `logout`)
    - `authInterceptor` (Bearer em endpoints protegidos; 401 → logout + redirect, exceto `/api/auth/*`)
    - `authGuard` e `roleGuard`
    - Shell: `mat-toolbar` com links no desktop e `mat-sidenav` com hambúrguer no mobile (`BreakpointObserver`); botão "Sair"; links de admin só com `isAdmin()`
    - _Commit: `feat(web): add auth service, interceptor, guards and responsive shell`_
    - _Requirements: 3.6, 3.7, 3.8, 10.1, 10.5, 10.6, 10.7, 10.9, 11.1, 11.3, 11.5_

  - [ ] 2.10 Web: telas de login e cadastro
    - Login com Reactive Forms + `mat-form-field`/`matInput`/`mat-button`; erro de credenciais em `mat-error` sem limpar o email; redirect para `/documents`
    - Cadastro com validador de CPF usando `isValidCpf` da shared; 400/409 exibidos com `MatSnackBar`
    - Campos 100% de largura, botões com altura mínima de 44px
    - _Commit: `feat(web): add login and register pages`_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.5, 10.2, 10.3, 10.4, 10.8, 11.4_

  - [ ] 2.11 Checkpoint — Autenticação funcionando
    - Fluxo manual: cadastrar → logar → token no localStorage → rota protegida acessível → sair → rota protegida redireciona
    - Testes passando (`npm run ci`); atualizar o README com o fluxo
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 3. Fatia 2 — Listagem de documentos
  - [x] 3.1 Shared: contratos de documento
    - `DocumentSummary`, `DocumentDetail`, `CreateDocumentRequest`, `UpdateDocumentRequest`
    - _Commit: `feat(shared): add document contracts`_
    - _Requirements: 5.1, 6.1_

  - [x] 3.2 Domínio de documento
    - `DocumentEntity`, `DocumentNotFoundError`, `DocumentRepositoryPort`
    - _Commit: `feat(api): add document domain`_
    - _Requirements: 5.4, 5.5_

  - [x] 3.3 Repositório Prisma de documentos
    - `PrismaDocumentRepository` (`findActiveById`, `findAllActive`, `create`, `update`, `deactivate`)
    - _Commit: `feat(api): add prisma document repository`_
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 3.4 Casos de uso de leitura
    - `ListDocumentsUseCase` (só ativos) e `GetDocumentUseCase` (404 para inexistente ou inativo)
    - _Commit: `feat(api): add list and get document use cases`_
    - _Requirements: 5.4, 5.5, 6.1_

  - [x]* 3.5 Property test da listagem
    - **Property 8: Listagem de documentos retorna somente registros ativos**
    - _Commit: `test(api): add property test for active documents listing`_
    - **Validates: Requirements 5.5, 6.1**

  - [x] 3.6 Endpoints de leitura
    - `DocumentController` com `GET /documents` e `GET /documents/:id` (`@Roles(Role.USER, Role.ADMIN)`)
    - `DocumentModule`
    - _Commit: `feat(api): add document read endpoints`_
    - _Requirements: 4.5, 5.4, 5.5, 6.1, 6.2_

  - [x] 3.7 Seed do banco
    - `apps/api/prisma/seed.ts`: ADMIN a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` e 3–5 documentos de exemplo (um com conteúdo longo, para testar várias páginas no PDF)
    - Usar `upsert` para ser idempotente
    - _Commit: `feat(api): add idempotent database seed`_
    - _Requirements: 13.6_

  - [ ] 3.8 Web: lista de documentos
    - `DocumentList` com `httpResource`, `mat-spinner` no carregamento, erro com "Tentar novamente", estado vazio
    - Cards `mat-card` em grid responsivo (1/2/3 colunas)
    - _Commit: `feat(web): add responsive document list`_
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 11.2_

  - [ ] 3.9 Checkpoint — Listagem funcionando
    - Rodar o seed, logar e ver os documentos em mobile, tablet e desktop (DevTools)
    - Testes passando (`npm run ci`)
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 4. Fatia 3 — PDF personalizado
  - [x] 4.1 Domínio de download e PDF
    - `DownloadLogEntity`, `DownloadLogRepositoryPort`, `PdfGeneratorPort`
    - `PdfGenerationError`, `DownloadLogPersistenceError`
    - _Commit: `feat(api): add pdf and download log domain`_
    - _Requirements: 7.1, 8.1_

  - [x] 4.2 Adapters de PDF e log
    - `PdfKitGeneratorAdapter`: conteúdo primeiro, depois carimbo em cada página via `bufferedPageRange` + `switchToPage`, com `margins.bottom = 0` durante o carimbo
    - `PrismaDownloadLogRepository`
    - _Commit: `feat(api): add pdfkit generator and download log repository`_
    - _Requirements: 7.2, 7.4, 8.1_

  - [x]* 4.3 Testes do gerador de PDF
    - Instalar `pdf-parse` para extrair texto e contar páginas
    - **Property 1: PDF contém exatamente o CPF do usuário solicitante**
    - **Property 10: Carimbo em todas as páginas, sem páginas extras**
    - _Commit: `test(api): add pdf generator tests`_
    - **Validates: Requirements 7.2, 7.3, 7.4**

  - [x] 4.4 Caso de uso GeneratePersonalizedPdf
    - Busca documento ativo e usuário, gera PDF, salva log antes de retornar, monta `fileName` com CPF parcial
    - _Commit: `feat(api): add generate personalized pdf use case`_
    - _Requirements: 7.1, 7.3, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4_

  - [x]* 4.5 Testes do log de download
    - **Property 6: Download Log criado exatamente uma vez por geração bem-sucedida**
    - Caso de falha ao salvar o log (PDF não é retornado)
    - _Commit: `test(api): add download log tests`_
    - **Validates: Requirements 8.1, 8.2, 8.4**

  - [x] 4.6 Endpoint de download
    - `GET /documents/:id/pdf` retornando `StreamableFile` com `Content-Type` e `Content-Disposition`
    - _Commit: `feat(api): add pdf download endpoint`_
    - _Requirements: 4.5, 7.1, 7.5, 7.6, 7.7_

  - [ ] 4.7 Web: download do PDF
    - `DocumentService.downloadPdf` com `observe: 'response'` + `responseType: 'blob'`, lendo o nome do arquivo do `Content-Disposition`
    - Botão desabilitado enquanto baixa
    - _Commit: `feat(web): add personalized pdf download`_
    - _Requirements: 7.8_

  - [ ] 4.8 Checkpoint — PDF funcionando
    - Baixar o documento longo e conferir: carimbo em todas as páginas, sem páginas em branco, nome do arquivo correto, registro em `download_logs`
    - Testes passando (`npm run ci`)
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 5. Fatia 4 — Área administrativa
  - [x] 5.1 Casos de uso de administração
    - `CreateDocumentUseCase`, `UpdateDocumentUseCase`, `DeleteDocumentUseCase` (soft delete; 404 para inexistente)
    - `ListUsersUseCase` retornando CPF mascarado e sem `passwordHash`
    - _Commit: `feat(api): add admin use cases`_
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 9.1, 9.2, 9.5_

  - [x] 5.2 Endpoints de administração
    - `POST /documents`, `PATCH /documents/:id`, `DELETE /documents/:id` com `@Roles(Role.ADMIN)` e DTOs validados
    - `UserController` com `GET /users` (`@Roles(Role.ADMIN)`) e `UserModule`
    - _Commit: `feat(api): add admin document and user endpoints`_
    - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.6, 5.7, 9.1, 9.3, 9.4_

  - [x]* 5.3 Testes e2e de autorização
    - Supertest + `TestingModule`
    - **Property 7: Isolamento de roles — usuário USER não acessa endpoints ADMIN**
    - Casos 401 (sem token) antes de 403
    - _Commit: `test(api): add e2e role isolation tests`_
    - **Validates: Requirements 4.1, 4.2, 4.4, 9.3, 9.4**

  - [ ] 5.4 Web: rotas de admin
    - `admin.routes.ts` com lazy loading, protegido por `authGuard` + `roleGuard(Role.ADMIN)`
    - _Commit: `feat(web): add admin routes`_
    - _Requirements: 10.7_

  - [ ] 5.5 Web: gestão de documentos
    - `mat-table` com documentos, formulário de criação/edição (`mat-form-field`, `matInput`, textarea), `MatDialog` para confirmar exclusão
    - _Commit: `feat(web): add admin document management`_
    - _Requirements: 5.1, 5.2, 5.3, 10.7_

  - [ ] 5.6 Web: lista de usuários
    - `mat-table` com CPF mascarado e role em `mat-chip`
    - _Commit: `feat(web): add admin user list`_
    - _Requirements: 9.1, 9.2_

  - [ ] 5.7 Checkpoint — Admin funcionando
    - Logar como ADMIN (seed): criar, editar e excluir documento; ver usuários. Logar como USER: sem links de admin e `/admin` redireciona
    - Testes passando (`npm run ci`)
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 6. Containerização completa
  - [x] 6.1 Dockerfile da api (multi-stage)
    - Stage 1: `npm ci`, `nx run api:prisma-generate`, `nx build api --configuration=production` (`generatePackageJson: true`)
    - Stage 2: `node:22-alpine`, copia `dist/apps/api`, `apps/api/prisma/` e `prisma.config.ts`; instala dependências de produção + `prisma` e `dotenv`
    - `CMD` roda `prisma migrate deploy` e depois `node main.js`
    - _Commit: `build(api): add multi-stage dockerfile`_
    - _Requirements: 12.4, 12.6_

  - [ ] 6.2 Dockerfile e Nginx do web (multi-stage)
    - Stage 1: `nx build web --configuration=production`
    - Stage 2: `nginx:alpine` servindo `dist/apps/web/browser`
    - `nginx.conf`: `location /api/` com `proxy_pass http://api:3000;` (sem barra final) e `try_files $uri $uri/ /index.html`
    - _Commit: `build(web): add multi-stage dockerfile and nginx config`_
    - _Requirements: 12.3_

  - [x] 6.3 `.dockerignore`
    - Excluir `node_modules`, `dist`, `.nx`, `.git`, `.env`, `coverage`
    - _Commit: `build: add dockerignore`_
    - _Requirements: 12.3, 12.4_

  - [ ] 6.4 Docker Compose completo
    - Serviços `postgres`, `api` (depende de `postgres` saudável, `DATABASE_URL` apontando para o host `postgres`) e `web` (porta 80)
    - _Commit: `build(infra): add api and web services to compose`_
    - _Requirements: 12.1, 12.2, 12.5, 12.7_

  - [ ] 6.5 Checkpoint — Docker do zero
    - `docker compose down -v` e `docker compose up --build`: app em `http://localhost`, F5 em `/documents` funciona, download do PDF funciona
    - Documentar no README
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 7. Finalização
  - [ ] 7.1 README final
    - Screenshots/GIF (desktop e mobile), diagrama da arquitetura, decisões técnicas (hexagonal, por que Nx, por que carimbar depois no PDFKit), credenciais do seed
    - _Commit: `docs: complete readme with screenshots and architecture`_
    - _Requirements: 14.3_

  - [ ]* 7.2 Testes end-to-end completos
    - Fluxo cadastro → login → listagem → download (Supertest na api; opcionalmente Playwright no web)
    - _Commit: `test: add end-to-end flow tests`_
    - _Requirements: All_

  - [ ] 7.3 Release v1.0.0
    - Criar tag `v1.0.0` e GitHub Release com resumo das funcionalidades
    - _Requirements: All_

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido — mas são ótimas para praticar testes e deixam o repositório mais forte
- Cada fatia termina com um checkpoint em que o sistema funciona de ponta a ponta
- Domínio e casos de uso não importam `@nestjs/*` nem o cliente Prisma; a ligação é feita nos módulos (`apps/api/src/modules`)
- A `libs/shared` contém só tipos e funções puras — DTOs com `class-validator` ficam na api
- Angular 21: sem `standalone: true` (padrão), `OnPush`, `inject()`, signals, `httpResource`, control flow (`@if`, `@for`)
- Se o Dockerfile da api der trabalho (Prisma 7 + bundle do Nx), vale antecipar a tarefa 6.1 para logo após a fatia 1

### Roadmap v2 (fora do escopo desta spec)

- Upload de PDF real pelo ADMIN e carimbo com `pdf-lib` (novo adapter, mesmos casos de uso)
- Tela de logs de download para o ADMIN
- Refresh token com cookie `httpOnly`
- Rate limiting no login (`@nestjs/throttler`)
- Swagger (`@nestjs/swagger`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.5", "2.1"] },
    { "id": 3, "tasks": ["1.4", "2.2", "2.3", "2.9"] },
    { "id": 4, "tasks": ["2.4", "2.6", "2.10"] },
    { "id": 5, "tasks": ["2.5", "2.7", "2.8"] },
    { "id": 6, "tasks": ["2.11"] },
    { "id": 7, "tasks": ["3.1", "3.2", "3.7"] },
    { "id": 8, "tasks": ["3.3", "3.4"] },
    { "id": 9, "tasks": ["3.5", "3.6", "3.8"] },
    { "id": 10, "tasks": ["3.9"] },
    { "id": 11, "tasks": ["4.1"] },
    { "id": 12, "tasks": ["4.2", "4.4"] },
    { "id": 13, "tasks": ["4.3", "4.5", "4.6"] },
    { "id": 14, "tasks": ["4.7"] },
    { "id": 15, "tasks": ["4.8"] },
    { "id": 16, "tasks": ["5.1", "5.4"] },
    { "id": 17, "tasks": ["5.2", "5.5", "5.6"] },
    { "id": 18, "tasks": ["5.3", "5.7"] },
    { "id": 19, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 20, "tasks": ["6.4"] },
    { "id": 21, "tasks": ["6.5"] },
    { "id": 22, "tasks": ["7.1", "7.2"] },
    { "id": 23, "tasks": ["7.3"] }
  ]
}
```
