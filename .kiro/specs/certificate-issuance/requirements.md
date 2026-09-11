# Requirements Document

## Introduction

Emissão de certificados de conclusão de curso com **código único de verificação, QR Code e hash**, no mesmo sistema (CertDocs). Enquanto a v1 responde "quem vazou este documento?", esta feature responde "este certificado é autêntico?".

O aluno solicita o certificado de um curso, o ADMIN aprova (emitindo) ou recusa, e qualquer pessoa pode verificar a autenticidade em uma página pública, sem login. O certificado tem **um único modelo visual**, no estilo de diploma universitário, gerado como **PDF vetorial** a partir de um template HTML/CSS renderizado por Chromium sem interface (headless).

Depende da v1: autenticação JWT, roles `USER`/`ADMIN`, arquitetura hexagonal da API e shell do frontend Angular.

**Fora do alcance desta feature:** diploma de graduação oficial (o Diploma Digital do MEC exige XML assinado com certificado ICP-Brasil). Esta feature atende cursos livres, extensão, eventos e treinamentos.

## Glossary

- **Course**: Curso cadastrado pelo ADMIN, com título, descrição, coordenador, módulos e carga horária total.
- **Module**: Parte do conteúdo programático de um curso, com título, carga horária em horas e ordem de exibição.
- **Certificate_Request**: Pedido de certificado feito por um USER para um curso, com status `PENDING`, `APPROVED` ou `REJECTED`.
- **Certificate**: Certificado emitido a partir de um pedido aprovado, com status `VALID` ou `REVOKED`.
- **Snapshot**: Cópia dos dados usados no certificado (nome, CPF, curso, módulos, carga horária, período, assinantes) gravada no momento da emissão e nunca alterada depois.
- **Verification_Code**: Código único e aleatório no formato `CERT-XXXX-XXXX-XXXX` (alfabeto Crockford Base32, sem caracteres ambíguos), impresso no certificado.
- **Data_Hash**: SHA-256 da forma canônica de `{ snapshot, code, registry }` (Snapshot, Verification_Code e número do Registry), impresso no verso do certificado.
- **File_Hash**: SHA-256 dos bytes do arquivo PDF emitido, guardado no banco para verificar se um arquivo foi alterado.
- **Registry**: Número de registro sequencial por ano (`2026.000418`), com livro e folha derivados, seguindo a convenção dos diplomas brasileiros.
- **Certificate_Renderer**: Adaptador que transforma o template HTML/CSS preenchido em PDF usando Chromium headless.
- **Verification_Page**: Página pública do frontend em `/verificar/:code`.
- **Institution_Settings**: Dados fixos da instituição usados no certificado (nome, cidade, diretor e cargo).

---

## Requirements

### Requirement 1: Cadastro de Cursos

**User Story:** Como ADMIN, quero cadastrar cursos com módulos e carga horária, para que os certificados tragam o conteúdo programático correto.

#### Acceptance Criteria

1. WHEN um ADMIN envia título (≤200 caracteres), coordenador (≤100 caracteres), descrição opcional (≤1000 caracteres) e de 1 a 12 módulos para `POST /courses`, THE System SHALL criar o curso ativo e retornar HTTP 201.
2. THE System SHALL exigir que cada módulo tenha título não vazio (≤120 caracteres) e carga horária inteira entre 1 e 999 horas, rejeitando com HTTP 400 caso contrário.
3. THE System SHALL calcular a carga horária total do curso como a soma das cargas horárias dos módulos, sem aceitar esse valor do cliente.
4. WHEN um ADMIN envia `PATCH /courses/:id`, THE System SHALL atualizar os campos enviados e, se módulos forem enviados, substituir a lista completa de módulos preservando a ordem recebida.
5. WHEN um ADMIN envia `DELETE /courses/:id`, THE System SHALL desativar o curso (soft delete), que deixa de aceitar novos pedidos, sem afetar pedidos e certificados existentes.
6. WHEN um usuário autenticado acessa `GET /courses`, THE System SHALL retornar somente cursos ativos, com título, descrição, carga horária total e módulos.
7. WHEN um USER tenta criar, alterar ou desativar um curso, THE System SHALL rejeitar com HTTP 403.

---

### Requirement 2: Solicitação de Certificado

**User Story:** Como aluno, quero solicitar o certificado de um curso que concluí, para que o ADMIN possa emiti-lo.

#### Acceptance Criteria

1. WHEN um USER envia `POST /certificate-requests` com o id de um curso ativo, THE System SHALL criar um pedido com status `PENDING` associado ao usuário do token e retornar HTTP 201.
2. IF o usuário já possui um pedido `PENDING` ou um certificado `VALID` para o mesmo curso, THEN THE System SHALL rejeitar o novo pedido com HTTP 409.
3. WHEN o usuário não possui pedido `PENDING` nem certificado `VALID` para o curso (ex.: pedido anterior recusado ou certificado revogado), THE System SHALL permitir um novo pedido.
4. IF o curso não existe ou está desativado, THEN THE System SHALL rejeitar o pedido com HTTP 404.
5. WHEN um usuário acessa `GET /me/certificate-requests`, THE System SHALL retornar somente os pedidos dele, com curso, status, data do pedido e, quando houver, motivo da recusa.
6. THE System SHALL garantir no banco, por colunas-chave únicas (preenchidas só enquanto o pedido está `PENDING` ou o certificado está `VALID`), no máximo um pedido `PENDING` e no máximo um certificado `VALID` por usuário e curso, convertendo a violação em HTTP 409 quando duas requisições simultâneas passarem pela verificação prévia.

---

### Requirement 3: Análise de Pedidos (ADMIN)

**User Story:** Como ADMIN, quero ver os pedidos pendentes e aprová-los ou recusá-los, para que só alunos que concluíram o curso recebam certificado.

#### Acceptance Criteria

1. WHEN um ADMIN acessa `GET /certificate-requests`, THE System SHALL retornar os pedidos com aluno (nome, email, CPF mascarado), curso, status e data, com filtro opcional por status e ordenação do mais antigo para o mais recente.
2. WHEN um ADMIN envia `POST /certificate-requests/:id/approve` com data de conclusão e data de início opcional para um pedido `PENDING`, THE System SHALL mudar o pedido para `APPROVED` e emitir exatamente um certificado (Requirement 4) na mesma transação.
3. WHEN um ADMIN envia `POST /certificate-requests/:id/reject` com motivo (10 a 500 caracteres) para um pedido `PENDING`, THE System SHALL mudar o pedido para `REJECTED`, guardar o motivo e não emitir certificado.
4. IF o pedido não está `PENDING`, THEN THE System SHALL rejeitar a aprovação ou recusa com HTTP 409.
5. IF a data de conclusão é futura ou anterior à data de início, THEN THE System SHALL rejeitar a aprovação com HTTP 400.
6. IF a emissão do certificado falhar em qualquer etapa (renderização, gravação do arquivo ou do registro), THEN THE System SHALL manter o pedido `PENDING`, não gravar certificado parcial e retornar HTTP 500.
7. WHEN um USER tenta listar, aprovar ou recusar pedidos de outros usuários, THE System SHALL rejeitar com HTTP 403.

---

### Requirement 4: Emissão do Certificado

**User Story:** Como ADMIN, quero que a aprovação gere um certificado único e rastreável, para que ele possa ser verificado por qualquer pessoa.

#### Acceptance Criteria

1. WHEN um pedido é aprovado, THE System SHALL gravar um Snapshot com nome e CPF do aluno, título, coordenador, módulos e carga horária do curso, período, data de emissão e dados da instituição.
2. WHEN o curso ou o usuário forem alterados depois da emissão, THE System SHALL manter o certificado emitido com os dados do Snapshot, sem refletir as alterações.
3. THE System SHALL gerar um Verification_Code aleatório com ao menos 60 bits de entropia, único no banco, no formato `CERT-XXXX-XXXX-XXXX`.
4. THE System SHALL atribuir um Registry sequencial por ano de emissão, sem repetição mesmo sob emissões simultâneas, com livro = ⌈sequência / 200⌉ e folha = ((sequência − 1) mod 200) + 1.
5. THE System SHALL calcular o Data_Hash a partir da forma canônica (chaves ordenadas, datas em ISO 8601) de `{ snapshot, code, registry }`.
6. THE System SHALL gerar o PDF uma única vez na emissão, guardá-lo e gravar o File_Hash dos bytes gerados.
7. THE System SHALL registrar no certificado o ADMIN que aprovou e a data e hora da emissão.

---

### Requirement 5: Modelo Visual do Certificado

**User Story:** Como aluno, quero um certificado bonito e com cara de documento oficial, para que eu possa apresentá-lo com orgulho.

#### Acceptance Criteria

1. THE Certificate_Renderer SHALL gerar PDF em A4 paisagem com duas páginas: frente e verso.
2. THE Certificate_Renderer SHALL compor a frente com: moldura guilloché, brasão e nome da instituição, título "CERTIFICADO" com subtítulo "de conclusão de curso", nome do aluno em fonte caligráfica, texto de conclusão com CPF formatado, curso, carga horária e período, local e data por extenso, selo dourado com fitas, duas assinaturas (diretor e coordenador), Registry e bloco com Verification_Code e QR Code.
3. THE Certificate_Renderer SHALL compor o verso com: conteúdo programático (módulos e carga horária de cada um, com total), bloco de autenticidade com QR Code, Verification_Code, data e hora de emissão e Data_Hash, e rodapé com Registry e natureza do curso.
4. THE Certificate_Renderer SHALL gerar todos os elementos gráficos como vetor (texto, SVG e CSS), sem imagens rasterizadas nem Canvas, de modo que o texto do PDF seja selecionável e nítido em qualquer zoom.
5. THE Certificate_Renderer SHALL embutir as fontes no PDF a partir de arquivos locais, sem depender de acesso à internet em tempo de execução.
6. THE System SHALL escapar todos os dados inseridos no template HTML, impedindo que conteúdo de usuário injete marcação ou scripts.
7. WHEN o nome do aluno for longo, THE Certificate_Renderer SHALL reduzir o tamanho da fonte do nome até caber em uma linha dentro da largura útil (mínimo de 30% do tamanho original, suficiente para 100 caracteres), sem cortar o texto.
8. THE Certificate_Renderer SHALL gerar o QR Code apontando para `<PUBLIC_WEB_URL>/verificar/<Verification_Code>`.

---

### Requirement 6: Certificados do Aluno

**User Story:** Como aluno, quero ver e baixar meus certificados, para que eu possa guardá-los e compartilhá-los.

#### Acceptance Criteria

1. WHEN um usuário acessa `GET /me/certificates`, THE System SHALL retornar somente os certificados dele, com curso, data de emissão, Verification_Code e status.
2. WHEN o dono do certificado ou um ADMIN acessa `GET /certificates/:id/pdf`, THE System SHALL retornar o PDF guardado na emissão com `Content-Type: application/pdf` e `Content-Disposition: attachment; filename="certificado-<code>.pdf"`.
3. IF um USER tenta baixar certificado de outro usuário, THEN THE System SHALL retornar HTTP 404, sem revelar que o certificado existe.
4. WHEN um certificado revogado é baixado, THE System SHALL entregar o arquivo original, e a Verification_Page SHALL indicar a revogação.

---

### Requirement 7: Histórico de Certificados (ADMIN)

**User Story:** Como ADMIN, quero consultar todos os certificados emitidos, para que eu tenha controle do que foi emitido, para quem e quando.

#### Acceptance Criteria

1. WHEN um ADMIN acessa `GET /certificates`, THE System SHALL retornar os certificados emitidos com aluno (nome e CPF mascarado), curso, Registry, Verification_Code, status, data de emissão e ADMIN que aprovou, ordenados do mais recente para o mais antigo.
2. THE System SHALL permitir filtrar o histórico por status, curso, intervalo de datas de emissão e busca textual por nome do aluno ou Verification_Code.
3. THE System SHALL paginar o histórico com tamanho de página padrão de 20 e máximo de 100, retornando o total de registros.
4. WHEN um ADMIN acessa `GET /certificates/:id`, THE System SHALL retornar o Snapshot completo, os hashes e, se revogado, data, motivo e ADMIN que revogou.

---

### Requirement 8: Revogação

**User Story:** Como ADMIN, quero revogar um certificado emitido por engano, para que ele deixe de ser aceito como válido.

#### Acceptance Criteria

1. WHEN um ADMIN envia `POST /certificates/:id/revoke` com motivo (10 a 500 caracteres) para um certificado `VALID`, THE System SHALL mudar o status para `REVOKED` e registrar data, motivo e ADMIN responsável.
2. IF o certificado já está `REVOKED`, THEN THE System SHALL rejeitar a revogação com HTTP 409.
3. THE System SHALL manter o certificado revogado no histórico e nunca excluí-lo.
4. WHEN um certificado é revogado, THE System SHALL permitir que o aluno faça um novo pedido para o mesmo curso.

---

### Requirement 9: Verificação Pública

**User Story:** Como qualquer pessoa (ex.: recrutador), quero verificar um certificado pelo código ou QR Code, para que eu saiba se ele é autêntico.

#### Acceptance Criteria

1. WHEN qualquer pessoa acessa `GET /public/certificates/:code`, sem autenticação, THE System SHALL retornar o status (`VALID` ou `REVOKED`), nome do aluno, CPF mascarado, curso, carga horária, período, data de emissão e Registry.
2. WHEN o certificado está `REVOKED`, THE System SHALL incluir a data e o motivo da revogação na resposta.
3. IF o código não corresponde a nenhum certificado, THEN THE System SHALL retornar HTTP 404 com mensagem indicando que o certificado não foi encontrado.
4. THE System SHALL aceitar o código com ou sem hífens e em letras maiúsculas ou minúsculas, normalizando antes da busca.
5. THE System SHALL nunca expor na verificação pública o CPF completo, o email, o arquivo PDF nem dados de quem aprovou.
6. THE System SHALL limitar a 30 requisições por minuto por IP os endpoints públicos de verificação, retornando HTTP 429 quando excedido.
7. THE Frontend SHALL oferecer a Verification_Page em `/verificar` (campo para digitar o código) e `/verificar/:code` (resultado direto, usado pelo QR Code), acessíveis sem login.

---

### Requirement 10: Verificação de Integridade do Arquivo

**User Story:** Como quem recebeu um certificado em PDF, quero conferir se o arquivo não foi editado, para que eu não aceite um documento adulterado.

#### Acceptance Criteria

1. WHEN qualquer pessoa envia um arquivo PDF para `POST /public/certificates/:code/file-check`, THE System SHALL calcular o SHA-256 dos bytes recebidos e responder se é igual ao File_Hash do certificado.
2. THE System SHALL aceitar somente arquivos com `Content-Type: application/pdf` e até 5 MB, rejeitando com HTTP 400 ou 413 caso contrário.
3. THE System SHALL descartar o arquivo recebido após o cálculo, sem gravá-lo.
4. WHEN o arquivo não confere, THE Frontend SHALL explicar que o arquivo foi alterado ou não é o original emitido, orientando a confiar apenas nos dados exibidos pela Verification_Page.

---

### Requirement 11: Frontend — Telas

**User Story:** Como usuário do sistema, quero telas simples para cada etapa do fluxo de certificados.

#### Acceptance Criteria

1. THE Frontend SHALL oferecer ao USER a tela "Cursos", com os cursos ativos, conteúdo programático e botão "Solicitar certificado" (desabilitado quando já existe pedido pendente ou certificado válido).
2. THE Frontend SHALL oferecer ao USER a tela "Meus certificados", com pedidos (status e motivo de recusa) e certificados emitidos (baixar PDF, copiar link de verificação).
3. THE Frontend SHALL oferecer ao ADMIN a tela "Cursos" com criação, edição e desativação, incluindo edição dos módulos em lista ordenável e total de horas calculado em tempo real.
4. THE Frontend SHALL oferecer ao ADMIN a tela "Pedidos" com filtro por status e ações "Aprovar" (com datas do curso) e "Recusar" (com motivo), ambas com confirmação.
5. THE Frontend SHALL oferecer ao ADMIN a tela "Certificados emitidos" com os filtros do Requirement 7, detalhe do certificado, download do PDF e ação "Revogar" com motivo e confirmação.
6. THE Frontend SHALL seguir o layout responsivo e os componentes Angular Material definidos na v1.

---

### Requirement 12: Infraestrutura de Renderização

**User Story:** Como desenvolvedor, quero que a geração de PDF com Chromium seja estável e rode no Docker, para que a emissão funcione igual em desenvolvimento e produção.

#### Acceptance Criteria

1. THE Backend SHALL reutilizar uma única instância do navegador headless entre renderizações, abrindo uma página nova por certificado e fechando-a ao final, com sucesso ou erro.
2. THE Certificate_Renderer SHALL abortar a renderização que ultrapassar 20 segundos, retornando erro de geração.
3. THE Certificate_Renderer SHALL bloquear qualquer requisição de rede disparada pelo template, carregando apenas conteúdo embutido.
4. THE `api` container SHALL incluir o Chromium e as dependências de sistema necessárias, usando imagem base compatível (Debian slim), já que o Chromium do Playwright não suporta Alpine.
5. WHEN o Backend encerra, THE System SHALL fechar a instância do navegador.
6. THE System SHALL guardar os PDFs emitidos em volume persistente do Docker, fora da imagem.

---

## Fora de Escopo

- Escolha de modelos visuais, cores ou logos por tipo de certificado (modelo único).
- Upload de imagem de assinatura (assinaturas em fonte caligráfica a partir do nome).
- Assinatura digital ICP-Brasil e Diploma Digital do MEC.
- Emissão automática por regra de conclusão e emissão em lote.
- Envio do certificado por email.
