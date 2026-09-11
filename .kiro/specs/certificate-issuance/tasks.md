# Implementation Plan: Certificate Issuance

## Overview

Emissão de certificados estilo diploma com código de verificação, QR Code e hash. O plano segue fatias verticais (banco → API → tela), como na v1, e **começa só depois que o frontend da v1 estiver concluído** (auth, guards, shell e componentes Angular Material prontos para reuso).

Pré-requisitos da v1: autenticação JWT e roles, `DomainExceptionFilter`, Swagger, shell responsivo do Angular com `authGuard` e `roleGuard`.

## Convenções de Commit

- Conventional Commits com descrição em português: `tipo(escopo): descrição no imperativo`
- Escopos: `api`, `web`, `shared`, `infra`
- Um commit por subtarefa (sugestão em cada uma)

## Tasks

- [ ] 1. Fundação: contratos, domínio compartilhado e schema
  - [x] 1.1 Contratos na shared
    - `CertificateRequestStatus`, `CertificateStatus`
    - `CourseSummary`, `CourseDetail`, `CreateCourseRequest`, `UpdateCourseRequest`
    - `CertificateRequestItem`, `ApproveCertificateRequest`, `RejectCertificateRequest`
    - `CertificateItem`, `CertificateDetail`, `CertificateHistoryQuery`, `Page<T>`
    - `PublicCertificateVerification`, `FileCheckResult`
    - _Commit: `feat(shared): adiciona contratos de cursos e certificados`_
    - _Requirements: 1, 2, 3, 6, 7, 9, 10_

  - [x] 1.2 Value objects e serviços puros do domínio
    - `VerificationCode` (generate e parse), `Registry` (livro e folha), `CertificatePeriod`
    - `canonicalize` e `sha256Hex`
    - Ports `RandomPort` e `ClockPort` com adapters `CryptoRandomAdapter` e `SystemClockAdapter`
    - _Commit: `feat(api): adiciona código de verificação, registro e json canônico`_
    - _Requirements: 4.3, 4.4, 4.5, 9.4_

  - [x]* 1.3 Property tests dos value objects
    - **Property 1: Código de verificação bem formado e reversível**
    - **Property 2: JSON canônico independe da ordem das chaves**
    - Fórmulas de livro e folha (parte da Property 5)
    - _Commit: `test(api): adiciona property tests de código, registro e json canônico`_
    - **Validates: Requirements 4.3, 4.4, 4.5, 9.4**

  - [x] 1.4 Schema e migration
    - Models `Course`, `CourseModule`, `CertificateRequest`, `Certificate`, `RegistryCounter` e relações inversas em `User`
    - Migration com as colunas-chave únicas `pendingKey` e `validKey` (unicidade só no estado ativo)
    - Variáveis `PUBLIC_WEB_URL`, `INSTITUTION_*` e `CERTIFICATES_STORAGE_DIR` no `.env.example` e na validação do ambiente
    - Seed com um curso de exemplo e seus módulos
    - _Commit: `feat(api): adiciona schema de cursos e certificados`_
    - _Requirements: 1, 2.6, 4, 12.6_

- [ ] 2. Fatia 1 — Cursos
  - [x] 2.1 Domínio e casos de uso de cursos
    - Entidades `Course` e `CourseModule` com carga horária derivada
    - `CreateCourse`, `UpdateCourse`, `DeactivateCourse`, `ListActiveCourses`
    - `CourseNotFoundError`
    - _Commit: `feat(api): adiciona casos de uso de cursos`_
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [x]* 2.2 Property test da carga horária
    - **Property 9: Carga horária é a soma dos módulos**
    - _Commit: `test(api): adiciona property test da carga horária`_
    - **Validates: Requirements 1.3**

  - [x] 2.3 Repositório e endpoints de cursos
    - `PrismaCourseRepository` (substituição dos módulos em transação)
    - `CourseController` com DTOs validados e documentação Swagger
    - _Commit: `feat(api): expõe endpoints de cursos`_
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [ ] 2.4 Web: cursos
    - Tela do aluno `/cursos` com conteúdo programático
    - Tela do admin `/admin/cursos`: lista, formulário com editor de módulos ordenável e total de horas em tempo real, desativação com confirmação
    - _Commit: `feat(web): adiciona telas de cursos`_
    - _Requirements: 11.1, 11.3, 11.6_

  - [ ] 2.5 Checkpoint — Cursos funcionando
    - Criar, editar e desativar curso pelo admin; aluno vê só os ativos
    - `npm run ci` passando
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 3. Fatia 2 — Pedidos de certificado
  - [x] 3.1 Domínio e casos de uso de pedidos
    - Entidade `CertificateRequest` com transições de status
    - `RequestCertificate`, `ListMyRequests`, `ListRequests`, `RejectRequest`
    - Erros `CertificateAlreadyRequestedError`, `CertificateRequestNotFoundError`, `CertificateRequestAlreadyReviewedError`
    - _Commit: `feat(api): adiciona solicitação e recusa de certificados`_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.3, 3.4_

  - [x] 3.2 Repositório e endpoints de pedidos
    - `PrismaCertificateRequestRepository` (violação da chave única → 409)
    - `CertificateRequestController`: criar, listar os meus, listar todos (ADMIN), recusar
    - _Commit: `feat(api): expõe endpoints de pedidos de certificado`_
    - _Requirements: 2.1, 2.5, 2.6, 3.1, 3.3, 3.7_

  - [ ] 3.3 Web: pedidos
    - Botão "Solicitar certificado" em `/cursos` com estado desabilitado
    - `/meus-certificados` com a lista de pedidos, status e motivo de recusa
    - `/admin/pedidos` com filtro por status e ação "Recusar" com motivo
    - _Commit: `feat(web): adiciona solicitação e fila de pedidos`_
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ] 3.4 Checkpoint — Pedidos funcionando
    - Aluno solicita, admin recusa com motivo, aluno solicita de novo
    - `npm run ci` passando
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 4. Fatia 3 — Renderização do certificado
  - [x] 4.1 Template HTML e CSS
    - Portar o protótipo aprovado para `certificate.css` com layout em milímetros (`@page` A4 paisagem), frente e verso
    - `escapeHtml` e `buildCertificateHtml` com datas por extenso
    - _Commit: `feat(api): adiciona template html do certificado`_
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 4.2 Ornamentos em SVG e QR Code
    - Geradores de SVG: moldura guilloché, rosáceas, selo com fitas e brasão
    - QR Code em SVG com a URL de verificação
    - Fontes locais de `@fontsource/*` embutidas como data URI
    - _Commit: `feat(api): gera ornamentos, qr code e fontes do certificado em svg`_
    - _Requirements: 5.4, 5.5, 5.8_

  - [x] 4.3 Renderer com Playwright
    - `CertificateRendererPort` e `PlaywrightCertificateRenderer` (navegador reutilizado, bloqueio de rede, timeout de 20 s, ajuste do nome longo, fechamento no shutdown)
    - _Commit: `feat(api): adiciona renderização do certificado com chromium`_
    - _Requirements: 5.7, 12.1, 12.2, 12.3, 12.5_

  - [x]* 4.4 Testes do renderer
    - **Property 10: PDF contém os dados certos e é vetorial**
    - Nomes com acentos, `<`, `&` e 100 caracteres
    - _Commit: `test(api): adiciona testes de integração do renderer`_
    - **Validates: Requirements 5.1, 5.4, 5.6, 5.7**

  - [x] 4.5 Checkpoint — PDF aprovado visualmente
    - Gerar um certificado de exemplo, abrir no leitor de PDF, conferir frente e verso, zoom alto e seleção de texto
    - Perguntar ao usuário se o visual está aprovado antes de seguir

- [ ] 5. Fatia 4 — Emissão, download e histórico
  - [x] 5.1 Storage e unidade de trabalho
    - `CertificateFileStoragePort` com `LocalDiskCertificateStorage`
    - `UnitOfWorkPort` com `PrismaUnitOfWork` e `PrismaRegistryCounter`
    - _Commit: `feat(api): adiciona storage de certificados e transações`_
    - _Requirements: 4.4, 4.6, 12.6_

  - [x] 5.2 Caso de uso de aprovação e emissão
    - `ApproveCertificateRequestUseCase` valida o pedido e chama `IssueCertificateUseCase`: Snapshot, registro, código, Data_Hash, renderização, File_Hash, gravação e compensação em caso de falha
    - _Commit: `feat(api): emite certificado na aprovação do pedido`_
    - _Requirements: 3.2, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 5.3 Testes da emissão
    - **Property 3: Snapshot imutável**
    - **Property 4: Aprovação emite exatamente um certificado**
    - **Property 5: Registro sequencial sem repetição** (concorrência contra Postgres de teste)
    - **Property 6: No máximo um pedido pendente e um certificado válido por aluno e curso**
    - _Commit: `test(api): adiciona testes da emissão de certificados`_
    - **Validates: Requirements 2.6, 3.2, 3.6, 4.1, 4.2, 4.4**

  - [x] 5.4 Endpoints de certificados
    - Aprovar em `CertificateRequestController`
    - `CertificateController`: meus certificados, download (dono ou ADMIN, 404 para terceiros), histórico paginado com filtros, detalhe
    - _Commit: `feat(api): expõe emissão, download e histórico de certificados`_
    - _Requirements: 3.2, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4_

  - [ ] 5.5 Web: emissão, meus certificados e histórico
    - Ação "Aprovar" em `/admin/pedidos` com datas e confirmação
    - Certificados emitidos em `/meus-certificados` com download e "copiar link de verificação"
    - `/admin/certificados` com filtros, paginação, detalhe e download
    - _Commit: `feat(web): adiciona aprovação, meus certificados e histórico`_
    - _Requirements: 11.2, 11.4, 11.5_

  - [ ] 5.6 Checkpoint — Emissão funcionando
    - Fluxo completo: aluno solicita → admin aprova → aluno baixa o PDF → admin vê no histórico
    - `npm run ci` passando
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 6. Fatia 5 — Revogação e verificação pública
  - [ ] 6.1 Revogação
    - [x] API: `RevokeCertificateUseCase` e endpoint `POST /certificates/:id/revoke`
    - Ação "Revogar" com motivo e confirmação em `/admin/certificados`
    - _Commit: `feat: adiciona revogação de certificados`_
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.5_

  - [x] 6.2 Verificação pública na API
    - `VerifyCertificateUseCase` e `CheckCertificateFileUseCase`
    - `PublicCertificateController` sem autenticação, upload limitado a PDF de até 5 MB sem gravação
    - `@nestjs/throttler` com 30 req/min por IP nas rotas públicas
    - _Commit: `feat(api): adiciona verificação pública de certificados`_
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3_

  - [x]* 6.3 Testes da verificação
    - **Property 7: Verificação pública nunca expõe dados sensíveis**
    - **Property 8: Conferência de arquivo detecta qualquer alteração**
    - **Property 11: Revogação é definitiva e visível**
    - Resposta 429 ao exceder o limite
    - _Commit: `test(api): adiciona testes da verificação pública`_
    - **Validates: Requirements 8.1, 8.2, 9.2, 9.5, 9.6, 10.1**

  - [ ] 6.4 Web: página de verificação
    - Rotas públicas `/verificar` e `/verificar/:code` fora do shell autenticado
    - Estados válido, revogado e não encontrado; envio do PDF para conferência
    - _Commit: `feat(web): adiciona página pública de verificação`_
    - _Requirements: 9.7, 10.4_

  - [ ] 6.5 Checkpoint — Verificação funcionando
    - Escanear o QR Code do PDF com o celular (mesma rede) e abrir a verificação
    - Revogar e conferir que a página passa a mostrar "revogado"
    - Enviar o PDF original (confere) e um PDF editado (não confere)
    - Perguntar ao usuário se surgirem dúvidas

- [ ] 7. Infraestrutura e documentação
  - [x] 7.1 Imagem Docker com Chromium
    - Stage de runtime em `node:22-bookworm-slim` com `npx playwright install --with-deps chromium`
    - Volume `certificates` e novas variáveis no `docker-compose.yml`
    - _Commit: `build(api): adiciona chromium e volume de certificados na imagem`_
    - _Requirements: 12.4, 12.6_

  - [ ] 7.2 README e Swagger
    - Seção "Certificados" no README: fluxo, verificação e decisões (dois hashes, PDF vetorial, snapshot)
    - Conferir a documentação Swagger das novas rotas
    - _Commit: `docs: documenta a emissão e verificação de certificados`_
    - _Requirements: All_

  - [ ] 7.3 Checkpoint final
    - `docker compose down -v` → `docker compose up -d --build` → seed → fluxo completo em containers
    - Perguntar ao usuário se surgirem dúvidas

## Notes

- Tasks marcadas com `*` são opcionais, mas cobrem as regras mais sensíveis (imutabilidade, concorrência e privacidade)
- O modelo visual é único; o protótipo aprovado *Certificado Estilo Diploma* é a referência da fatia 3
- No template real, nada de Canvas: moldura, rosáceas e QR Code em SVG para o PDF sair 100% vetorial
- O Chromium não roda em Alpine; por isso a imagem da API muda para Debian slim na tarefa 7.1
- Testes do renderer ficam num alvo de integração separado, para o `npm test` continuar rápido

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.4", "4.1"] },
    { "id": 10, "tasks": ["4.2"] },
    { "id": 11, "tasks": ["4.3"] },
    { "id": 12, "tasks": ["4.4", "4.5"] },
    { "id": 13, "tasks": ["5.1"] },
    { "id": 14, "tasks": ["5.2"] },
    { "id": 15, "tasks": ["5.3", "5.4"] },
    { "id": 16, "tasks": ["5.5"] },
    { "id": 17, "tasks": ["5.6", "6.1", "6.2"] },
    { "id": 18, "tasks": ["6.3", "6.4"] },
    { "id": 19, "tasks": ["6.5", "7.1"] },
    { "id": 20, "tasks": ["7.2"] },
    { "id": 21, "tasks": ["7.3"] }
  ]
}
```
