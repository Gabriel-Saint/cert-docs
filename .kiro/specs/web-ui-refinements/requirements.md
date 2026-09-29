# Requirements Document

## Introduction

Ajustes de interface levantados durante a validação das telas do CertDocs: tema claro e escuro, separação visual do layout, tipografia servida pelo próprio app, busca em tempo real no histórico de certificados, verificação dentro do menu para usuários logados, menu da conta e alinhamento dos cards.

> **Especificação retroativa.** Estes requisitos foram implementados em 2026-09-11 antes de serem especificados, o que quebrou o processo spec-driven do projeto. Este documento registra o que foi entregue, com critérios verificáveis, para que spec e código voltem a coincidir. A partir daqui, qualquer ajuste começa por este documento (requisito → design → tarefa → código).

Depende de:

- `cpf-pdf-watermark-generator` — Requirements 10 (autenticação e navegação) e 11 (layout responsivo)
- `certificate-issuance` — Requirements 9 (verificação pública) e 11 (telas); este documento revisa o critério 9.7

## Glossary

- **Frontend**: A aplicação Angular em `apps/web`.
- **Shell**: O layout da área logada: `mat-toolbar` no topo, `mat-sidenav` com a navegação e a área de conteúdo.
- **Public_Header**: O cabeçalho das páginas abertas a visitantes (verificação pública).
- **Theme_Preference**: A escolha de tema do usuário: `light` (Claro), `dark` (Escuro) ou `system` (Automático).
- **History_Page**: A tela `/admin/certificados` com o histórico de certificados emitidos.
- **Third_Party_Host**: Qualquer domínio diferente da origem do próprio app.

## Requirements

### Requirement 1: Tema claro, escuro e automático

**User Story:** Como usuário, quero escolher entre tema claro, escuro ou seguir o sistema, para usar o CertDocs com conforto em qualquer ambiente.

#### Acceptance Criteria

1. THE Frontend SHALL oferecer as opções Claro, Escuro e Automático em um botão com menu no Shell, no Public_Header e nas telas `/entrar` e `/cadastro`, indicando a opção ativa.
2. WHILE a Theme_Preference for `system`, THE Frontend SHALL seguir a preferência de cor do sistema operacional (`prefers-color-scheme`).
3. WHEN o usuário escolhe uma opção, THE Frontend SHALL aplicar o tema imediatamente e guardar a escolha no `localStorage` na chave `cert-docs.theme`; a opção Automático SHALL remover a chave.
4. WHEN a página é carregada com uma Theme_Preference salva, THE Frontend SHALL aplicar o tema antes do bootstrap do Angular, sem exibir o tema oposto durante o carregamento.
5. IF o `localStorage` estiver indisponível ou contiver um valor desconhecido, THEN THE Frontend SHALL usar `system` sem lançar erro.
6. THE Frontend SHALL derivar as cores dos dois modos do mesmo tema Angular Material (M3), mantendo texto e componentes legíveis em ambos.

---

### Requirement 2: Separação visual do layout

**User Story:** Como usuário, quero distinguir claramente o cabeçalho, o menu e o conteúdo, para que a tela não pareça um bloco único.

#### Acceptance Criteria

1. THE Shell SHALL exibir a `mat-toolbar`, o `mat-sidenav` e a área de conteúdo com superfícies de cor distintas, nos temas claro e escuro.
2. THE Shell SHALL exibir uma borda na cor `outline-variant` abaixo da `mat-toolbar` e à direita do `mat-sidenav` fixo.
3. WHILE o `mat-sidenav` estiver fixo ao lado do conteúdo, THE Shell SHALL exibi-lo sem cantos arredondados.
4. THE Public_Header SHALL usar a mesma superfície e a mesma borda inferior da `mat-toolbar` do Shell.

---

### Requirement 3: Tipografia e privacidade

**User Story:** Como usuário, quero uma tipografia legível e coerente com o certificado impresso, sem que meu acesso seja informado a terceiros.

#### Acceptance Criteria

1. THE Frontend SHALL usar IBM Plex Sans como fonte da interface e IBM Plex Mono para códigos de verificação, hashes e CPF.
2. THE Frontend SHALL servir as fontes e os ícones Material Symbols a partir da própria origem, sem requisições a Third_Party_Host.
3. THE Frontend SHALL carregar somente o subconjunto latino e os pesos utilizados: IBM Plex Sans 400, 500 e 600; IBM Plex Mono 400 e 500; Material Symbols Outlined 400.
4. THE build de produção SHALL não conter comentários do código-fonte nos arquivos JavaScript, CSS e `index.html` entregues ao navegador.
5. WHEN o servidor de desenvolvimento já está em execução e as fontes são adicionadas ou alteradas, THE Frontend SHALL aplicá-las por recarregamento dos estilos, sem exigir reinício do servidor.

---

### Requirement 4: Busca em tempo real no histórico de certificados

**User Story:** Como ADMIN, quero que o histórico filtre enquanto digito, para encontrar um certificado sem clicar em "Filtrar".

#### Acceptance Criteria

1. WHEN o ADMIN digita no campo "Aluno ou código" da History_Page, THE Frontend SHALL consultar o histórico 300 ms após a última tecla, com uma única requisição para a sequência digitada.
2. WHEN o status ou as datas de emissão mudam, THE Frontend SHALL consultar o histórico imediatamente.
3. WHEN qualquer filtro muda, THE Frontend SHALL consultar a página 1, mantendo o tamanho de página escolhido.
4. IF os filtros resultantes forem iguais aos da consulta atual (espaços nas pontas do texto são ignorados), THEN THE Frontend SHALL NOT fazer uma nova requisição.
5. WHILE uma nova consulta está em andamento, THE Frontend SHALL manter visível o último resultado recebido e exibir um indicador de progresso.
6. WHEN uma nova consulta começa antes de a anterior terminar, THE Frontend SHALL cancelar a anterior, de modo que uma resposta antiga nunca substitua a mais recente.
7. WHERE existe algum filtro aplicado, THE Frontend SHALL exibir a ação "Limpar filtros", que restaura todos os filtros e recarrega o histórico sem filtros.
8. THE campo "Aluno ou código" SHALL aceitar no máximo 100 caracteres, o limite do parâmetro `q` da API.

---

### Requirement 5: Verificação dentro do Shell para usuários logados

**User Story:** Como usuário logado, quero abrir "Verificar certificado" pelo menu sem perder a navegação, como nas outras telas.

#### Acceptance Criteria

1. WHILE o usuário não está autenticado, THE Frontend SHALL exibir `/verificar` e `/verificar/:code` com o Public_Header, sem o Shell.
2. WHILE o usuário está autenticado, THE Frontend SHALL exibir `/verificar` e `/verificar/:code` dentro do Shell, com o `mat-sidenav` visível, o item "Verificar certificado" destacado e sem o Public_Header.
3. THE Frontend SHALL usar as mesmas URLs nos dois casos, para que o link do QR Code funcione para visitantes e usuários logados.

---

### Requirement 6: Menu da conta

**User Story:** Como usuário logado, quero ver claramente com qual conta e perfil estou conectado.

#### Acceptance Criteria

1. WHEN o usuário abre o menu da conta no Shell, THE Frontend SHALL exibir o email em destaque e, em linha separada, o perfil ("Aluno" ou "Administrador") como etiqueta.
2. THE Frontend SHALL separar o bloco de identificação da ação "Sair" com um divisor.
3. THE bloco de identificação SHALL usar as cores normais de texto, sem aparência de item desabilitado.

---

### Requirement 7: Ações alinhadas nos cards

**User Story:** Como usuário, quero que os botões dos cards fiquem alinhados, para a grade parecer organizada.

#### Acceptance Criteria

1. WHEN cards são exibidos na mesma linha da grade em `/documentos`, `/cursos` ou `/meus-certificados`, THE Frontend SHALL posicionar as ações no rodapé de todos os cards da linha, independentemente do tamanho do título e da descrição.

### Requirement 8: Visibilidade da senha e sessão lembrada

**User Story:** Como usuário, quero conferir a senha digitada e escolher se a sessão continua depois que eu fechar a aba, para evitar erros de digitação e controlar a duração do meu acesso.

#### Acceptance Criteria

1. THE Login_Page SHALL exibir um botão no campo de senha que alterna entre texto oculto e visível sem alterar o valor digitado.
2. THE botão de visibilidade SHALL informar sua ação por nome acessível atualizado ("Mostrar senha" ou "Ocultar senha") e não SHALL enviar o formulário.
3. THE Login_Page SHALL oferecer a opção "Manter conectado", desmarcada por padrão.
4. WHEN o login web tem sucesso, THE API SHALL enviar o JWT em cookie `HttpOnly`, `SameSite=Lax`, `Path=/api` e `Secure` em produção; THE Frontend SHALL NOT receber nem persistir o JWT em JavaScript-accessible storage.
5. WHEN "Manter conectado" está desmarcada, THE API SHALL emitir cookie sem `Max-Age` ou `Expires`, limitado ainda pela expiração de 24 horas do JWT.
6. WHEN "Manter conectado" está marcada, THE API SHALL emitir cookie persistente por no máximo 24 horas, igual à validade atual do JWT.
7. WHEN a sessão web é restaurada, THE Frontend SHALL consultar a API; ao sair, SHALL solicitar a remoção do cookie. A rota de restauração SHALL validar o JWT no servidor.
8. THE API SHALL continuar aceitando Bearer JWT em rotas protegidas para compatibilidade com integrações externas.
9. THE API SHALL restringir CORS à origem configurada do frontend e permitir credenciais; SHALL NOT permitir origem curinga junto com credenciais. WHEN uma requisição que altera estado usa o cookie de sessão, THE API SHALL rejeitar origens diferentes da origem configurada.
