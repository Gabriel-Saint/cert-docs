# CertDocs

Sistema para distribuir materiais restritos (apostilas, cursos) em PDF com o **CPF e o nome de quem baixou carimbados no cabeçalho e no rodapé de todas as páginas**. Se o arquivo vazar, dá para saber de onde veio — e cada download fica registrado.

> **Status:** API completa (documentos com CPF carimbado e emissão de certificados) · frontend Angular em desenvolvimento

## Planejamento

O projeto foi planejado com **spec-driven development** usando o [Kiro](https://kiro.dev): antes de qualquer código, foram escritos os requisitos, o design técnico e o plano de implementação. A especificação fica versionada junto com o código:

- 📋 [Requisitos](.kiro/specs/cpf-pdf-watermark-generator/requirements.md) — user stories e critérios de aceite (formato EARS)
- 🏗️ [Design técnico](.kiro/specs/cpf-pdf-watermark-generator/design.md) — arquitetura, contratos, modelo de dados e propriedades de corretude
- ✅ [Plano de implementação](.kiro/specs/cpf-pdf-watermark-generator/tasks.md) — tarefas em fatias verticais, com o progresso marcado

Os testes baseados em propriedades (fast-check) implementam diretamente as _correctness properties_ definidas no design.

**Segunda feature:** [emissão de certificados](.kiro/specs/certificate-issuance/requirements.md) no estilo diploma, com código de verificação, QR Code, hash e página pública de verificação — especificada com o mesmo processo e já implementada na API.

## Stack

| Camada   | Tecnologia                                                 |
| -------- | ---------------------------------------------------------- |
| Monorepo | Nx 23 (npm workspaces + TypeScript project references)     |
| API      | NestJS 11 · arquitetura hexagonal                          |
| Banco    | PostgreSQL 16 · Prisma 7 (driver adapter `pg`)             |
| PDF      | PDFKit (documentos) · Playwright + Chromium (certificados) |
| Auth     | JWT (Passport) · bcrypt · controle de acesso por roles     |
| Testes   | Jest · fast-check (property-based) · Supertest             |
| Infra    | Docker (multi-stage) · Docker Compose                      |
| Frontend | Angular 22 · standalone · zoneless · signals · Vitest      |

## Estrutura

```
apps/
  api/                       NestJS
    prisma/                  schema, migrations e seed
    src/
      domain/                entidades, value objects, erros e ports (sem framework)
      application/           casos de uso (classes TypeScript puras)
      infrastructure/        adapters: Prisma, PDFKit, bcrypt, JWT
      presentation/          controllers, DTOs, guards, filtro de erros
      modules/               composition root: liga ports aos adapters
  web/                       Angular (em construção)
    proxy.conf.json          /api -> API local, sem CORS em desenvolvimento
libs/
  shared/                    tipos, contratos da API e utilitários de CPF (usados por api e web)
```

A regra de dependência é `presentation / infrastructure → application → domain`. O domínio e os casos de uso não importam NestJS nem Prisma, então são testados com `new UseCase(fakes)`, sem banco e sem `TestingModule`.

## Como rodar

**Pré-requisitos:** Node.js 22+, Docker.

```bash
npm install
cp .env.example .env        # ajuste JWT_SECRET

npm run db:up               # sobe o PostgreSQL
npm run db:migrate          # aplica as migrations
npm run db:seed             # cria o ADMIN e documentos de exemplo
npm run start:api           # http://localhost:3000/api
npm run start:web           # http://localhost:4200 (em outro terminal)
```

> Não defina `PORT` no `.env`: o Nx carrega esse arquivo em todas as tarefas e o dev server do Angular passaria a usar a mesma porta da API.

Credenciais do seed (definidas no `.env`): `admin@example.com` / `admin12345`.

### Com Docker

```bash
docker compose up -d --build   # postgres + api (migrations aplicadas automaticamente)
```

## API

Todas as rotas têm o prefixo `/api`.

> 📖 **Documentação interativa (Swagger):** com a API rodando, acesse **http://localhost:3000/api/docs**. Faça login, clique em **Authorize**, cole o token e teste as rotas pelo navegador, inclusive o download do PDF. A especificação OpenAPI em JSON fica em `/api/docs-json`.

| Método | Rota                 | Acesso      | Descrição                                           |
| ------ | -------------------- | ----------- | --------------------------------------------------- |
| POST   | `/auth/register`     | público     | Cadastro (role `USER`)                              |
| POST   | `/auth/login`        | público     | Retorna `{ accessToken }` (expira em 24h)           |
| GET    | `/documents`         | USER, ADMIN | Lista documentos ativos                             |
| GET    | `/documents/:id`     | USER, ADMIN | Detalhe do documento                                |
| GET    | `/documents/:id/pdf` | USER, ADMIN | **PDF com o CPF do usuário do token**               |
| POST   | `/documents`         | ADMIN       | Cria documento                                      |
| PATCH  | `/documents/:id`     | ADMIN       | Atualiza campos enviados                            |
| DELETE | `/documents/:id`     | ADMIN       | Desativa (soft delete)                              |
| GET    | `/users`             | ADMIN       | Lista usuários com CPF mascarado (`529.***.***-25`) |

Exemplo:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"admin12345"}' | jq -r .accessToken)

curl -OJ -H "Authorization: Bearer $TOKEN" localhost:3000/api/documents/seed-material-longo/pdf
# salva documento-seed-material-longo-529-25.pdf
```

Erros de negócio seguem um formato único:

```json
{
  "statusCode": 409,
  "code": "EMAIL_OR_CPF_IN_USE",
  "message": "Email ou CPF já cadastrado"
}
```

## Certificados

Fluxo: o aluno **solicita** o certificado de um curso → o ADMIN **aprova** (emite) ou recusa com motivo → o aluno **baixa** o PDF → qualquer pessoa **verifica** pelo código ou QR Code, sem login.

- **Modelo estilo diploma**, frente e verso: moldura guilloché, selo dourado com fitas, nome em caligrafia, assinaturas, registro nº/livro/folha e conteúdo programático.
- **PDF 100% vetorial**: template HTML/CSS impresso por um Chromium sem interface (Playwright). Todos os ornamentos e o QR Code são SVG e as fontes vão embutidas no arquivo — sem imagens, texto selecionável e nítido em qualquer zoom.
- **Código de verificação** aleatório de 60 bits (`CERT-7K3F-9QX2-M8PD`, alfabeto sem letras ambíguas), **registro sequencial por ano** e **dois hashes**: o dos dados (impresso no verso) e o do arquivo (guardado para detectar PDF editado).
- **Snapshot**: os dados são congelados na emissão; mudar o nome do aluno ou do curso depois não altera o certificado.
- **Revogação** com motivo: o certificado continua no histórico e a verificação pública passa a mostrar "revogado".

| Método                | Rota                                            | Acesso      | Descrição                             |
| --------------------- | ----------------------------------------------- | ----------- | ------------------------------------- |
| GET                   | `/courses`                                      | USER, ADMIN | Cursos ativos com módulos             |
| POST · PATCH · DELETE | `/courses`                                      | ADMIN       | Cadastro de cursos                    |
| POST                  | `/certificate-requests`                         | USER, ADMIN | Solicita certificado                  |
| GET                   | `/me/certificate-requests` · `/me/certificates` | USER, ADMIN | Meus pedidos e certificados           |
| GET                   | `/certificate-requests?status=`                 | ADMIN       | Fila de pedidos                       |
| POST                  | `/certificate-requests/:id/approve` · `/reject` | ADMIN       | Aprova (emite) ou recusa              |
| GET                   | `/certificates` · `/certificates/:id`           | ADMIN       | Histórico com filtros e detalhe       |
| GET                   | `/certificates/:id/pdf`                         | dono, ADMIN | Baixa o PDF                           |
| POST                  | `/certificates/:id/revoke`                      | ADMIN       | Revoga com motivo                     |
| GET                   | `/public/certificates/:code`                    | público     | Verificação (30 req/min por IP)       |
| POST                  | `/public/certificates/:code/file-check`         | público     | Confere se o PDF enviado é o original |

Para gerar certificados rodando a API fora do Docker, baixe o Chromium uma vez: `npx playwright install --only-shell chromium`.

## Testes

```bash
npm test                          # unitários, property-based e e2e (sem banco nem navegador)
npx nx run api:test-integration   # Chromium real gerando PDF + Postgres (concorrência do registro)
npm run ci                        # lint + typecheck + testes + build
```

- **Property-based (fast-check):** validação de CPF comparada com um oráculo independente, unicidade de email/CPF, isolamento de roles, listagem só de ativos, carimbo em todas as páginas do PDF.
- **e2e (Supertest):** a aplicação Nest completa (guards, pipes, filtro de erros) com repositórios em memória no lugar do Prisma — roda sem banco.

## Decisões técnicas

- **Carimbo depois do conteúdo.** Carimbar no evento `pageAdded` do PDFKit escreve abaixo da margem inferior, o que cria páginas extras e empurra o conteúdo. O adapter escreve o conteúdo primeiro e depois percorre as páginas bufferizadas zerando a margem inferior só durante o carimbo.
- **Log antes da resposta.** O download só é entregue depois que o registro em `download_logs` é gravado; se o log falhar, o PDF não sai.
- **Erros de domínio em vez de exceções HTTP.** Casos de uso lançam `DocumentNotFoundError`, `InvalidCpfError` etc.; um `ExceptionFilter` traduz para status HTTP.
- **Unicidade à prova de corrida.** Além da checagem prévia, a violação `P2002` do banco é convertida em 409.
- **CPF validado dos dois lados com o mesmo código**, via `libs/shared`.
