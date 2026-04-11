# agents.md — Página Squads

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Exibir squads ativos, com filtro por categoria e busca por texto/membros.

## 2) Dependências

- HTML: `squads/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/squads.js`
- CSS: `../assets/css/main.css`

## 3) Acesso e gates

- Requer autenticação e usuário de marketing.
- Se `profileComplete = false`, renderiza bloqueio de cadastro incompleto.

## 4) Estrutura da página

- Busca: `#filter-search`
- Filtros por categoria: `#category-buttons`
- Resultado: `#results-count`
- Grid: `#squads-grid`
- Empty state: `#empty-state`

## 5) Fluxo do script (`assets/js/squads.js`)

1. Carrega em paralelo:
  - `squad_categories`
  - `squads`
  - `squad_members`
  - `users`
  - `org_structure`
2. Monta lookups:
  - `orgMap`
  - `categoryMap`
  - `membersBySquad`.
3. Renderiza botões de categoria.
4. Aplica filtros (categoria + busca textual).
5. Renderiza cards por squad com agrupamento de membros por coordenação e núcleo.

## 6) Organização de membros

- `groupMembersByOrg` agrupa por:
  1. `coordenacao_id`
  2. `nucleo_id`
- Render usa classes:
  - `.squad-coord-group`
  - `.squad-member-row`
  - `.squad-nucleo-label`

## 7) CSS-chave

- Card e tipografia:
  - `.squad-card-title`
  - `.squad-desc`
- Membros:
  - `.squad-members-empty`
  - `.squad-member-link`
- Dark mode dedicado para blocos de squad.

## 8) Pontos de atenção

- Links de perfil em membros usam montagem de URL com trecho `/web/mkt/perfil/?u=...`.
- Se mudar estratégia de rotas/base path, revisar este link.
- Manter fallback de ícone com `hub.utils.normalizeIcon`.
