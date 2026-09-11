# Design: Certificate Issuance

## Overview

Feature da v2: o aluno solicita o certificado de um curso, o ADMIN aprova ou recusa, a aprovação emite um certificado único em PDF (modelo fixo estilo diploma) e qualquer pessoa verifica a autenticidade pelo código ou QR Code.

A implementação segue a arquitetura hexagonal da v1: domínio e casos de uso sem framework; Prisma, Playwright e sistema de arquivos como adapters.

### Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Modelo visual | Um único modelo clássico (frente e verso) | Escopo menor e identidade consistente |
| Geração do PDF | Template HTML/CSS → Chromium headless (Playwright) → `page.pdf()` | PDF vetorial com tipografia e ornamentos de qualidade; padrão de mercado para documentos a partir de templates |
| Ornamentos | 100% SVG gerado em código (sem Canvas nem imagens) | Mantém o PDF vetorial: texto selecionável e nítido em qualquer zoom |
| Fontes | Arquivos `.woff2` locais (pacotes `@fontsource/*`) embutidos como data URI | Renderização sem internet e resultado idêntico em qualquer ambiente |
| Fluxo | Pedido do aluno → aprovação ou recusa do ADMIN | Só quem concluiu recebe; o ADMIN mantém o controle |
| Imutabilidade | Snapshot gravado na emissão + PDF gerado uma única vez e guardado | Alterar curso ou usuário não muda certificado emitido; o File_Hash continua válido |
| Verificação | Código aleatório de 60 bits + página pública + checagem de arquivo por SHA-256 | Impossível de adivinhar, sem expor dados sensíveis |
| Papéis | `ADMIN` existente; sem `SUPER_ADMIN` | Sem escolha de modelos, não há necessidade de outro papel |

### Por que dois hashes

Um hash não pode estar impresso dentro do próprio arquivo que ele resume (imprimir o hash mudaria os bytes e, portanto, o hash). Por isso:

- **Data_Hash**: SHA-256 dos *dados* do certificado (JSON canônico de Snapshot, código e número de registro). É impresso no verso e mostrado na verificação pública; prova que os dados exibidos são os emitidos.
- **File_Hash**: SHA-256 dos *bytes* do PDF emitido. Não é impresso; fica no banco e é usado quando alguém envia o arquivo para conferir se foi editado.

Isso só funciona porque o PDF é gerado **uma vez** e guardado: gerar de novo produziria bytes diferentes (o Chromium grava data de criação no arquivo).

---

## Architecture

### Novas peças por camada (apps/api/src)

```
domain/
├── entities/        Course, CourseModule, CertificateRequest, Certificate
├── value-objects/   VerificationCode, Registry, CertificatePeriod
├── services/        canonicalize (JSON canônico), hashing puro
├── errors/          course.errors.ts, certificate.errors.ts
└── ports/
    ├── repositories/  CourseRepositoryPort, CertificateRequestRepositoryPort,
    │                  CertificateRepositoryPort, RegistryCounterPort
    └── services/      CertificateRendererPort, CertificateFileStoragePort,
                       RandomPort, ClockPort, UnitOfWorkPort

application/use-cases/
├── course/          CreateCourse, UpdateCourse, DeactivateCourse, ListActiveCourses
├── certificate-request/
│                    RequestCertificate, ListMyRequests, ListRequests,
│                    ApproveRequest (emite), RejectRequest
└── certificate/     ListMyCertificates, GetCertificateFile, ListCertificates,
                     GetCertificateDetail, RevokeCertificate,
                     VerifyCertificate, CheckCertificateFile

infrastructure/
├── database/        PrismaCourseRepository, PrismaCertificateRequestRepository,
│                    PrismaCertificateRepository, PrismaRegistryCounter,
│                    PrismaUnitOfWork
├── certificate/     PlaywrightCertificateRenderer, template/ (HTML, CSS, SVG builders),
│                    font-loader.ts
├── storage/         LocalDiskCertificateStorage
└── system/          CryptoRandomAdapter, SystemClockAdapter

presentation/
├── controllers/     CourseController, CertificateRequestController,
│                    CertificateController, PublicCertificateController
└── dtos/            course.dto.ts, certificate-request.dto.ts, certificate.dto.ts
```

`RandomPort` e `ClockPort` existem para que código, registro e datas sejam determinísticos nos testes.

### Fluxo de aprovação

```
ADMIN  POST /api/certificate-requests/:id/approve { startDate?, completionDate }
  │
  ▼
ApproveCertificateRequestUseCase  (valida o pedido)
  │
  ▼
IssueCertificateUseCase  (emite; reutilizável por outros gatilhos, como uma futura conclusão automática de trilha)
  └─ dentro de UnitOfWorkPort.transaction:
  1. carrega o pedido com lock (SELECT ... FOR UPDATE) → precisa estar PENDING
  2. carrega aluno e curso → monta o Snapshot
  3. RegistryCounterPort.next(ano)       → UPDATE ... RETURNING (lock na linha do ano)
  4. VerificationCode.generate(random)   → CERT-7K3F-9QX2-M8PD
  5. dataHash = sha256(canonicalize(snapshot) + code)
  6. CertificateRendererPort.render(...) → Buffer (PDF)
  7. fileHash = sha256(pdf)
  8. CertificateFileStoragePort.save(key, pdf)
  9. insere Certificate (VALID) e marca o pedido APPROVED
  commit
  └─ se qualquer passo falhar: rollback + storage.delete(key) (compensação)
```

O contador de registro é incrementado **na mesma transação**: se a emissão falhar, o número volta e não fica buraco na numeração. O custo é serializar aprovações simultâneas (a linha do contador fica travada durante a renderização, ~1 s), aceitável para o volume esperado.

### Fluxo de verificação pública

```
Pessoa com o PDF → escaneia o QR → https://<web>/verificar/CERT-7K3F-9QX2-M8PD
  │
  ▼  Angular (rota pública)  GET /api/public/certificates/CERT-7K3F-9QX2-M8PD
  │
  ▼  VerifyCertificateUseCase → { status: VALID | REVOKED, dados públicos, dataHash }
  │
  └─ opcional: envia o PDF → POST /api/public/certificates/:code/file-check
                 → sha256(bytes) === fileHash ?  "arquivo original" : "arquivo alterado"
```

### Endpoints

Todas as rotas têm o prefixo `/api`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /courses | USER, ADMIN | Cursos ativos com módulos |
| POST | /courses | ADMIN | Cria curso com módulos |
| PATCH | /courses/:id | ADMIN | Atualiza curso (substitui módulos se enviados) |
| DELETE | /courses/:id | ADMIN | Desativa curso |
| POST | /certificate-requests | USER, ADMIN | Solicita certificado de um curso |
| GET | /me/certificate-requests | USER, ADMIN | Pedidos do usuário logado |
| GET | /certificate-requests?status= | ADMIN | Todos os pedidos |
| POST | /certificate-requests/:id/approve | ADMIN | Aprova e emite |
| POST | /certificate-requests/:id/reject | ADMIN | Recusa com motivo |
| GET | /me/certificates | USER, ADMIN | Certificados do usuário logado |
| GET | /certificates?status&courseId&from&to&q&page&pageSize | ADMIN | Histórico paginado |
| GET | /certificates/:id | ADMIN | Detalhe com Snapshot e hashes |
| GET | /certificates/:id/pdf | dono ou ADMIN | Baixa o PDF guardado |
| POST | /certificates/:id/revoke | ADMIN | Revoga com motivo |
| GET | /public/certificates/:code | público (limitado) | Verificação |
| POST | /public/certificates/:code/file-check | público (limitado) | Conferência do arquivo |

---

## Components and Interfaces

### Value Objects

```typescript
// domain/value-objects/verification-code.ts
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32 (sem I, L, O, U)

export class VerificationCode {
  private constructor(private readonly value: string) {} // 12 caracteres, sem hífens

  /** 60 bits aleatórios → 12 caracteres Base32. */
  static generate(random: RandomPort): VerificationCode {
    const bytes = random.bytes(8);
    let bits = 0n;
    for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
    let out = '';
    for (let i = 0; i < 12; i++) {
      out = ALPHABET[Number(bits & 31n)] + out;
      bits >>= 5n;
    }
    return new VerificationCode(out);
  }

  /** Aceita minúsculas, hífens, espaços e confusões comuns (O→0, I/L→1). */
  static parse(raw: string): VerificationCode {
    let cleaned = raw.toUpperCase().replace(/[\s-]/g, '');
    // Remove o prefixo só quando ele está presente (16 caracteres), porque o corpo do código também pode começar com "CERT"
    if (cleaned.length === 16 && cleaned.startsWith('CERT')) cleaned = cleaned.slice(4);
    cleaned = cleaned.replace(/O/g, '0').replace(/[IL]/g, '1');
    if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(cleaned)) throw new InvalidVerificationCodeError();
    return new VerificationCode(cleaned);
  }

  /** CERT-7K3F-9QX2-M8PD */
  formatted(): string {
    return `CERT-${this.value.slice(0, 4)}-${this.value.slice(4, 8)}-${this.value.slice(8)}`;
  }
}

// domain/value-objects/registry.ts
export class Registry {
  constructor(readonly year: number, readonly sequence: number) {}

  get book(): number { return Math.ceil(this.sequence / 200); }
  get sheet(): number { return ((this.sequence - 1) % 200) + 1; }

  /** 2026.000418 */
  formatted(): string {
    return `${this.year}.${String(this.sequence).padStart(6, '0')}`;
  }
}
```

### Snapshot

```typescript
// domain/entities/certificate.entity.ts
export interface CertificateSnapshot {
  holder: { name: string; cpf: string };           // CPF só dígitos
  course: {
    title: string;
    coordinator: string;
    workloadHours: number;
    modules: { title: string; hours: number }[];
  };
  period: { startDate: string | null; completionDate: string }; // ISO 8601 (data)
  institution: { name: string; city: string; director: string; directorRole: string };
  issuedAt: string;                                // ISO 8601 (data e hora, UTC)
}
```

`canonicalize(value)` serializa com chaves ordenadas recursivamente, sem espaços; é uma função pura do domínio, testada por propriedade (mesmo objeto com chaves em ordens diferentes → mesma string).

### Ports

```typescript
export interface CertificateRendererPort {
  render(input: {
    snapshot: CertificateSnapshot;
    code: string;            // formatado
    registry: { number: string; book: number; sheet: number };
    dataHash: string;
    verificationUrl: string;
  }): Promise<Buffer>;
}

export interface CertificateFileStoragePort {
  save(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface RegistryCounterPort {
  /** Deve ser chamado dentro da transação corrente. */
  next(year: number): Promise<number>;
}

export interface UnitOfWorkPort {
  transaction<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

export interface RandomPort { bytes(length: number): Uint8Array; }
export interface ClockPort { now(): Date; }
```

### Renderer (Playwright)

```typescript
// infrastructure/certificate/playwright-certificate.renderer.ts
@Injectable()
export class PlaywrightCertificateRenderer
  implements CertificateRendererPort, OnModuleDestroy
{
  private browser?: Promise<Browser>;

  private getBrowser(): Promise<Browser> {
    this.browser ??= chromium.launch({ args: ['--disable-dev-shm-usage'] });
    return this.browser;
  }

  async render(input: RenderInput): Promise<Buffer> {
    const html = buildCertificateHtml(input); // template + CSS + fontes + SVGs, tudo inline
    const page = await (await this.getBrowser()).newPage();
    try {
      // Nenhuma requisição externa: tudo precisa estar embutido no HTML
      await page.route('**/*', (route) =>
        route.request().url().startsWith('data:') ? route.continue() : route.abort(),
      );
      await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(fitHolderName); // reduz a fonte do nome até caber em uma linha
      return await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: 20_000,
      });
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) await (await this.browser).close();
  }
}
```

### Template

```
infrastructure/certificate/template/
├── certificate.template.ts   buildCertificateHtml(input): string
├── certificate.css           @page { size: A4 landscape; margin: 0 } + layout em mm
├── escape-html.ts            escapa & < > " '
├── svg/
│   ├── guilloche.ts          path "d" das ondas senoidais ao longo do perímetro
│   ├── rosette.ts            hipotrocoide (marca d'água e cantos)
│   ├── seal.ts               roseta serrilhada, texto circular, estrela e fitas
│   └── emblem.ts             brasão
├── qr.ts                     qrcode.toString(url, { type: 'svg', margin: 0 })
└── fonts.ts                  lê .woff2 de @fontsource/* e gera @font-face com data URI
```

Regras do template:

- **Layout em milímetros** (`@page` A4 paisagem = 297 × 210 mm): o que se vê na pré-visualização é o que sai no PDF.
- **Toda interpolação passa por `escapeHtml`**. O template é uma função TypeScript com template literals; nenhum dado entra sem escape.
- **Datas por extenso** com `Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' })`.
- **Nome longo**: `fitHolderName` roda no navegador antes do `page.pdf()` e reduz o `font-size` em passos de 2% até `scrollWidth <= clientWidth`, com mínimo de 60% do tamanho original.
- **Página 2 (verso)**: `break-before: page`.

O modelo visual de referência (frente e verso, anatomia dos 14 elementos) foi aprovado a partir do protótipo *Certificado Estilo Diploma*. No template real, os elementos desenhados em Canvas no protótipo (moldura guilloché, rosáceas e QR Code) passam a ser SVG.

### Configuração da instituição

Dados fixos vêm de variáveis de ambiente validadas na inicialização:

```dotenv
PUBLIC_WEB_URL=http://localhost:4200
INSTITUTION_NAME=Academia Horizonte
INSTITUTION_CITY=São Paulo
INSTITUTION_DIRECTOR=Dra. Helena Duarte
INSTITUTION_DIRECTOR_ROLE=Diretora Acadêmica
CERTIFICATES_STORAGE_DIR=/data/certificates
```

### Rate limiting

`@nestjs/throttler` com um throttler nomeado `public` (30 req/min por IP) aplicado apenas no `PublicCertificateController`. Com 60 bits de entropia, adivinhar códigos é inviável; o limite protege contra abuso do endpoint de upload.

---

## Data Models

```prisma
model Course {
  id            String         @id @default(cuid())
  title         String         @db.VarChar(200)
  description   String?        @db.VarChar(1000)
  coordinator   String         @db.VarChar(100)
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  modules       CourseModule[]
  requests      CertificateRequest[]
  certificates  Certificate[]

  @@map("courses")
}

model CourseModule {
  id        String @id @default(cuid())
  courseId  String
  title     String @db.VarChar(200)
  hours     Int
  position  Int
  course    Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([courseId, position])
  @@map("course_modules")
}

enum CertificateRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model CertificateRequest {
  id              String                   @id @default(cuid())
  userId          String
  courseId        String
  status          CertificateRequestStatus @default(PENDING)
  rejectionReason String?                  @db.VarChar(500)
  reviewedById    String?
  reviewedAt      DateTime?
  createdAt       DateTime                 @default(now())
  user            User                     @relation("RequestOwner", fields: [userId], references: [id])
  course          Course                   @relation(fields: [courseId], references: [id])
  certificate     Certificate?

  @@index([status, createdAt])
  @@map("certificate_requests")
}

enum CertificateStatus {
  VALID
  REVOKED
}

model Certificate {
  id               String            @id @default(cuid())
  requestId        String            @unique
  userId           String
  courseId         String
  code             String            @unique @db.Char(12)
  registryYear     Int
  registrySequence Int
  status           CertificateStatus @default(VALID)
  snapshot         Json
  dataHash         String            @db.Char(64)
  fileHash         String            @db.Char(64)
  fileKey          String
  issuedById       String
  issuedAt         DateTime
  revokedById      String?
  revokedAt        DateTime?
  revocationReason String?           @db.VarChar(500)
  request          CertificateRequest @relation(fields: [requestId], references: [id])
  user             User               @relation("CertificateHolder", fields: [userId], references: [id])
  course           Course             @relation(fields: [courseId], references: [id])

  @@unique([registryYear, registrySequence])
  @@index([issuedAt])
  @@map("certificates")
}

model RegistryCounter {
  year Int @id
  last Int @default(0)

  @@map("registry_counters")
}
```

O model `User` da v1 ganha as relações inversas `certificateRequests CertificateRequest[] @relation("RequestOwner")` e `certificates Certificate[] @relation("CertificateHolder")`.

Unicidade de pedido pendente e certificado válido: em vez de índices únicos parciais (que o Prisma não representa no schema e tentaria remover em migrations futuras), cada tabela tem uma coluna-chave única preenchida só no estado controlado:

```sql
-- certificate_requests.pendingKey = '<userId>:<courseId>' enquanto PENDING, NULL depois
-- certificates.validKey        = '<userId>:<courseId>' enquanto VALID,   NULL depois
-- No PostgreSQL, UNIQUE permite vários NULL: só o estado ativo é único.
```

Incremento do contador (dentro da transação):

```sql
INSERT INTO registry_counters (year, last) VALUES ($1, 1)
ON CONFLICT (year) DO UPDATE SET last = registry_counters.last + 1
RETURNING last;
```

---

## Correctness Properties

### Property 1: Código de verificação bem formado e reversível
*Para toda* sequência de bytes aleatórios, `VerificationCode.generate` produz 12 caracteres do alfabeto Crockford, e `parse(formatted())` devolve o mesmo código — também com minúsculas, sem hífens e com `O`/`I`/`L` no lugar de `0`/`1`/`1`.
**Validates: Requirements 4.3, 9.4**

### Property 2: JSON canônico independe da ordem das chaves
*Para todo* Snapshot, qualquer permutação das chaves (em qualquer nível) gera a mesma string canônica e, portanto, o mesmo Data_Hash.
**Validates: Requirements 4.5**

### Property 3: Snapshot imutável
*Para todo* certificado emitido, alterações posteriores em nome ou CPF do usuário, ou em título, coordenador e módulos do curso, não alteram o Snapshot, o Data_Hash nem o arquivo retornado.
**Validates: Requirements 4.1, 4.2**

### Property 4: Aprovação emite exatamente um certificado
*Para todo* pedido `PENDING`, a aprovação resulta em exatamente um certificado `VALID` e no pedido `APPROVED`; a recusa resulta em zero certificados; uma falha em qualquer etapa da emissão deixa o pedido `PENDING`, zero certificados e nenhum arquivo no storage.
**Validates: Requirements 3.2, 3.3, 3.6**

### Property 5: Registro sequencial sem repetição
*Para qualquer* número de aprovações concorrentes no mesmo ano, as sequências atribuídas são distintas e formam um intervalo contínuo a partir do valor anterior; livro e folha seguem as fórmulas do Requirement 4.4.
**Validates: Requirements 4.4**

### Property 6: No máximo um pedido pendente e um certificado válido por aluno e curso
*Para qualquer* sequência de pedidos, recusas, aprovações e revogações, nunca existem dois pedidos `PENDING` nem dois certificados `VALID` para o mesmo par (usuário, curso).
**Validates: Requirements 2.2, 2.3, 2.6, 8.4**

### Property 7: Verificação pública nunca expõe dados sensíveis
*Para todo* certificado, a resposta de `GET /public/certificates/:code` não contém o CPF completo, o email, o id do usuário, o `fileKey` nem dados de quem aprovou ou revogou.
**Validates: Requirements 9.5**

### Property 8: Conferência de arquivo detecta qualquer alteração
*Para todo* PDF emitido, enviar os bytes originais resulta em "confere"; alterar qualquer byte resulta em "não confere".
**Validates: Requirements 10.1**

### Property 9: Carga horária é a soma dos módulos
*Para toda* lista de módulos válida, a carga horária total do curso e a do Snapshot são iguais à soma das horas dos módulos.
**Validates: Requirements 1.3, 4.1**

### Property 10: PDF contém os dados certos e é vetorial
*Para todo* Snapshot com nomes de 2 a 100 caracteres (incluindo acentos e caracteres especiais de HTML como `<` e `&`), o texto extraído do PDF contém o nome exato do aluno, o código formatado e o título do curso; o PDF tem 2 páginas e nenhuma imagem rasterizada.
**Validates: Requirements 5.1, 5.4, 5.6, 5.7**

### Property 11: Revogação é definitiva e visível
*Para todo* certificado revogado, a verificação pública sempre retorna `REVOKED` com data e motivo, uma nova revogação retorna 409 e o certificado continua no histórico.
**Validates: Requirements 8.1, 8.2, 8.3, 9.2**

---

## Error Handling

| Situação | Erro de domínio | HTTP |
|---|---|---|
| Curso inexistente ou desativado | `CourseNotFoundError` | 404 |
| Módulos ausentes ou carga horária inválida | — (`ValidationPipe`) | 400 |
| Pedido pendente ou certificado válido já existente | `CertificateAlreadyRequestedError` | 409 |
| Pedido inexistente | `CertificateRequestNotFoundError` | 404 |
| Pedido não está `PENDING` | `CertificateRequestAlreadyReviewedError` | 409 |
| Datas do curso inválidas | `InvalidCertificatePeriodError` | 400 |
| Falha ao renderizar ou guardar o PDF | `CertificateIssuanceError` | 500 |
| Certificado inexistente (ou de outro usuário) | `CertificateNotFoundError` | 404 |
| Certificado já revogado | `CertificateAlreadyRevokedError` | 409 |
| Código em formato inválido | `InvalidVerificationCodeError` | 400 |
| Arquivo não é PDF | — (validação do upload) | 400 |
| Arquivo acima de 5 MB | — (limite do upload) | 413 |
| Limite de requisições públicas excedido | — (`ThrottlerGuard`) | 429 |

Todos os erros de domínio seguem o formato `{ statusCode, code, message }` já tratado pelo `DomainExceptionFilter`.

---

## Frontend

### Rotas

| Rota | Acesso | Tela |
|---|---|---|
| `/cursos` | USER, ADMIN | Cursos ativos e botão "Solicitar certificado" |
| `/meus-certificados` | USER, ADMIN | Pedidos e certificados do usuário |
| `/admin/cursos` | ADMIN | CRUD de cursos com editor de módulos |
| `/admin/pedidos` | ADMIN | Fila de pedidos com aprovar e recusar |
| `/admin/certificados` | ADMIN | Histórico com filtros, detalhe, download e revogação |
| `/verificar` | público | Campo para digitar o código |
| `/verificar/:code` | público | Resultado da verificação e conferência de arquivo |

### Estados da verificação

| Estado | Apresentação |
|---|---|
| `VALID` | Selo verde "Certificado válido", dados públicos, Data_Hash e registro |
| `REVOKED` | Faixa vermelha "Certificado revogado em <data>", motivo e dados públicos |
| Não encontrado | "Nenhum certificado com este código", com dica de conferir o código |
| Arquivo confere / não confere | Resultado logo abaixo do botão de envio do PDF |

---

## Docker

O Chromium do Playwright não roda em Alpine. A imagem da API passa a usar Debian slim:

```dockerfile
FROM node:22-bookworm-slim AS runner
# ...
RUN npx playwright install --with-deps chromium
VOLUME /data/certificates
```

No `docker-compose.yml`, o serviço `api` ganha o volume nomeado `certificates:/data/certificates` e as variáveis `PUBLIC_WEB_URL` e `INSTITUTION_*`. A imagem cresce cerca de 400 MB por causa do Chromium.

---

## Testing Strategy

| Camada | Tipo | Ferramenta | Foco |
|---|---|---|---|
| `VerificationCode`, `Registry`, `canonicalize` | Unit + property | Jest + fast-check | Properties 1, 2, 5 (fórmulas) |
| Casos de uso | Unit com fakes (Random, Clock, UnitOfWork em memória) | Jest + fast-check | Properties 3, 4, 6, 9, 11 |
| Template | Unit | Jest | Escape de HTML, datas por extenso, SVGs sem `NaN` |
| `PlaywrightCertificateRenderer` | Integração | Jest + pdf-parse (subprocesso) | Property 10 |
| `PrismaRegistryCounter` e índices parciais | Integração | Jest + Postgres de teste | Property 5 (concorrência) e 6 no banco |
| Controllers públicos | e2e | Supertest | Properties 7, 8; 429 do throttler |
| Telas | Unit | Vitest + Angular Testing Library | Estados da verificação, formulários de aprovação e revogação |

Observações:

- **Concorrência do registro**: disparar N aprovações em paralelo contra o Postgres de teste e verificar que as sequências são `1..N` sem repetição.
- **Renderer nos testes**: o Chromium é baixado uma vez (`npx playwright install chromium`); o teste de integração fica no alvo `test:integration` para não pesar no `npm test` rápido.
