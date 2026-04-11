# Planejamento de Evoluções — Hub Marketing

Data da análise: 01/04/2026  
Escopo analisado: estrutura de pastas, HTML, CSS/SCSS, JS por página, autenticação e documentação de IA.

## 1) Resumo executivo

O projeto está funcional e bem avançado para um portal estático com múltiplas páginas, mas apresenta pontos de fragilidade em quatro frentes:

1. Segurança de autenticação (códigos e fluxo client-side expostos).
2. Divergência entre documentação e implementação real.
3. Divergência entre `src/scss` e CSS efetivamente entregue em `assets/css/main.css`.
4. Acoplamento forte entre HTML IDs e scripts, elevando risco de regressão em refactors.

## 2) Estado atual do projeto

## 2.1 Arquitetura

- App estático multipágina com bootstrap via `main.js`.
- Backend em Supabase (tabelas + storage), sem uso de JWT nativo no fluxo principal atual.
- Padrão de módulos majoritário em IIFE e evento `hub:ready`.
- Páginas mapeadas:
  - Home (`/`)
  - Admin (`/admin/`)
  - Perfil (`/perfil/`)
  - Usuários (`/usuarios/`)
  - Squads (`/squads/`)
  - Formulários (`/formularios/`)
  - Mesas (`/mesas/`)

## 2.2 Pontos positivos

- Organização clara por página (`main.js` + módulo dedicado).
- Reuso consistente de utilitários (`hub.utils`, `hub.auth`, `hub.nav`).
- Dark mode já implementado e abrangente.
- Admin com CRUD amplo, autocomplete de ícones e fluxo operacional completo.
- Regras de negócio de perfil e mesas já codificadas.

## 2.3 Riscos técnicos relevantes

- **Autenticação vulnerável**: códigos de acesso hardcoded no client (`ACCESS_CODES`).
- **Tipos de toast inconsistentes**: uso de `'danger'` em alguns módulos sem variante correspondente em `hub.utils.showToast`.
- **Validação de avatar divergente**: documentação fala 150 KB, código aceita 300 KB.
- **URLs hardcoded em alguns links** (`/web/mkt/...`) reduzindo portabilidade.
- **Potencial bug de ID em formulários**: `onclick="showFormDetail(${form.id})"` pode quebrar se `id` for UUID string.
- **Schema drift documental**: documentação de tabelas em alguns arquivos não bate com campos usados no código atual.

## 3) Agents.md da raiz (auditoria e status)

Arquivo auditado: `Agents.md` (raiz)

### 3.1 Lacunas identificadas inicialmente

- Não cobre `js-liferay/` e seu processo de geração (`build-liferay.sh`).
- Não traz inventário de riscos técnicos conhecidos (autenticação, tipos de toast, inconsistências de schema).

### 3.2 Divergências entre regra e implementação

- Regra de ES5 estrita vs `formularios.js` com `let`, `const`, arrow function e template string.
- Regra de limite de avatar (150 KB) vs validação em `perfil.js` (300 KB).
- Convenção de caminhos via `hub.config.basePath` vs trechos com rota fixa `/web/mkt/...`.

### 3.3 Status após atualização desta rodada

- Política de verdade única de CSS implementada (`src/scss` -> `assets/css/main.css` compilado).
- Regra de versionamento e atualização obrigatória de `agents.md` por área adicionada.
- Estrutura de estilos e pipeline documentados na raiz e nas pastas de estilo.

## 4) Evolução de estilização (status atualizado)

Situação atual (01/04/2026):

- A V1 de estilos foi consolidada em `src/scss` como fonte única.
- `assets/css/main.css` passou a ser apenas compilado de `src/scss/main.scss`.
- O SCSS foi organizado em camada ampla + camadas específicas:
  - `src/scss/v1/_global.scss`
  - `src/scss/v1/_profile-gate.scss`
  - `src/scss/v1/_squads.scss`
  - `src/scss/v1/_birthdays.scss`
  - `src/scss/v1/_perfil.scss`
  - `src/scss/v1/_admin-icons.scss`

### Garantia de preservação visual da V1

- A migração foi feita por paridade do CSS vigente, sem alterar a identidade visual atual.
- O fluxo oficial de mudança visual passa a ser: editar SCSS -> compilar -> validar.

### Planejamento de evolução de estilização (sem perda visual)

## Fase A — Paridade e governança (concluída)

- Unificar fonte de verdade em `src/scss`.
- Bloquear edição manual do compilado.
- Atualizar documentação (`Agents.md`, `src/agents.md`, `assets/css/agents.md`).

## Fase B — Modularização semântica da V1 (concluída)

- `_global.scss` foi convertido em agregador.
- A camada global foi dividida em módulos semânticos:
  - `src/scss/v1/global/_foundation-effects.scss`
  - `src/scss/v1/global/_navigation.scss`
  - `src/scss/v1/global/_components.scss`
  - `src/scss/v1/global/_mesas-scrollbar.scss`
  - `src/scss/v1/global/_dark-mode.scss`
- A ordem de cascade foi preservada para manter o resultado visual da V1.

## Fase C — Padronização para expansão do Hub (concluída)

- Kit padrão de expansão implementado em `src/scss/v1/global/_expansion-standards.scss`:
  - shell/layout comum (`hub-std-page`, `hub-std-header`, `hub-std-grid`, `hub-std-col-*`);
  - seções padronizadas (`hub-std-section-*`);
  - filtros e KPI grids (`hub-std-filter*`, `hub-std-kpi-grid`);
  - empty state padrão (`hub-std-empty`);
  - dark mode obrigatório embutido no próprio kit.
- O kit `hub-std-*` ainda não foi aplicado nas páginas atuais da V1 (adoção planejada para novas páginas/dashboards).
- Refatoração SCSS aplicada com nesting em módulos-chave (`_expansion-standards`, `_profile-gate`, `_squads`, `_birthdays`, `_admin-icons`).
- Diretriz de tokens reforçada: priorizar variáveis e classes existentes do `sicoob-styles`.
- Checklist formal criado em `checklist-qa-visual.md` para validação de:
  - desktop/mobile;
  - light/dark;
  - contraste, foco, regressão visual e consistência entre páginas.

## 5) Diagnóstico de scripts

## 5.1 Forte acoplamento DOM x JS

- IDs e classes são contratos implícitos entre HTML e JS.
- Pequenas mudanças de markup quebram funcionalidades.

## 5.2 Regras de negócio no client

- Muitas regras críticas estão no front:
  - `profile_complete`,
  - prioridade de sugestão de mesa,
  - blocos de acesso por tipo de usuário.

### Ação recomendada

- Gradualmente mover validações sensíveis para banco/funções server-side (Supabase RPC/Edge Functions), mantendo UX no front.

## 6) Plano de evolução da autenticação (Supabase Auth)

Objetivo: eliminar códigos de acesso hardcoded e migrar para autenticação robusta com Supabase Auth, mantendo compatibilidade progressiva com o cenário atual.

## Fase 0 — Preparação (1-2 semanas)

- Criar coluna de vínculo auth em `users` (ex.: `auth_user_id` UUID único).
- Mapear usuários existentes (`user_name`, email corporativo, perfis externos).
- Definir estratégia de login:
  - e-mail/senha, magic link ou OTP corporativo.

## Fase 1 — Dual auth sem ruptura (2-4 semanas)

- Implementar novo fluxo em paralelo no `main.js`:
  - primeiro tenta sessão Supabase Auth,
  - fallback temporário para legado.
- Persistir perfil e papéis do usuário logado a partir de `auth.uid()`.
- Criar tela/modal de login novo e descontinuar códigos estáticos no UI.

## Fase 2 — Segurança de dados (2-4 semanas)

- Revisar políticas RLS para `authenticated` (e não apenas `anon`).
- Restringir mutações sensíveis por papel (admin/gestor) diretamente no banco.
- Encapsular operações críticas via RPC/Edge Function quando necessário.

## Fase 3 — Desativação do legado (1-2 semanas)

- Remover `ACCESS_CODES` e fluxos secretos do frontend.
- Limpar caminhos de autenticação antigos.
- Atualizar documentação raiz e por pasta.

## 7) Backlog priorizado (recomendado)

## P0 — Segurança e correções críticas

1. Remover códigos de acesso hardcoded e iniciar Fase 1 do Supabase Auth.
2. Corrigir inconsistência de tipos de toast (`danger` -> `error` ou adicionar variante).
3. Corrigir validação de avatar para 150 KB (ou atualizar regra oficial se 300 KB for intencional).
4. Corrigir `showFormDetail` para IDs string/UUID com segurança.

## P1 — Confiabilidade e manutenção

1. Padronizar geração de URLs sem hardcode `/web/mkt/`.
2. Alinhar documentação de schema com campos realmente usados.
3. Modularizar semanticamente a camada `src/scss/v1` sem alterar o resultado visual da V1.
4. Criar testes de fumaça para fluxos críticos (login, reservas, perfil, admin CRUD).

## P2 — Evolução de produto

1. Implementar observabilidade (erros JS + telemetria básica de uso).
2. Melhorar UX de fallback offline/erro de rede.
3. Incrementar acessibilidade (foco, contraste, teclado, ARIA em modais e tabelas).

## 8) Entregas de documentação realizadas nesta rodada

- `Agents.md` (raiz) atualizado com governança V1, obrigação de atualização por área e versionamento.
- `assets/css/agents.md` (regras do compilado CSS e pipeline SCSS).
- `src/agents.md` (estilização detalhada + governança de CSS).
- `checklist-qa-visual.md` (QA visual obrigatório para novas entregas de UI).
- `assets/js/agents.md` (arquitetura de scripts e fluxos por módulo).
- `admin/agents.md`
- `formularios/agents.md`
- `mesas/agents.md`
- `perfil/agents.md`
- `squads/agents.md`
- `usuarios/agents.md`

## 9) Próximo passo sugerido (imediato)

Com Fases A, B e C concluídas, o próximo foco recomendado é segurança/autenticação:

1. Iniciar Fase 1 do plano Supabase Auth (dual auth sem ruptura).
2. Remover gradualmente dependência de códigos de acesso hardcoded.
3. Validar RLS para cenário `authenticated` antes da retirada completa do legado.
