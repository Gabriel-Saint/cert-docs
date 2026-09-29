# Implementation Plan: Web UI Refinements

## Overview

Ajustes de interface do CertDocs descritos em `requirements.md` e `design.md`.

> **Plano retroativo.** As tarefas 1 a 7 foram implementadas em 2026-09-11 antes da especificação e estão marcadas como concluídas para refletir o código. Os checkpoints continuam abertos até a validação do usuário. Novos ajustes entram como novas tarefas neste arquivo **antes** de qualquer código.

## Convenções de Commit

- Conventional Commits com descrição em português: `tipo(escopo): descrição no imperativo`
- Escopo `web`; um commit por tarefa

## Tasks

- [x] 1. Tema claro, escuro e automático
  - `ThemeService` com persistência em `localStorage` e aplicação de classe no `<html>`
  - Script inline no `index.html` para aplicar o tema antes do bootstrap
  - `ThemeToggle` no Shell, no Public_Header e nas telas de entrar e cadastro
  - `color-scheme` com `light-dark()` no `styles.scss`
  - Testes do `ThemeService`
  - _Commit: `feat(web): adiciona tema claro, escuro e automático e separa header, menu e conteúdo`_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Separação visual do layout
  - Overrides de `mat-toolbar` e `mat-sidenav` com tokens de superfície e divisor
  - Borda inferior no Shell e no Public_Header
  - _Commit: junto com a tarefa 1_
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Verificação dentro do Shell para usuários logados
  - Rotas públicas com `canMatch` de visitante e `data.publicLayout`
  - Rotas filhas do Shell e input `publicLayout` nas páginas de verificação
  - Item do menu destacado com `routerLinkActive`
  - Testes com `RouterTestingHarness`
  - _Commit: `feat(web): abre a verificação de certificado dentro do menu para usuários logados`_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Menu da conta
  - Bloco de identificação com email, etiqueta de perfil e divisor
  - _Commit: `fix(web): separa email e perfil no menu da conta`_
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Tipografia e privacidade
  - Instalar `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` e `@fontsource/material-symbols-outlined` com versão fixa
  - Importar os CSS no `styles.scss` e remover os links do Google do `index.html`
  - Tokens `--app-font-sans` e `--app-font-mono`, tipografia do `mat.theme` e classe dos ícones
  - Remover o comentário do script de tema do `index.html`
  - Conferir no build: zero referências a Third_Party_Host e nenhum comentário do código-fonte
  - _Commit: `feat(web): usa IBM Plex Sans e Plex Mono servidas pelo próprio app`_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Busca em tempo real no histórico de certificados
  - Pipeline de filtros com `debounceTime`, `distinctUntilChanged` e página 1
  - `linkedSignal` para manter o último resultado; "Limpar filtros" condicional
  - Testes com `HttpTestingController`
  - _Commit: `feat(web): filtra o histórico de certificados enquanto digita`_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 7. Ações alinhadas nos cards
  - `mat-card-content { flex: 1 }` em documentos, cursos e meus certificados
  - _Commit: já incluído em `feat(web): cria as telas de documentos, cursos e certificados do aluno`_
  - _Requirements: 7.1_

- [x] 8. Visibilidade da senha e sessão lembrada
  - Botão acessível para mostrar/ocultar senha no formulário de login
  - Login de sessão web com cookie HttpOnly e atributos Secure/SameSite/Path
  - Restaurar e encerrar sessão web por endpoints próprios; preservar login Bearer existente
  - Restringir CORS à origem configurada com credenciais
  - Bootstrap e interceptor Angular com cookie, sem persistir token em storage
  - Testes unitários do formulário e e2e de cookie, restauração, logout e Bearer
  - _Requirements: 8.1–8.9_

- [ ] 9. Checkpoint — Validação com o usuário
  - Alternar Claro, Escuro e Automático no desktop e no celular; recarregar e conferir que o tema salvo não pisca
  - Conferir no DevTools (aba Network) que nenhuma requisição sai para outro domínio
  - Digitar no histórico e ver uma consulta só; limpar filtros
  - Logado, abrir "Verificar certificado" pelo menu e pelo link de um certificado
  - `npm run ci` passando
  - Perguntar ao usuário se o resultado está aprovado

## Notes

- Instalar ou atualizar pacotes com o `nx serve web` rodando pode deixar o cache do Vite inconsistente (duas cópias de módulos do Material). Parar o servidor, apagar `.angular/cache` e subir de novo.
- A tarefa 8 altera a API para oferecer sessão web por cookie HttpOnly, preservando o login Bearer para integrações.
