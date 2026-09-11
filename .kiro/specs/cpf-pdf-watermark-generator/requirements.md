# Requirements Document

## Introduction

Sistema web para geração de PDFs personalizados com a marca d'água do CPF do usuário inserida no cabeçalho e rodapé de cada página. O sistema permite rastrear vazamentos de conteúdo restrito (apostilas, materiais de curso), pois cada PDF baixado fica vinculado ao CPF de quem o solicitou.

Construído como monorepo Nx com:

- `apps/web` — Angular 21 (Standalone Components, Signals, Angular Material)
- `apps/api` — NestJS com arquitetura hexagonal, PostgreSQL, Prisma 7, PDFKit e autenticação JWT
- `libs/shared` — tipos, enums, contratos da API e funções puras de CPF, sem dependências externas

Todas as rotas da API ficam sob o prefixo `/api` (ex.: `POST /api/auth/login`). Rotas sem esse prefixo (ex.: `/auth/login`, `/documents`) referem-se a rotas do Angular no navegador. Nos critérios abaixo, os endpoints são escritos sem o prefixo por brevidade quando o contexto é o Backend.

## Glossary

- **System**: O sistema completo cpf-pdf-watermark-generator (web + api).
- **Backend**: A aplicação NestJS em `apps/api`, com arquitetura hexagonal.
- **Frontend**: A aplicação Angular 21 em `apps/web`, com Standalone Components, Signals e Angular Material.
- **Shared_Lib**: A biblioteca `libs/shared` (alias `@cpf-pdf/shared`), importada pelo Backend e pelo Frontend.
- **CPF_Validator**: O Value Object `Cpf` do domínio, apoiado nas funções puras de CPF da Shared_Lib.
- **PDF_Generator**: O adaptador `PdfKitGeneratorAdapter` que implementa `PdfGeneratorPort` e produz buffers PDF.
- **Auth_Service**: O conjunto de casos de uso de autenticação (`RegisterUserUseCase`, `AuthenticateUserUseCase`).
- **Document_Service**: O conjunto de casos de uso responsável pelo CRUD e pela geração de PDFs personalizados.
- **Download_Logger**: O componente responsável por registrar logs de download na tabela `download_logs`.
- **JWT_Guard**: O guard `JwtAuthGuard` que valida tokens Bearer nas requisições HTTP.
- **Role_Guard**: O guard `RolesGuard` que verifica se o usuário autenticado possui a role exigida pelo endpoint.
- **CI**: O workflow do GitHub Actions do repositório.
- **UserEntity**: Entidade de domínio com `id`, `name`, `email`, `cpf` (Value Object `Cpf`), `passwordHash`, `role` (`USER` ou `ADMIN`).
- **DocumentEntity**: Entidade de domínio com `id`, `title`, `description`, `content`, `isActive`. (O sufixo `Entity` evita conflito com o tipo global `Document` do DOM e com o tipo gerado pelo Prisma.)
- **DownloadLogEntity**: Registro que associa um `userId` a um `documentId` no momento do download.
- **CPF mascarado**: CPF com os 3 primeiros e os 2 últimos dígitos visíveis, no formato `529.***.***-25`.
- **CPF parcial**: Os 3 primeiros e os 2 últimos dígitos do CPF separados por hífen, no formato `529-25`.
- **ADMIN**: Role com acesso total, incluindo operações de CRUD em documentos e listagem de usuários.
- **USER**: Role padrão com acesso à listagem e download de documentos.

---

## Requirements

### Requirement 1: Registro de Usuário

**User Story:** Como visitante, quero criar uma conta no sistema, para que eu possa acessar e baixar documentos com meu CPF.

#### Acceptance Criteria

1. WHEN um visitante envia nome, email, CPF e senha válidos para `POST /auth/register`, THE Auth_Service SHALL criar um novo usuário com a role padrão `USER` e retornar HTTP 201.
2. WHEN o CPF fornecido no registro não passa na validação dos dígitos verificadores pelo algoritmo módulo 11, THE Auth_Service SHALL rejeitar o cadastro e retornar HTTP 400 com uma mensagem de erro indicando CPF inválido.
3. WHEN o email fornecido no registro já está cadastrado para outro usuário, THE Auth_Service SHALL rejeitar o cadastro e retornar HTTP 409 com uma mensagem de erro indicando conflito de email ou CPF.
4. WHEN o CPF fornecido no registro já está cadastrado para outro usuário, THE Auth_Service SHALL rejeitar o cadastro e retornar HTTP 409 com uma mensagem de erro indicando conflito de email ou CPF.
5. THE Auth_Service SHALL armazenar a senha do usuário exclusivamente como hash bcrypt, nunca em texto puro.
6. WHEN um visitante envia a requisição de registro sem um ou mais campos obrigatórios (nome, email, CPF ou senha), THE Auth_Service SHALL rejeitar o cadastro e retornar HTTP 400 com uma mensagem de erro indicando os campos ausentes.
7. WHEN um visitante fornece nome com menos de 2 ou mais de 100 caracteres, email com mais de 254 caracteres, ou senha com menos de 8 ou mais de 128 caracteres, THE Auth_Service SHALL rejeitar o cadastro e retornar HTTP 400 com uma mensagem de erro indicando o campo inválido.
8. IF duas requisições simultâneas com o mesmo email ou CPF passarem pela verificação prévia de unicidade, THEN THE Backend SHALL converter a violação de restrição única do banco (Prisma `P2002`) em HTTP 409, nunca em HTTP 500.
9. THE Backend SHALL retornar na resposta de registro somente dados públicos do usuário (`id`, `name`, `email`, `role`), nunca o `passwordHash`.

---

### Requirement 2: Validação de CPF

**User Story:** Como desenvolvedor, quero que o sistema valide CPFs usando o algoritmo oficial de dígitos verificadores, para que somente CPFs reais sejam aceitos.

#### Acceptance Criteria

1. WHEN um CPF é fornecido ao CPF_Validator, THE CPF_Validator SHALL remover caracteres não numéricos antes de verificar o comprimento e os dígitos verificadores, e retornar `true` somente se o CPF possuir exatamente 11 dígitos e ambos os dígitos verificadores passarem pelo algoritmo módulo 11.
2. WHEN um CPF composto por todos os dígitos iguais (ex.: `000.000.000-00`) é fornecido ao CPF_Validator, THE CPF_Validator SHALL retornar `false`, pois trata-se de CPF inválido por definição.
3. WHEN um CPF inválido é fornecido a `Cpf.create()`, THE CPF_Validator SHALL lançar o erro de domínio `InvalidCpfError`.
4. WHEN um CPF válido (com ou sem formatação) é fornecido, THE CPF_Validator SHALL retornar em `formatted()` a string no formato `XXX.XXX.XXX-XX`.
5. THE System SHALL implementar as funções puras de normalização, validação, formatação, mascaramento e CPF parcial na Shared_Lib, reutilizadas pelo Backend (Value Object `Cpf`) e pelo Frontend (validador do formulário de cadastro).

---

### Requirement 3: Autenticação JWT

**User Story:** Como usuário registrado, quero fazer login no sistema, para que eu possa obter um token de acesso e utilizar as funcionalidades protegidas.

#### Acceptance Criteria

1. IF um usuário envia email e senha corretos para `POST /auth/login`, THEN THE Auth_Service SHALL retornar uma resposta de sucesso com um token JWT assinado contendo `sub` (userId), `email` e `role` no payload.
2. IF um usuário envia email inexistente ou senha incorreta para `POST /auth/login`, THEN THE Auth_Service SHALL retornar HTTP 401 com uma mensagem de erro indicando credenciais inválidas, sem revelar qual dos dois estava errado.
3. IF uma requisição é feita a um endpoint protegido sem o cabeçalho `Authorization: Bearer <token>`, THEN THE JWT_Guard SHALL rejeitar a requisição com HTTP 401.
4. IF uma requisição é feita a um endpoint protegido com um token JWT expirado, malformado ou com assinatura inválida, THEN THE JWT_Guard SHALL rejeitar a requisição com HTTP 401.
5. THE System SHALL configurar tokens JWT com tempo de expiração máximo de 24 horas.
6. WHILE o usuário possui um token JWT válido e não expirado, THE Frontend SHALL incluir automaticamente o cabeçalho `Authorization: Bearer <token>` em todas as requisições a endpoints protegidos.
7. WHEN o Frontend recebe HTTP 401 de um endpoint protegido (qualquer endpoint exceto `/api/auth/login` e `/api/auth/register`), THE Frontend SHALL remover o token do `localStorage` e redirecionar o usuário para a rota `/auth/login`.
8. WHEN o Frontend recebe HTTP 401 de `/api/auth/login`, THE Frontend SHALL NOT redirecionar e SHALL repassar o erro ao formulário de login para exibição da mensagem (ver 10.4).

---

### Requirement 4: Controle de Acesso Baseado em Roles

**User Story:** Como administrador, quero que endpoints sensíveis sejam restritos à role ADMIN, para que usuários comuns não possam modificar documentos ou visualizar dados de outros usuários.

#### Acceptance Criteria

1. WHEN um usuário com role `USER` tenta acessar um endpoint decorado com `@Roles(Role.ADMIN)`, THE Role_Guard SHALL rejeitar a requisição com HTTP 403, mesmo que o JWT seja válido.
2. WHEN uma requisição sem token JWT válido é feita a um endpoint protegido com `@Roles(Role.ADMIN)`, THE JWT_Guard SHALL rejeitar a requisição com HTTP 401, antes que o Role_Guard seja verificado.
3. WHEN um usuário com role `ADMIN` acessa o endpoint requisitado do sistema com JWT válido, THE Role_Guard SHALL permitir o acesso.
4. WHEN uma requisição é feita aos endpoints `POST /documents`, `PATCH /documents/:id`, `DELETE /documents/:id` ou `GET /users`, THE System SHALL verificar se o usuário autenticado possui a role `ADMIN` e rejeitar com HTTP 403 caso contrário.
5. WHEN uma requisição é feita aos endpoints `GET /documents`, `GET /documents/:id` ou `GET /documents/:id/pdf`, THE System SHALL permitir o acesso a usuários autenticados com role `USER` ou `ADMIN`.

---

### Requirement 5: Gerenciamento de Documentos (CRUD)

**User Story:** Como administrador, quero gerenciar o catálogo de documentos, para que eu possa adicionar, atualizar e remover materiais disponíveis para download.

#### Acceptance Criteria

1. WHEN um administrador envia título não vazio (≤255 caracteres), descrição (≤1000 caracteres) e conteúdo não vazio para `POST /documents`, THE Document_Service SHALL criar um novo documento com `isActive = true` e retornar HTTP 201 com os dados do documento criado.
2. WHEN um administrador envia dados atualizados para `PATCH /documents/:id` com um ID existente, THE Document_Service SHALL atualizar somente os campos fornecidos (título, descrição ou conteúdo) e retornar HTTP 200 com os dados do documento atualizado.
3. WHEN um administrador envia `DELETE /documents/:id` com um ID existente, THE Document_Service SHALL marcar o documento como inativo (`isActive = false`) e retornar HTTP 200.
4. IF `GET /documents/:id` é chamado com um ID inexistente ou de documento inativo, THEN THE Document_Service SHALL retornar HTTP 404 com uma mensagem de erro indicando que o documento não foi encontrado.
5. IF um usuário autenticado acessa `GET /documents`, THEN THE Document_Service SHALL retornar somente documentos com `isActive = true`.
6. WHEN um administrador envia `POST /documents` com título ausente ou conteúdo ausente, THE Document_Service SHALL retornar HTTP 400 com uma mensagem de erro indicando os campos inválidos.
7. IF `PATCH /documents/:id` ou `DELETE /documents/:id` é chamado com um ID inexistente, THEN THE Document_Service SHALL retornar HTTP 404 com uma mensagem de erro indicando que o documento não foi encontrado.

---

### Requirement 6: Listagem de Documentos

**User Story:** Como usuário autenticado, quero visualizar a lista de documentos disponíveis, para que eu possa escolher qual material desejo baixar.

#### Acceptance Criteria

1. WHEN um usuário autenticado acessa `GET /documents`, THE Document_Service SHALL retornar HTTP 200 com uma lista dos documentos ativos, contendo ao menos `id`, `title` (≤255 caracteres) e `description` (≤1000 caracteres).
2. IF a requisição a `GET /documents` falhar por erro interno, THEN THE Backend SHALL retornar uma mensagem de erro genérica, sem expor stack trace ou dados internos do sistema.
3. IF a lista de documentos retornada estiver vazia, THEN THE Frontend SHALL exibir uma mensagem indicando que nenhum documento está disponível, em vez de uma lista em branco.
4. WHEN a lista de documentos é exibida no Frontend, THE Frontend SHALL renderizar cada documento usando componentes Angular Material (`mat-card` para os cards de documento, `mat-button` para o botão de download).
5. WHILE os documentos estão sendo carregados do backend, THE Frontend SHALL exibir um indicador de carregamento e desabilitar interações com a lista até que o carregamento seja concluído ou falhe.
6. IF o carregamento da lista falhar, THEN THE Frontend SHALL exibir uma mensagem de erro com a opção de tentar novamente.

---

### Requirement 7: Geração de PDF Personalizado com CPF

**User Story:** Como usuário autenticado, quero baixar um PDF com meu CPF inserido em todas as páginas, para que o documento fique vinculado à minha identidade.

#### Acceptance Criteria

1. WHEN um usuário autenticado acessa `GET /documents/:id/pdf`, THE Document_Service SHALL buscar o documento e o usuário autenticado e retornar o PDF gerado como binário com `Content-Type: application/pdf`.
2. WHEN o PDF é gerado pelo PDF_Generator, THE PDF_Generator SHALL inserir o texto `CPF: <cpf_formatado> | <nome_do_usuario>` no cabeçalho e no rodapé de cada página do documento.
3. WHEN o PDF é gerado, THE PDF_Generator SHALL usar o CPF formatado (`XXX.XXX.XXX-XX`) do usuário autenticado que fez a requisição, nunca o CPF de outro usuário.
4. THE PDF_Generator SHALL garantir que o conteúdo do documento não sobreponha as áreas de cabeçalho e rodapé, e que a inserção do carimbo não gere páginas adicionais (o número de páginas do PDF é igual ao número de páginas necessárias para o conteúdo).
5. IF `GET /documents/:id/pdf` é chamado com um ID de documento inexistente ou inativo, THEN THE Document_Service SHALL retornar HTTP 404 com uma mensagem de erro indicando que o documento não foi encontrado.
6. IF um erro interno ocorre durante a geração do PDF, THEN THE Document_Service SHALL retornar HTTP 500 com uma mensagem de erro indicando falha na geração.
7. WHEN o PDF é retornado, THE Backend SHALL enviar o cabeçalho `Content-Disposition: attachment; filename="documento-<id>-<cpf_parcial>.pdf"` (ex.: `documento-cm1abc-529-25.pdf`).
8. WHEN o Frontend recebe o PDF, THE Frontend SHALL iniciar o download automático no navegador usando o nome de arquivo informado no cabeçalho `Content-Disposition`.

---

### Requirement 8: Registro de Log de Download

**User Story:** Como administrador, quero que cada download de PDF seja registrado no sistema, para que eu possa rastrear quem baixou cada documento.

#### Acceptance Criteria

1. WHEN a geração de um PDF é concluída com sucesso, THE Download_Logger SHALL criar exatamente um registro em `download_logs` associando o `userId` ao `documentId` com o timestamp gerado pelo servidor no momento da operação.
2. WHEN a geração do PDF falha antes de ser concluída, THE Download_Logger SHALL não criar nenhum registro em `download_logs`.
3. WHEN a geração do PDF é concluída com sucesso, THE System SHALL salvar o registro em `download_logs` antes de retornar o PDF ao cliente.
4. WHEN a persistência do registro em `download_logs` falha após a geração do PDF, THE System SHALL não retornar o PDF ao cliente e SHALL retornar HTTP 500 com uma mensagem de erro indicando falha no registro do download.

---

### Requirement 9: Listagem de Usuários (ADMIN)

**User Story:** Como administrador, quero visualizar todos os usuários cadastrados, para que eu possa gerenciar os acessos ao sistema.

#### Acceptance Criteria

1. WHEN um administrador autenticado acessa `GET /users`, THE System SHALL retornar HTTP 200 com a lista de todos os usuários cadastrados, onde cada entrada contém ao menos `id`, `name`, `email`, `cpf` e `role`, e onde `cpf` é o CPF mascarado (ex.: `529.***.***-25`).
2. WHEN um administrador autenticado acessa `GET /users` e nenhum usuário estiver cadastrado, THE System SHALL retornar HTTP 200 com uma lista vazia.
3. WHEN um usuário com role `USER` tenta acessar `GET /users`, THE Role_Guard SHALL retornar HTTP 403 com uma mensagem de erro indicando acesso não autorizado, sem expor detalhes internos do sistema.
4. IF a requisição a `GET /users` não contiver token de autenticação válido, THEN THE System SHALL retornar HTTP 401 com uma mensagem de erro indicando falha de autenticação.
5. THE System SHALL nunca incluir o `passwordHash` nem o CPF completo na resposta de `GET /users`.

---

### Requirement 10: Frontend — Autenticação e Navegação

**User Story:** Como usuário, quero uma interface web intuitiva para fazer login e navegar pelos documentos, para que eu possa usar o sistema sem conhecimento técnico.

#### Acceptance Criteria

1. WHEN um usuário não autenticado tenta acessar rotas protegidas no Frontend, THE Frontend SHALL redirecionar para `/auth/login`.
2. WHEN um usuário preenche email e senha válidos no formulário de login e submete, THE Frontend SHALL enviar as credenciais ao backend e armazenar o token JWT retornado no `localStorage`. O formulário SHALL usar componentes Angular Material (`mat-form-field`, `matInput`, `mat-button`).
3. WHEN o login é bem-sucedido, THE Frontend SHALL redirecionar o usuário para a rota `/documents`.
4. IF o login falhar por credenciais inválidas, THEN THE Frontend SHALL exibir uma mensagem de erro indicando que as credenciais são inválidas sem limpar o campo de email.
5. WHEN um usuário autenticado tenta acessar uma rota protegida, THE Frontend SHALL verificar a presença de um token JWT válido no `localStorage` antes de permitir o acesso.
6. IF o token JWT armazenado estiver ausente ou expirado ao tentar acessar uma rota protegida, THEN THE Frontend SHALL remover o token do `localStorage` e redirecionar o usuário para `/auth/login`.
7. WHERE o usuário possui role `ADMIN`, THE Frontend SHALL exibir rotas e funcionalidades administrativas adicionais (gestão de documentos e listagem de usuários).
8. THE Frontend SHALL oferecer uma tela de cadastro em `/auth/register`, validando o CPF no cliente com a mesma função da Shared_Lib usada pelo Backend.
9. WHEN o usuário aciona "Sair", THE Frontend SHALL remover o token do `localStorage` e redirecionar para `/auth/login`.

---

### Requirement 11: Layout Responsivo

**User Story:** Como usuário, quero acessar o sistema em qualquer dispositivo (desktop, tablet ou celular), para que eu possa baixar documentos de onde estiver.

#### Acceptance Criteria

1. WHEN o usuário acessa o sistema em uma tela com largura menor que 600px (mobile), THE Frontend SHALL adaptar o layout para uma coluna única, ocultando elementos secundários e garantindo que todos os controles sejam acessíveis por toque.
2. WHEN a lista de documentos é exibida, THE Frontend SHALL usar Angular CDK BreakpointObserver ou CSS Grid/Flexbox para renderizar os cards em 1 coluna em mobile, 2 colunas em tablet (600px–959px) e 3 colunas em desktop (≥960px).
3. WHEN o usuário acessa o sistema em dispositivo mobile, THE Frontend SHALL substituir a navegação horizontal por um `mat-sidenav` acionado por menu hambúrguer na `mat-toolbar`.
4. WHEN formulários são exibidos em mobile, THE Frontend SHALL garantir que todos os campos `mat-form-field` ocupem 100% da largura disponível e que o botão de ação seja facilmente clicável (altura mínima de 44px).
5. THE Frontend SHALL garantir que nenhum conteúdo seja cortado ou exija scroll horizontal em qualquer tamanho de tela padrão (320px ou maior).

---

### Requirement 12: Containerização com Docker

**User Story:** Como desenvolvedor, quero rodar todo o sistema com um único comando Docker Compose, para que o ambiente seja reproduzível sem configuração manual.

#### Acceptance Criteria

1. THE System SHALL fornecer um `docker-compose.yml` na raiz do monorepo que defina três serviços: `web`, `api` e `postgres`, todos na mesma rede Docker interna.
2. WHEN `docker compose up --build` é executado na raiz do projeto, THE System SHALL iniciar os três serviços e o Frontend SHALL estar acessível em `http://localhost:80`.
3. THE `web` container SHALL usar Dockerfile multi-stage: stage 1 compila o Angular com Node.js (`nx build web`), stage 2 serve `dist/apps/web/browser` com Nginx, configurado com proxy reverso de `/api/` para `http://api:3000` preservando o prefixo `/api`, e com fallback `try_files ... /index.html` para que as rotas do Angular funcionem ao recarregar a página.
4. THE `api` container SHALL usar Dockerfile multi-stage: stage 1 instala dependências, gera o cliente Prisma e compila o NestJS (`nx build api`), stage 2 copia apenas os artefatos compilados, o schema/migrations do Prisma e as dependências de produção para uma imagem Node.js Alpine enxuta.
5. THE `postgres` container SHALL usar a imagem oficial `postgres:16-alpine` com um volume Docker nomeado para persistir os dados e um healthcheck (`pg_isready`); THE `api` container SHALL aguardar o `postgres` ficar saudável antes de iniciar.
6. THE `api` container SHALL executar as migrations do Prisma (`prisma migrate deploy`) automaticamente ao iniciar, antes de subir o servidor NestJS.
7. THE System SHALL usar um arquivo `.env` na raiz para centralizar variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`) referenciadas no `docker-compose.yml`.
8. THE System SHALL fornecer um arquivo `.env.example` com todas as variáveis necessárias e valores de exemplo, sem expor segredos reais.
9. WHILE em desenvolvimento local, THE System SHALL permitir subir somente o banco com `docker compose up -d postgres`, rodando `api` e `web` fora de containers.

---

### Requirement 13: Configuração da API e Ambiente de Desenvolvimento

**User Story:** Como desenvolvedor, quero que front e back conversem da mesma forma em desenvolvimento e em produção, para evitar problemas de CORS e diferenças de URL entre ambientes.

#### Acceptance Criteria

1. THE Backend SHALL registrar todas as rotas sob o prefixo global `/api` (`app.setGlobalPrefix('api')`).
2. THE Frontend SHALL usar URLs relativas iniciadas em `/api` em todas as chamadas HTTP, sem host fixo no código.
3. WHILE em desenvolvimento (`nx serve web`), THE Frontend SHALL usar o proxy do dev server (`proxy.conf.json`) encaminhando `/api` para `http://localhost:3000`, de modo que front e back se comportem como mesma origem.
4. THE Backend SHALL aplicar um `ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`.
5. WHEN o Backend inicia sem as variáveis obrigatórias (`DATABASE_URL`, `JWT_SECRET`), THE Backend SHALL falhar na inicialização com uma mensagem indicando quais variáveis estão ausentes.
6. THE System SHALL fornecer um script de seed que cria um usuário `ADMIN` (credenciais lidas de `ADMIN_EMAIL` e `ADMIN_PASSWORD`) e documentos de exemplo; WHEN o seed é executado mais de uma vez, THE System SHALL não duplicar registros.

---

### Requirement 14: Qualidade do Repositório e CI

**User Story:** Como desenvolvedor publicando o projeto no GitHub, quero validação automática a cada push e um repositório bem documentado, para que qualquer pessoa consiga entender, rodar e confiar no projeto.

#### Acceptance Criteria

1. THE System SHALL fornecer o workflow `.github/workflows/ci.yml` que, em todo push e pull request para `main`, instala dependências, gera o cliente Prisma e executa lint, testes e build dos projetos afetados (`nx affected -t lint test build`).
2. WHEN qualquer etapa de lint, teste ou build falhar, THE CI SHALL marcar a execução como falha.
3. THE System SHALL fornecer um `README.md` na raiz contendo: descrição do projeto, stack, badge de status do CI, como rodar em desenvolvimento, como rodar com Docker, variáveis de ambiente e credenciais do seed.
4. THE System SHALL fornecer um `.gitignore` que exclua `node_modules`, `dist`, `coverage`, `.env`, `.nx/cache`, `.nx/workspace-data` e o cliente Prisma gerado (`apps/api/src/generated`).

---

## Fora de Escopo (v2)

Itens registrados para uma versão futura, não fazem parte dos critérios acima:

- **Upload de PDF real:** o ADMIN envia um PDF pronto (apostila) e o Backend carimba o CPF em cada página usando `pdf-lib`, em vez de gerar o PDF a partir de texto com PDFKit. Um novo adaptador de `PdfGeneratorPort` (ou uma porta `PdfStamperPort`) sem alterar os casos de uso.
- **Tela de logs de download** para o ADMIN (quem baixou o quê e quando).
- **Refresh token** e armazenamento do token em cookie `httpOnly` em vez de `localStorage`.
- **Rate limiting** no login (`@nestjs/throttler`).
- **Documentação da API** com Swagger (`@nestjs/swagger`).
