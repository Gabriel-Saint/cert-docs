# Design: Web UI Refinements

## Overview

Decisões técnicas dos ajustes de interface descritos em `requirements.md`. Todos ficam em `apps/web`; a API não muda.

> **Design retroativo.** Registrado depois da implementação de 2026-09-11. As decisões abaixo descrevem o código atual e o motivo de cada escolha, incluindo o problema encontrado ao importar as fontes pelo `project.json`.

---

## Tema (Requirement 1)

### Como o modo é decidido

O `mat.theme` do Angular Material 22 emite os tokens de cor com `light-dark()`. Quem escolhe o lado é a propriedade `color-scheme` do `<html>`:

| Classe no `<html>` | `color-scheme` | Resultado |
|---|---|---|
| nenhuma | `light dark` | segue o sistema operacional |
| `theme-light` | `light` | sempre claro |
| `theme-dark` | `dark` | sempre escuro |

Assim os dois modos saem do mesmo tema M3, sem duplicar paleta nem componentes.

### Peças

- **`core/theme/theme-service.ts`** — `ThemeService` (`providedIn: 'root'`) com o signal somente leitura `preference` e o método `set(preference)`. Aplica as classes no `<html>` e persiste em `localStorage` (`cert-docs.theme`), com `try/catch` para navegadores sem storage. Instanciado no `provideAppInitializer` do `app.config.ts`.
- **Script inline no `index.html`** — lê a chave e adiciona a classe antes do bootstrap, evitando o flash do tema errado. Como o build copia o `index.html` sem remover comentários, a explicação desse script fica no `ThemeService`.
- **`shared/ui/theme-toggle.ts`** — `ThemeToggle`: botão com `mat-menu` e itens `role="menuitemradio"`. O check da opção ativa é um `span` com a classe `material-symbols-outlined`, e não um `mat-icon`, porque o `mat-menu-item` projeta todo `mat-icon` no início do item.

---

## Separação do layout (Requirement 2)

Overrides de tokens no `styles.scss`, válidos nos dois temas porque usam tokens de sistema:

| Área | Token |
|---|---|
| `mat-toolbar` | `surface-container` |
| `mat-sidenav` | `surface-container-low`, divisor `outline-variant`, `container-shape: 0` |
| Conteúdo (`mat-sidenav-content`) | `surface` |

A borda inferior da toolbar (`1px solid var(--mat-sys-outline-variant)`) fica no `Shell` e no `PublicHeader`.

---

## Tipografia e privacidade (Requirement 3)

### Fontes

| Uso | Pacote | Arquivos |
|---|---|---|
| Interface | `@fontsource/ibm-plex-sans` | `latin-400`, `latin-500`, `latin-600` |
| Código, hash, CPF | `@fontsource/ibm-plex-mono` | `latin-400`, `latin-500` |
| Ícones | `@fontsource/material-symbols-outlined` | `latin-400` (≈321 KB) |

Versões fixas no `package.json`. A IBM Plex Mono é a mesma fonte usada no código e no hash impressos no PDF do certificado.

### Onde os CSS são importados

No `styles.scss`, com namespace próprio para cada arquivo (o Sass rejeita dois módulos com o mesmo nome final):

```scss
@use '@fontsource/ibm-plex-sans/latin-400.css' as plex-sans-400;
@use '@fontsource/material-symbols-outlined/latin-400.css' as symbols-400;
```

**Por que não no `project.json`:** a primeira versão registrou os CSS no array `styles` do `project.json`. O servidor de desenvolvimento só relê esse arquivo ao reiniciar; como os links do Google já tinham saído do `index.html`, a sessão em andamento ficou sem a fonte dos ícones. Importar no `styles.scss` recarrega junto com os estilos (Requirement 3.5).

### Tokens

- `--app-font-sans` e `--app-font-mono` definidos no `<html>`; as telas usam `font-family: var(--app-font-mono)` para códigos, hashes e CPF.
- `mat.theme` com `typography: (plain-family, brand-family: IBM Plex Sans, regular 400, medium 500, bold 600)`.
- A classe `.material-symbols-outlined` (antes fornecida pelo CSS do Google) é declarada no `styles.scss`, com `font-feature-settings: 'liga'`.

### Build sem comentários

O esbuild do Angular remove comentários de TypeScript, templates e SCSS ao minificar. Avisos de licença das bibliotecas vão para `3rdpartylicenses.txt`, que não é baixado pelo navegador. O `index.html` é copiado como está; por isso ele não deve conter comentários.

---

## Busca em tempo real (Requirement 4)

Em `features/admin/certificates/admin-certificates-page.ts`:

```
q.valueChanges ── debounceTime(300) ─┐
status.valueChanges ─────────────────┤
from.valueChanges ───────────────────┼─ merge
to.valueChanges ─────────────────────┘
   → map(filtros normalizados: trim, '' → undefined)
   → startWith(filtros atuais) → distinctUntilChanged(sameFilters) → skip(1)
   → takeUntilDestroyed()
   → query.update({ page: 1, pageSize, ...filtros })
```

- **`rxResource({ params: query, stream })`** — quando `query` muda, a requisição anterior é cancelada (Requirement 4.6).
- **`linkedSignal` `page`** — guarda o último `Page<CertificateHistoryItem>` recebido; o template renderiza `page()` em vez de `history.value()`, então a tabela não some enquanto a próxima consulta carrega (Requirement 4.5).
- **`hasFilters`** — `computed` sobre `query` que controla a exibição de "Limpar filtros"; `clearFilters()` só faz `filters.reset()`, e o próprio pipeline dispara a consulta.
- **`SEARCH_DEBOUNCE_MS`** exportado para os testes usarem o mesmo valor.
- A API já aceita `q` sem tamanho mínimo e até 100 caracteres, buscando no nome do aluno (sem diferenciar maiúsculas) e no código.

---

## Verificação dentro do Shell (Requirement 5)

Em `app.routes.ts`:

| Rota | Condição | Layout |
|---|---|---|
| `verificar`, `verificar/:code` (nível raiz) | `canMatch: [visitorOnly]` e `data: { publicLayout: true }` | Public_Header |
| `verificar`, `verificar/:code` (filhas do Shell) | rota pai com `authGuard` | Shell |

- `visitorOnly = () => !inject(AuthService).isAuthenticated()`. Para usuários logados a rota pública não casa e o roteador segue para as filhas do Shell, na mesma URL.
- Com `withComponentInputBinding`, o `data.publicLayout` chega como `input(false)` em `VerifySearchPage` e `VerifyResultPage`, que só renderizam `<app-public-header>` quando ele é `true`.
- O item "Verificar certificado" do menu usa `routerLinkActive` como os demais itens.

---

## Menu da conta (Requirement 6)

O topo do `mat-menu` da conta é um bloco comum (não `mat-menu-item`, que força linha única e aparência desabilitada): email com `title-small`, perfil em etiqueta com `secondary-container`/`on-secondary-container` e `mat-divider` antes de "Sair".

## Ações alinhadas nos cards (Requirement 7)

O `mat-card` já é flex em coluna; `mat-card-content { flex: 1 }` nas páginas de documentos, cursos e meus certificados empurra `mat-card-actions` para o rodapé.

---

## Testing Strategy

| Alvo | Tipo | Ferramenta | O que cobre |
|---|---|---|---|
| `ThemeService` | Unit | Vitest | Padrão `system`, restauração da escolha, valor inválido, troca de classes e remoção da chave |
| Rotas de verificação | Unit | Vitest + `RouterTestingHarness` | Visitante sem Shell; logado dentro do Shell em `/verificar` e `/verificar/:code` |
| Busca em tempo real | Unit | Vitest + `HttpTestingController` | Uma requisição após a digitação, data sem espera, sem requisição repetida |
| Tema, fontes e ícones | Manual assistido | Playwright (script local) | Três modos de tema, zero Third_Party_Host, todos os ícones renderizados como glifo |
| Busca no navegador | Manual assistido | Playwright (script local) | Digitação letra a letra gera uma consulta; "Limpar filtros" restaura a lista |
