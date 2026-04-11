# Changelog — Hub Marketing

Todas as mudanças relevantes deste projeto estão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [1.1.1] — 02/04/2026

Ajustes estruturais de baixo risco para consistência de código, documentação e publicação no Liferay sem alterar regras de negócio.

### Alterado — JavaScript

- Removidos logs de debug residuais de `assets/js/admin.js`.
- Padronização de sintaxe para ES5 em scripts ativos (`var`/`function`, sem `const`/`let`/arrow) com ajuste de compatibilidade em:
  - `assets/js/main.js`
  - `assets/js/formularios.js`
- `assets/js/formularios.js` refatorado para:
  - render sem `onclick` inline para detalhe;
  - uso de `.js-form-detail` + `data-form-id`;
  - manutenção de `window.showFormDetail` por compatibilidade.
- Tipos de toast normalizados de `'danger'` para `'error'` em:
  - `assets/js/home.js`
  - `assets/js/mesas.js`

### Alterado — HTML/SCSS

- Removidos `style=""` estáticos dos HTML das páginas V1 e substituídos por classes utilitárias/semânticas.
- Novas classes adicionadas na camada SCSS V1 para suportar extração de inline styles:
  - `hub-app-view`, `hub-birthday-month-label`, `hub-filter-group--*`,
  - `hub-scroll-touch-x`, `hub-category-buttons-row`, `hub-hidden-initial`,
  - `hub-modal--sm|md|lg|xl`, `hub-text-note-*`, `hub-section-caption`, `hub-optional-label`,
  - `hub-form-card-*`, `squads-empty-state`, `perfil-placeholder-text`, `perfil-loading-text`.
- Migração de Sass de `@import` para `@use` em:
  - `src/scss/main.scss`
  - `src/scss/v1/_global.scss`
- `assets/css/main.css` e `assets/css/main.css.map` recompilados a partir da fonte SCSS.

### Alterado — Governança e documentação

- Governança obrigatória adicionada e unificada nos `agents.md` de áreas:
  - `admin/`, `formularios/`, `mesas/`, `perfil/`, `squads/`, `usuarios/`, `src/`, `assets/css/`, `assets/js/`.
- `Agents.md` (raiz) reforçado com:
  - regra de coerência entre múltiplos `agents.md`;
  - diretriz de publicação Liferay via Documentos e Mídias com fallback inline.
- `README.md` atualizado para refletir:
  - arquitetura SCSS V1 atual;
  - arquivo `claude.md` (nomenclatura correta);
  - estratégia recomendada de publicação no Liferay.

### Limpeza estrutural

- Removidos da base ativa:
  - partials SCSS legados em `src/scss/_*.scss`;
  - pasta `dashboards/` vazia;
  - CSVs auxiliares de reservas usados apenas em análise.
- Pasta `old/` mantida como release histórica v4.2 (somente referência).

---

## [1.1.0] — 01/04/2026

Evolução de governança da estilização, mantendo o visual da V1 sem alteração funcional de UI.

### Alterado — Pipeline de estilos

- `src/scss` definido como fonte única de verdade para estilos.
- `src/scss/main.scss` atualizado para usar a estrutura V1 modular:
  - `v1/_global.scss`
  - `v1/_profile-gate.scss`
  - `v1/_squads.scss`
  - `v1/_birthdays.scss`
  - `v1/_perfil.scss`
  - `v1/_admin-icons.scss`
- Fase B concluída: `v1/_global.scss` virou agregador da camada global semântica:
  - `v1/global/_foundation-effects.scss`
  - `v1/global/_navigation.scss`
  - `v1/global/_components.scss`
  - `v1/global/_mesas-scrollbar.scss`
  - `v1/global/_dark-mode.scss`
- Fase C concluída: padrão de expansão para novas páginas em:
  - `v1/global/_expansion-standards.scss` (classes `hub-std-*`, com dark mode)
- Refactor SCSS com nesting aplicado em:
  - `v1/global/_expansion-standards.scss`
  - `v1/_profile-gate.scss`
  - `v1/_squads.scss`
  - `v1/_birthdays.scss`
  - `v1/_admin-icons.scss`
  - `v1/_perfil.scss`
  - `v1/global/_dark-mode.scss`
- Diretriz reforçada para priorizar tokens/classes do `sicoob-styles` em novas estilizações.
- `assets/css/main.css` recompilado exclusivamente a partir de `main.scss`.

### Adicionado — Governança para IA

- Regras no `Agents.md` da raiz exigindo:
  - atualização do `agents.md` das áreas alteradas;
  - registro obrigatório em versionamento.
- Novo `assets/css/agents.md` com regra de arquivo compilado (sem edição manual).
- `src/agents.md` atualizado com fluxo oficial SCSS -> CSS.
- Novo `checklist-qa-visual.md` como checklist obrigatório de QA visual por página.

### Observação de versão

- O Hub permanece tratado como base **V1**; esta entrega formaliza o processo de evolução incremental da V1.

---

## [1.0.0] — 06/03/2026

Versão inicial de produção. Projeto desenvolvido inteiramente com Claude (Anthropic) ao longo de 3 semanas.

### Adicionado — Estrutura base

- Projeto do zero: 7 páginas HTML + `main.js` modular (IIFE/ES5, sem build system)
- Supabase como backend (PostgreSQL + Storage), acesso via `anon key`
- 9 tabelas: `users`, `org_structure`, `squads`, `squad_members`, `squad_categories`, `quick_links`, `forms`, `desks`, `reservations`
- Bucket de storage `Avatars` (público) para avatares de usuários
- Autenticação SSO Liferay + fallback de código de acesso
- Sidebar de navegação com colapso, dark mode e controle de acesso por papel
- Sistema de toasts, loader global e utilitários compartilhados em `hub.utils`
- SCSS em 14 partials compilados para `assets/css/main.css`
- Dark mode completo com variáveis CSS e overrides em `[data-theme="dark"]`
- SQL completo com seed inicial de 80+ usuários e 38 squads

### Adicionado — Páginas

#### Home
- Cards de estatísticas (usuários, squads, mesas disponíveis, reservas do dia)
- Grid de links rápidos organizados por seção
- Painel de aniversariantes do mês com destaque para o dia atual

#### Mesas
- Grade visual de mesas com zonas de trabalho
- Sistema de reserva por clique com date picker
- Sugestão inteligente de mesa por coordenação/núcleo do usuário
- Suporte a reservas fixas (bloqueadas para novos agendamentos)
- Cancelamento de reserva própria
- Alerta de cadastro incompleto com redirecionamento para perfil

#### Squads
- Cards com ícone, nome, descrição, membros e link externo
- Membros exibidos com avatar e apelido
- Filtros por categoria e busca por nome
- Coluna `link_wrike` renomeada para `link` + campo `link_label` adicionado

#### Formulários
- Grid de atalhos para formulários externos
- Gerenciável via Admin
- Acessível para usuários externos (sem exigir Marketing)

#### Usuários
- Tabela com todos os usuários ativos
- Filtros hierárquicos: gerência → coordenação → núcleo + bairro + terceirizado + busca
- Ordenação por coluna
- Clique no nome abre perfil completo
- Coluna "Endereço" removida; exibe apenas "Bairro"
- Modal de conclusão de cadastro para usuário próprio com perfil incompleto

#### Perfil
- Layout bento grid com múltiplos cards responsivos
- Upload de avatar (JPG/PNG, máx. 150 KB) com preview local e validação
- Exibição de: nome, apelido, usuário, e-mail (com botões de cópia), telefone, aniversário, signo, idade
- Estrutura organizacional (gerência, coordenação, núcleo)
- Senioridade e flag terceirizado (visível para próprio usuário e admin/gestor)
- Sobre mim (até 500 caracteres)
- Gostos pessoais: livros, filmes/séries, comidas, hobbies, time do coração
- Endereço (logradouro, bairro, CEP)
- Squads do usuário exibidos como chips
- Modal de edição completo com nova ordem de seções:
  1. Avatar
  2. Dados Pessoais (Apelido\*, Telefone\*, Aniversário\*)
  3. Estrutura Organizacional (Gerência\*, Coordenação\*, Núcleo\*, Senioridade\*)
  4. Endereço (opcional)
  5. Sobre mim (opcional)
  6. Gostos Pessoais (opcional)

#### Admin
- SPA com 8 abas de CRUD: Usuários, Squads, Categorias, Formulários, Links, Org Structure, Mesas, Reservas
- Tabs com scroll horizontal + setas de navegação + fade nas bordas
- Tabelas modernas com coluna de ações primeiro e botões compactos
- Modal genérico reutilizável `showEditModal()` + `showConfirm()`
- Botão "Novo Usuário" com formulário completo de criação
- Modal flutuante de referência de ícones FontAwesome (busca em português via `ICON_PT_DICT`)
- Autocomplete de ícones nos campos de formulário

### Adicionado — Sistema de controle de acesso

- **Profile gate:** usuário com `profile_complete = false` bloqueado em Mesas e Usuários
- Redirecionamento de usuários externos para `/formularios/`
- Papéis: Admin (`is_admin`), Gestor (`is_gestor`), Marketing, Externo

### Adicionado — `profile_complete` com regras por nível

Lógica de conclusão de cadastro adaptada ao papel hierárquico do usuário:

| Nível | Campos obrigatórios |
|---|---|
| Gerente | Nome + Apelido + Telefone + Aniversário + Senioridade |
| Coordenador | + Gerência + Coordenação |
| Demais | + Gerência + Coordenação + Núcleo |

### Adicionado — Integração Liferay

- Pasta `js-liferay/` com 7 arquivos pré-compilados (um por página)
- Cada arquivo contém: bloco de config (`window.HUB_PAGE`, `window.HUB_PAGES`) + `main.js` + `[page].js`
- Script `build-liferay.sh` para regenerar os arquivos após alterações

### Corrigido

- Dark mode: cards, modais, admin, squads, sidebar, formulários
- Ícones FontAwesome Pro → Free (mapeamento via `hub.utils.normalizeIcon()`)
- Funções `window._adminEdit*` não disparando nos botões de tabela
- Erro RLS no upload de avatar (policy precisa de `TO anon`)
- Erro "Bucket not found" — bucket `Avatars` com A maiúsculo obrigatório
- Salvar perfil deslogava o usuário (conflito com re-autenticação)
- Células de tabela admin com conteúdo excessivo (truncamento via `.td-truncate`)
- Dark mode no `.list-group` do modal de membros de squads
- `is_coordenador` renomeada para `is_gestor` em toda a base

---

## [0.1.0] — 13/02/2026

Versão de desenvolvimento inicial. Estrutura básica, todas as páginas funcionais no GitHub Pages.
Não publicada em produção.

---

## Legado

### v4.2 (`old/`)
Versão anterior do sistema. Single-page com agendamento de mesas e estilos Sicoob.
Arquivos preservados em `old/` somente para referência.
- `old/agendamento-complete-v4.js`
- `old/style-v4.css`
- `old/README-V4.md`
