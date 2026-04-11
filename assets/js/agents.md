# agents.md — Guia de Scripts (assets/js)

Este arquivo descreve toda a lógica JavaScript da aplicação para acelerar manutenção e evolução por IA.

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de script sem refletir documentação e versionamento.

## 1) Arquitetura geral

- Stack: JS em IIFE ES5 compatível, sem `import/export`, carregado via `<script>` por página.
- Ordem obrigatória por página:
  1. `assets/js/main.js`
  2. `assets/js/[pagina].js`
- Inicialização entre módulos via evento global `hub:ready`.
- Contexto Liferay: Bootstrap/jQuery/Sicoob Styles já podem existir no portal; os imports nos HTML do repositório servem para simulação e desenvolvimento local.

## 2) `main.js` (núcleo compartilhado)

`main.js` expõe `window.hub` com:

- `hub.sb`: cliente Supabase lazy.
- `hub.auth`: autenticação, sessão em `localStorage`, guards de acesso.
- `hub.nav`: sidebar e navegação.
- `hub.darkMode`: toggle e persistência de tema.
- `hub.utils`: utilitários globais (toast, escapeHtml, datas, debounce, ícones).

### 2.1 Fluxo de bootstrap

1. Garante Supabase CDN e FontAwesome.
2. Inicializa Supabase.
3. Executa `auth.check()`.
4. Renderiza modal de login e sidebar.
5. Inicializa dark mode.
6. Dispara `document.dispatchEvent(new CustomEvent('hub:ready', ...))`.

### 2.2 Auth atual

- Fontes de login:
  - Liferay (`window.localPart` / `Liferay.ThemeDisplay`),
  - fluxo de código secreto no modal,
  - fallback view mode (`_source = 'view'`).
- Sessão em cache local:
  - `hub_cached_user`,
  - `hub_cached_role`,
  - `hub_cached_source`.
- Guardas:
  - `requireAuth()`,
  - `requireMarketingUser()`.

### 2.3 Pontos de atenção

- `ACCESS_CODES` estão hardcoded (`MKTadmin`, `MKTexterno`) e visíveis client-side.
- Chave Supabase anon está ofuscada, mas ainda pública (normal para anon key).

## 3) Módulos por página

## `home.js`

- Renderiza saudação por horário + data.
- Carrega em paralelo:
  - estatísticas (`desks`, `reservations`, `squad_members`, `forms`),
  - links rápidos (`quick_links`),
  - aniversariantes (`users`).
- Navegação de meses em aniversariantes.

## `usuarios.js`

- Lista diretório com filtros e ordenação.
- Carrega `users` + `org_structure`.
- Mantém estado local de filtros e ordenação.
- Possui modal de completar/editar perfil (usuário logado), inclusive cálculo de `profile_complete`.

## `perfil.js`

- Resolve perfil alvo por query string (`?u=`) ou próprio usuário.
- Renderiza bento grid de perfil completo.
- Carrega squads do usuário (`squad_members` com join).
- Modal de edição:
  - upload avatar no bucket `Avatars`,
  - edição de dados pessoais, estrutura, gostos,
  - regras de obrigatoriedade por senioridade/gestão.

## `squads.js`

- Carrega categorias, squads, membros, usuários e estrutura organizacional.
- Constrói lookups locais (`orgMap`, `membersBySquad`, `categoryMap`).
- Agrupa membros por coordenação e núcleo.
- Aplica busca textual + filtro por categoria.
- Bloqueia visualização para `profileComplete = false`.

## `mesas.js`

- Única página com modo visualização sem login.
- Carrega mesas e reservas por data.
- Monta calendário dos próximos dias úteis.
- Gerencia reserva/cancelamento.
- Implementa sugestão inteligente de mesa:
  - histórico pessoal,
  - proximidade de núcleo/coordenacao,
  - desempate por número da mesa.
- Suporta check-in por query param (`?checkin=`).

## `formularios.js`

- Carrega formulários ativos.
- Se usuário externo, filtra por `tipo === 'externo'`.
- Busca client-side com debounce.
- Abre modal de detalhe.

## `admin.js`

- SPA com tabs roteadas por hash:
  - `usuarios`, `estrutura`, `squads`, `categorias`, `formularios`, `mesas`, `registros`, `links`.
- CRUD completo por tab, com handlers globais `window._admin*`.
- Modal genérico de edição e confirmação.
- Modal flutuante de catálogo de ícones + autocomplete com dicionário PT-BR.

## 4) Convenções de implementação

- Escape XSS obrigatório em HTML dinâmico: `hub.utils.escapeHtml`.
- Toda query deve tratar `resp.error`.
- Preferir carregamento paralelo com `Promise.all` quando possível.
- Expor funções globais apenas quando necessário para `onclick` em HTML dinâmico.

## 5) Mapeamento rápido de tabelas por script

- `main.js`: `users`, `org_structure`.
- `home.js`: `desks`, `reservations`, `squad_members`, `forms`, `quick_links`, `users`.
- `usuarios.js`: `users`, `org_structure`.
- `perfil.js`: `users`, `org_structure`, `squad_members`, storage `Avatars`.
- `squads.js`: `squad_categories`, `squads`, `squad_members`, `users`, `org_structure`.
- `mesas.js`: `desks`, `reservations`, `users`.
- `formularios.js`: `forms`.
- `admin.js`: `users`, `org_structure`, `squads`, `squad_members`, `squad_categories`, `forms`, `desks`, `reservations`, `quick_links`.

## 6) Dívidas técnicas já identificadas

- Fluxo de login com códigos fixos client-side.
- Divergência entre regras documentadas e implementadas em alguns pontos:
  - `avatar` (150 KB em docs vs 300 KB em `perfil.js`),
  - hardcodes de rota `/web/mkt/...` em alguns módulos.
- Forte acoplamento entre HTML IDs e JS (qualquer rename quebra fluxo).

## 7) Checklist para alterações em scripts

- Guard da página presente (`if (!document.getElementById(...)) return`)?
- Auth gate correto para o caso de uso?
- Query Supabase com tratamento de erro?
- XSS protegido com `escapeHtml`?
- Toast com tipo válido (`success|error|warning|info`)?
- Fluxo funcionando em light e dark mode (impacto visual)?
