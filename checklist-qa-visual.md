# Checklist de QA Visual — Fase C

Checklist oficial para validar novas páginas/dashboards do Hub Marketing sem quebrar coesão da V1.

## 1) Escopo de validação por página

Validar obrigatoriamente em:

- Desktop (`>= 768px`)
- Mobile (`<= 767px`)
- Light mode
- Dark mode (`data-theme="dark"`)

## 2) Contrato visual obrigatório

1. A página usa shell consistente (`.hub-content`, título e header no padrão do Hub).
2. Cards e blocos seguem padrão de borda, raio e espaçamento do ambiente.
3. Tabelas usam padrão de `hub-table-wrapper` + `hub-table`.
4. Modais usam padrão `hub-modal-*` ou equivalente aprovado.
5. Filtros e formulários seguem visual de `hub-filter-bar`/`form-control`.
6. Há feedback visual com `hub.utils.showToast()` para ações principais.
7. Cores de acento respeitam paleta (`--turq`, `--verdee`, `--verdem`).
8. Novos estilos priorizam tokens/classes do `sicoob-styles` antes de hardcode.

## 3) Responsividade

1. Sem overflow horizontal indevido em `320px` e `375px`.
2. Grid quebra corretamente para uma coluna quando necessário.
3. Botões e ações críticas permanecem clicáveis sem sobreposição.
4. Tabelas mantêm legibilidade e rolagem funcional.
5. Modais não ultrapassam viewport e preservam scroll interno.

## 4) Dark mode

1. Todo componente novo possui override explícito em dark mode.
2. Texto principal mantém contraste adequado em superfícies escuras.
3. Bordas e divisórias continuam perceptíveis em dark mode.
4. Estados de hover/focus permanecem visíveis.
5. Badges/status continuam legíveis.

## 5) Acessibilidade mínima

1. Estados de foco por teclado visíveis.
2. Contraste mínimo aceitável para texto e ações.
3. Ícones decorativos não substituem texto essencial.
4. Inputs possuem labels claros.

## 6) Regressão visual

1. Home, Admin, Perfil, Usuários, Squads, Formulários e Mesas permanecem visualmente consistentes após mudanças.
2. Não há alteração involuntária no CSS existente da V1.
3. Novas classes da Fase C (`.hub-std-*`) não colidem com classes existentes.

## 7) Evidência de validação (obrigatório em PR)

- Informar páginas validadas.
- Informar cenários validados (`desktop/mobile`, `light/dark`).
- Informar qualquer exceção aceita e justificativa.
