# agents.md — Regras da pasta assets/css

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de estilo sem atualização de documentação e versionamento.

## 1) Papel desta pasta

- `assets/css/main.css` é arquivo compilado para uso em runtime.
- `assets/css/main.css.map` é source map da compilação.

## 2) Regra crítica (obrigatória)

- **Nunca** editar `assets/css/main.css` manualmente.
- Qualquer ajuste visual deve ser feito em `src/scss` e depois compilado.

## 3) Fonte de verdade

- Entrypoint: `src/scss/main.scss`
- Partials ativos da V1: `src/scss/v1/*.scss`
- Módulos globais da V1: `src/scss/v1/global/*.scss`
- Kit de expansão da Fase C: `src/scss/v1/global/_expansion-standards.scss` (`hub-std-*`)
- `hub-std-*` ainda não está aplicado nos HTML atuais da V1; é um contrato para páginas futuras.
- O pipeline Sass da V1 usa `@use` (não usar `@import` em novos módulos).

## 3.1) Diretriz de tokens visuais

- Em novos estilos, priorizar tokens do `sicoob-styles`:
  - `--color-surface-*`
  - `--turq`, `--verdee`, `--verdem`
  - `--athens-gray-*`, `--mine-shaft-*`, `--persian-green-*`
  - `--border-radius-*`, `--transition-*`, `--box-shadow-*`

## 4) Comando de compilação recomendado

```bash
npm_config_cache=/tmp/.npmcache npx --yes sass src/scss/main.scss assets/css/main.css --style=expanded --source-map
```

## 5) Checklist antes de concluir alteração

- Mudança existe no SCSS correspondente?
- `main.css` foi recompilado?
- Não há edição manual residual no compilado?
- `agents.md` da área alterada e versionamento foram atualizados?
- Checklist visual em `/checklist-qa-visual.md` foi validado?
