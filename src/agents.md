# agents.md — Governança de Estilização (SRC)

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


Este arquivo define as regras para evolução de estilos na pasta `src` do Hub Marketing.

## 1) Princípio central (obrigatório)

- A estilização da V1 tem **fonte única de verdade** em `src/scss`.
- `assets/css/main.css` é **somente artefato compilado**.
- Não é permitido ajustar CSS direto no compilado.

## 2) Arquitetura atual da V1 no SCSS

Entrypoint oficial:

- `src/scss/main.scss`

Partials ativos (ordem de importação):

1. `src/scss/v1/_global.scss` (agregador da camada global)
2. `src/scss/v1/_profile-gate.scss` (bloqueios/alertas de perfil)
3. `src/scss/v1/_squads.scss` (estilos específicos da página squads)
4. `src/scss/v1/_birthdays.scss` (bloco de aniversariantes da home)
5. `src/scss/v1/_perfil.scss` (layout bento e componentes de perfil)
6. `src/scss/v1/_admin-icons.scss` (modal flutuante e autocomplete de ícones do admin)

Módulos internos da camada global (`src/scss/v1/global/`):

1. `_foundation-effects.scss` (shell base, keyframes, efeitos globais)
2. `_navigation.scss` (sidebar, estados colapsados, tabs de admin)
3. `_components.scss` (cards, forms, tables, buttons, modais, utilitários)
4. `_mesas-scrollbar.scss` (grade de mesas, estado visual e scrollbar base)
5. `_dark-mode.scss` (overrides completos de dark mode)
6. `_expansion-standards.scss` (kit padrão da Fase C para novas páginas)

Observações:

- Os partials legados da raiz de `src/scss` foram removidos da base ativa para evitar duplicidade de manutenção.
- A Fase B de modularização semântica da V1 foi concluída sem alterar os seletores finais do CSS compilado.
- A Fase C adiciona classes `hub-std-*` para expansão com padrão visual consistente e dark mode embutido.
- A refatoração de nesting SCSS já cobre também os módulos `v1/_perfil.scss` e `v1/global/_dark-mode.scss`, mantendo a V1 visualmente equivalente.
- A organização de imports Sass foi migrada para `@use` (sem `@import`) no entrypoint da V1.

## 2.1) Kit padrão da Fase C (`hub-std-*`)

Classes recomendadas para novas páginas/dashboards:

- Layout: `.hub-std-page`, `.hub-std-header`, `.hub-std-grid`, `.hub-std-col-*`
- Seções: `.hub-std-section`, `.hub-std-section-head`, `.hub-std-section-body`, `.hub-std-section-foot`
- Filtros: `.hub-std-filter`, `.hub-std-filter-group`
- KPIs: `.hub-std-kpi-grid`
- Empty state: `.hub-std-empty`

Regra:

- Sempre preferir esse kit para novos módulos, em vez de criar variações visuais fora do padrão do Hub.
- No estado atual, esse kit ainda não está aplicado nos HTML existentes da V1 (uso planejado para expansão).

## 2.2) Alinhamento com Sicoob Styles

Prioridade para novas estilizações:

1. Reutilizar classes utilitárias já fornecidas pelo `sicoob-styles` quando atenderem ao caso.
2. Preferir tokens semânticos da lib antes de hardcode de cor/sombra/raio.

Tokens-base recomendados:

- Superfície/borda/texto: `--color-surface-*`
- Marca e acento: `--turq`, `--verdee`, `--verdem`
- Dark mode: `--athens-gray-*`, `--mine-shaft-*`, `--persian-green-*`
- Sistema visual: `--border-radius-*`, `--transition-*`, `--box-shadow-*`

## 3) Regra de organização de novos estilos

- Estilo amplo/reutilizável deve ir para partial amplo (preferencialmente `_global.scss`).
- Estilo específico de página deve ir no partial da página/contexto.
- Todo componente novo precisa de variação dark mode no mesmo fluxo de entrega.

## 4) Fluxo obrigatório para qualquer alteração visual

1. Editar SCSS em `src/scss`.
2. Compilar para `assets/css/main.css`.
3. Validar visual em light e dark mode.
4. Atualizar documentação da área (`agents.md`) e registrar versão.
5. Validar com o checklist de QA visual da Fase C (`/checklist-qa-visual.md`).

Comando de compilação recomendado:

```bash
npm_config_cache=/tmp/.npmcache npx --yes sass src/scss/main.scss assets/css/main.css --style=expanded --source-map
```

## 5) Estado de versionamento

- Baseline visual atual: **V1**.
- Toda alteração de estilo após esta baseline deve ser tratada como evolução incremental de V1 e registrada em histórico.

## 6) Checklist rápido de PR para estilos

- Mudança foi feita no SCSS (e não em `assets/css/main.css`)?
- Componente novo tem override para `[data-theme=dark]`?
- Responsividade validada em `max-width: 767px`?
- `assets/css/main.css` foi recompilado após ajuste?
- `agents.md` da área alterada foi atualizado?
