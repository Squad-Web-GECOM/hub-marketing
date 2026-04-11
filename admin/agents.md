# agents.md — Página Admin

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Painel administrativo SPA para CRUD das entidades centrais do hub.
- Roteamento por hash (`#usuarios`, `#estrutura`, etc.).

## 2) Dependências

- HTML: `admin/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/admin.js`
- CSS: `../assets/css/main.css`

## 3) Controle de acesso

- Inicializa em `hub:ready`.
- Bloqueio se não for `hub.auth.isAdminOrCoord()`.
- Em bloqueio, exibe toast de acesso restrito e redireciona para home.

## 4) Estrutura de UI

- Header da página + botão de consulta de ícones (`#btn-open-icones`).
- Tabs horizontais com setas de scroll:
  - `#admin-tabs-wrapper`, `#tabs-scroll-left`, `#tabs-scroll-right`.
- Painéis:
  - `#panel-usuarios`
  - `#panel-estrutura`
  - `#panel-squads`
  - `#panel-categorias`
  - `#panel-formularios`
  - `#panel-mesas`
  - `#panel-registros`
  - `#panel-links`
- Modais:
  - `#edit-modal-overlay`
  - `#confirm-modal-overlay`
  - `#icones-modal-overlay`

## 5) Lógica principal (`assets/js/admin.js`)

### 5.1 Router interno

- `initRouter()` escuta `hashchange`.
- `switchTab(tab)` ativa link/tab e chama `loadTabData(tab)`.

### 5.2 Estado em memória

- Cache local das entidades:
  - `orgStructure`, `allUsers`, `allSquads`, `allCategories`, `allForms`, `allDesks`, `allQuickLinks`.

### 5.3 Fluxo CRUD padrão

1. Carrega dados da tab via Supabase.
2. Renderiza tabela/árvore no painel.
3. Abre modal de edição com `showEditModal`.
4. Salva via `hub.sb.from(...).insert/update/delete`.
5. Toast de feedback e recarrega a tab.

### 5.4 Handlers globais

- Expostos em `window._admin*` para uso em `onclick` de HTML dinâmico.
- Exemplos:
  - `window._adminEditUser`
  - `window._adminAddSquad`
  - `window._adminDeactivateForm`
  - `window._adminAddLink`

## 6) Features relevantes

- Modal flutuante de referência de ícones:
  - busca em `fa-solid` e `fa-brands`,
  - cópia da classe completa.
- Autocomplete de ícones nos inputs:
  - `sq-icone`, `cat-icone`, `fm-icone`, `lk-icone`,
  - dicionário PT-BR para ampliar busca semântica.

## 7) CSS-chave da página

- Tabs e setas:
  - `.admin-tabs-container`
  - `.admin-tabs-wrapper`
  - `.tabs-scroll-btn`
- Modal de ícones:
  - `.icones-modal-*`
  - `.icon-ac-*` (autocomplete)
- Tabela e ações:
  - `.hub-table-wrapper`
  - `.td-acoes`
  - `.btn-icon-sm`

## 8) Cuidados ao alterar

- Não remover IDs usados pelo JS sem refatorar handlers.
- Manter coluna `Ações` como primeira coluna nas tabelas admin.
- Garantir `escapeHtml` em qualquer HTML dinâmico novo.
- Validar dark mode para componentes novos do admin.
