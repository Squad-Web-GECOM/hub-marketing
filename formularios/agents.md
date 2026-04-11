# agents.md — Página Formulários

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Exibir lista de formulários externos/internos e facilitar acesso rápido.

## 2) Dependências

- HTML: `formularios/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/formularios.js`
- CSS: `../assets/css/main.css`

## 3) Controle de acesso

- Requer autenticação (`hub.auth.requireAuth()`).
- Usuário externo autenticado pode acessar.

## 4) Estrutura da página

- Busca: `#filter-search`
- Grid principal: `#forms-grid`
- Estado vazio: `#empty-state`
- Modal detalhe:
  - `#detail-modal-overlay`
  - `#detail-modal-title`
  - `#detail-modal-body`
  - `#detail-modal-link`

## 5) Lógica (`assets/js/formularios.js`)

1. Em `hub:ready`, valida se está na página pelo ID `forms-grid`.
2. Carrega `forms` ativos via Supabase.
3. Se usuário externo, filtra client-side por `tipo === 'externo'`.
4. Renderiza cards com ícone, descrição e botão abrir.
5. Busca com debounce (`hub.utils.debounce`) em nome e descrição breve.
6. Modal de detalhe abre por botão `.js-form-detail` com `data-form-id`.
7. Mantém `window.showFormDetail` exposta apenas por compatibilidade com convenções antigas.

## 6) CSS-chave

- Layout e cards:
  - `.hub-card`
  - `.hub-card-body`
  - `.hub-empty-state`
- Transição dos cards:
  - `.animate-fadeIn`

## 7) Pontos de atenção

- O script segue padrão ES5 do projeto (`var`/`function`, sem `const`/`let`/arrow).
- IDs de formulário são tratados como string para evitar quebra em UUID.
- Sempre sanitizar campos renderizados com `hub.utils.escapeHtml`.
