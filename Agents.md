# Agents.md — Regras para IA

Regras obrigatórias para qualquer agente de IA que edite este repositório. Leia **integralmente** antes de modificar qualquer arquivo.

---

## 1. Stack & Ambiente

| Item | Valor |
|------|-------|
| Frontend | HTML puro + JavaScript ES5 + Bootstrap 4.6.2 + jQuery 3.6.0 |
| Backend | Supabase (PostgreSQL + Storage) |
| Build system | **Nenhum** — sem npm, webpack, TypeScript ou transpilação |
| Módulos JS | IIFE com `'use strict'` — **nunca** `import`/`export` |
| Autenticação | SSO Liferay ou código de acesso (não JWT do Supabase) |
| Acesso ao banco | Anon key — todas as políticas RLS usam `TO anon` |
| Hospedagem | GitHub Pages + embed em Liferay |

### Bibliotecas (CDN)

```
Bootstrap 4.6.2 CSS    cdn.jsdelivr.net/npm/bootstrap@4.6.2
Sicoob Styles          squad-web-gecom.github.io/sicoob-styles/sicoob-style.css
FontAwesome 6.4.0      cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0
Supabase JS v2         cdn.jsdelivr.net/npm/@supabase/supabase-js@2
jQuery 3.6.0           code.jquery.com/jquery-3.6.0.min.js
Bootstrap 4.6.2 JS     cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js
```

> **Bootstrap 4.6.2** — nunca usar sintaxe do Bootstrap 5.

---

## 2. Estrutura de Arquivos

```
hub-marketing/
├── index.html                  (Home, data-page="home")
├── admin/index.html            (Admin CRUD, data-page="admin")
├── perfil/index.html           (Perfil, data-page="perfil")
├── usuarios/index.html         (Listagem de usuários, data-page="usuarios")
├── squads/index.html           (Cards de squads, data-page="squads")
├── formularios/index.html      (Formulários externos, data-page="formularios")
├── mesas/index.html            (Reserva de mesas, data-page="mesas")
├── assets/
│   ├── css/main.css            (Todos os estilos)
│   └── js/
│       ├── main.js             (Módulo compartilhado — hub.auth, hub.nav, hub.utils, hub.sb)
│       ├── admin.js            (CRUD completo)
│       ├── home.js             (Dashboard)
│       ├── perfil.js           (Perfil individual)
│       ├── usuarios.js         (Listagem pública)
│       ├── squads.js           (Cards de squads)
│       ├── mesas.js            (Reserva de mesas)
│       └── formularios.js      (Formulários)
```

Ordem de carregamento: `main.js` → `[page].js`

---

## 3. Padrão de Módulo JavaScript

### IIFE obrigatório

```javascript
(function() {
  'use strict';

  // variáveis e funções privadas

  document.addEventListener('hub:ready', function() {
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;
    init();
  });

  async function init() {
    try {
      hub.utils.showLoader();
      await loadData();
      renderUI();
      document.getElementById('app-view').style.display = '';
    } catch (err) {
      console.error('Module: init error', err);
      hub.utils.showToast('Erro ao carregar dados', 'error');
    } finally {
      hub.utils.hideLoader();
    }
  }
})();
```

### Regras JS

- **Sem `import`/`export`** — tudo via IIFE
- **ES5 obrigatório** — usar `var`, `function`, `.then()` se necessário (async/await é permitido mas manter consistência com o arquivo)
- **Nomenclatura:** `camelCase` para variáveis e funções, `UPPER_CASE` para constantes
- **Estado:** Variáveis no topo do IIFE (`var allUsers = []`, `var orgStructure = []`)
- **Handlers globais:** Expor via `window._adminNomeFunc = function(id) { ... }` para `onclick` em HTML dinâmico
- **XSS:** Sempre usar `hub.utils.escapeHtml()` em todo HTML gerado com dados do banco (alias comum: `var esc = hub.utils.escapeHtml`)

---

## 4. Objeto Global `window.hub`

### `hub.sb` — Supabase Client

```javascript
hub.sb.from('table').select('*').eq('column', value)
hub.sb.from('table').update(data).eq('id', id)
hub.sb.from('table').insert(row)
hub.sb.storage.from('Avatars').upload(fileName, file, { upsert: true })
hub.sb.storage.from('Avatars').getPublicUrl(fileName)
```

### `hub.config`

```javascript
hub.config.basePath   // '/hub-marketing' ou '' — NUNCA usar BASE_PATH fora de main.js
```

### `hub.auth`

```javascript
hub.auth.isAuthenticated()      // boolean
hub.auth.isAdmin()              // boolean (coluna is_admin)
hub.auth.isCoordenador()        // boolean (coluna is_gestor no DB)
hub.auth.isAdminOrCoord()       // boolean
hub.auth.getUser()              // objeto com { id, nome, apelido, user_name, email, isAdmin, isCoordenador, ... }
hub.auth.requireAuth()          // redireciona se não logado
hub.auth.requireMarketingUser() // redireciona externo para /formularios/
hub.auth.showLoginModal()
hub.auth.logout()
```

### `hub.utils`

```javascript
hub.utils.escapeHtml(str)                // previne XSS
hub.utils.showToast(msg, type, duration) // type: 'success'|'error'|'warning'|'info'
hub.utils.showLoader()                   // exibe spinner
hub.utils.hideLoader()                   // oculta spinner
hub.utils.normalizeIcon(icon, fallback)  // garante prefixo FA correto
hub.utils.formatDate(dateStr)            // dd/mm/yyyy
hub.utils.formatDateTime(dateStr)        // dd/mm/yyyy hh:mm
hub.utils.copyToClipboard(text)          // clipboard + toast
hub.utils.debounce(fn, ms)              // retorna função debounced
```

### `hub.nav`

```javascript
hub.nav.render()           // renderiza sidebar (automático)
hub.nav.openEditarPerfil() // navega para /perfil/?edit=1
```

### `hub.darkMode`

```javascript
hub.darkMode.init()    // inicializa tema (automático)
hub.darkMode.toggle()  // alterna light/dark
hub.darkMode.isDark()  // boolean
```

---

## 5. Design Tokens — Paleta de Cores

### Cores Primárias

| Token | Valor | Uso |
|-------|-------|-----|
| `--turq` | `#00ae9d` | Cor primária — botões, links, acentos |
| `--verdee` | `#003641` | Verde escuro — sidebar, títulos, headings |
| `--verdem` | `#7db61c` | Verde lima — indicadores de externos |

### Variantes do Turquesa

| Contexto | Valor |
|----------|-------|
| Hover escuro | `#008c7e` |
| Hover médio | `#009688`, `#00857a` |
| Tint 5% | `rgba(0,174,157,0.05)` |
| Tint 10% | `rgba(0,174,157,0.10)` |
| Tint 15% | `rgba(0,174,157,0.15)` |
| Tint 18% | `rgba(0,174,157,0.18)` |

### Neutros (Light Mode)

| Token | Valor | Uso |
|-------|-------|-----|
| Branco | `#ffffff` | Fundo de cards, modais |
| Off-white | `#f8f9fa`, `#fafafa`, `#f7f8f9` | Fundo de página |
| Cinza claro | `#e9ecef`, `#dee2e6` | Bordas, separadores |
| Cinza médio | `#6c757d`, `#495057` | Texto secundário |
| Cinza escuro | `#343a40`, `#212529` | Texto principal |

### Dark Mode — Athens Gray (Backgrounds)

| Token | Valor (RGBA) | Uso |
|-------|-------------|-----|
| `--athens-gray-50` | — | Texto de destaque |
| `--athens-gray-300` | — | Bordas sutis |
| `--athens-gray-400` | — | Texto terciário |
| `--athens-gray-500` | — | Bordas |
| `--athens-gray-600` | — | Separadores |
| `--athens-gray-700` | — | Cards secundários |
| `--athens-gray-800` | `rgba(30, 41, 59, 1)` | Cards |
| `--athens-gray-900` | `rgba(15, 23, 42, 1)` | Fundo de página |
| `--athens-gray-950` | `rgba(3, 7, 18, 1)` | Fundo mais escuro |

### Dark Mode — Mine Shaft (Textos)

| Token | Valor (RGBA) | Uso |
|-------|-------------|-----|
| `--mine-shaft-50` | `rgba(240, 244, 248, 1)` | Texto principal |
| `--mine-shaft-100` | `rgba(226, 232, 240, 1)` | Texto secundário |
| `--mine-shaft-200` | — | Texto terciário |

### Dark Mode — Persian Green (Acentos)

| Token | Uso |
|-------|-----|
| `--persian-green-400` | Acento primário (substitui turq) |
| `--persian-green-500` | Hover |
| `--persian-green-600` | Active/pressed |

### Status

| Tipo | Texto | Background |
|------|-------|------------|
| Success | `#155724` | `#d1e7dd` |
| Danger | `#dc3545` | Light red |
| Warning | — | `#fff3cd` |
| Info | — | `#d1ecf1` |
| Error | `#842029` | — |

---

## 6. Tipografia

| Propriedade | Valor |
|-------------|-------|
| Font family | `var(--font-sans)` (herdada do Bootstrap/Sicoob Styles) |
| Font base | `1rem` (16px) |
| Line-height body | `1.5` |
| Line-height headings | `1.1` – `1.3` |

### Escala de Tamanhos

```
3rem      → Números de destaque (stat cards)
2rem      → Hero
1.5rem    → Título de página (.hub-page-title)
1.35rem   → Subtítulo grande
1.25rem   → Subtítulo
1.1rem    → Destaque em cards
1rem      → Corpo
0.95rem   → Corpo secundário
0.875rem  → Texto pequeno (tabelas, badges)
0.8rem    → Caption
0.75rem   → Micro texto
0.7rem    → Mínimo
```

### Pesos

```
400 → Regular (corpo)
500 → Medium (labels)
600 → Semibold (botões, links)
700 → Bold (títulos)
900 → Icons FontAwesome
```

---

## 7. Espaçamento

### Padding (valores mais usados)

```
2.5rem (40px)   → Seções grandes
2rem   (32px)   → Cards grandes
1.5rem (24px)   → Cards, seções
1rem   (16px)   → Padrão interno
0.75rem (12px)  → Elementos compactos
0.5rem  (8px)   → Mínimo
0.25rem (4px)   → Micro
```

### Gap (Flex/Grid)

```
24px / 1.5rem   → Entre cards
16px / 1rem     → Entre elementos
12px / 0.75rem  → Dentro de cards
8px  / 0.5rem   → Mínimo
4px  / 0.25rem  → Micro
```

---

## 8. Border Radius

| Token/Valor | Uso |
|-------------|-----|
| `50%` | Avatares (círculos, 96x96px) |
| `var(--border-radius-pill)` / `20px` | Chips, pills, badges arredondados |
| `16px` | Modais, cards grandes |
| `var(--border-radius-md)` / `~12px` | Cards padrão, table wrappers |
| `var(--border-radius-sm)` / `~8px` | Botões, inputs |
| `var(--border-radius-xs)` / `~4-6px` | Elementos pequenos |
| `0` | Cells de tabela, itens de nav |

---

## 9. Sombras (Elevação)

### Nível 1 — Sutil (cards em repouso)

```css
box-shadow: 0 4px 12px rgba(0, 54, 65, 0.08);
box-shadow: 0 4px 16px rgba(0, 54, 65, 0.06);
```

### Nível 2 — Hover

```css
box-shadow: 0 8px 24px rgba(0, 54, 65, 0.14);
box-shadow: 0 4px 12px rgba(0, 174, 157, 0.15);  /* com tint turquesa */
```

### Nível 3 — Elevado (modais, dropdowns)

```css
box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);      /* light */
box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);        /* dark */
```

### Focus Ring

```css
box-shadow: 0 0 0 3px rgba(0, 174, 157, 0.08);     /* input focus sutil */
box-shadow: 0 0 0 3px rgba(0, 174, 157, 0.15);     /* input focus forte */
```

### Inset

```css
box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.06);   /* profundidade interna */
box-shadow: inset 0 0 0 2px var(--turq);             /* border inset ativo */
```

---

## 10. Transições & Animações

### Easing

```
cubic-bezier(0.4, 0, 0.2, 1)   → Padrão Material Design (preferencial)
ease                             → Geral
ease-in-out                      → Movimentos suaves
ease-out                         → Entradas
```

### Durações

```
0.3s    → Padrão (hover, modais)
0.25s   → Rápido
0.2s    → Muito rápido
0.15s   → Micro-interações
```

### Animações Keyframe

| Nome | Duração | Uso |
|------|---------|-----|
| `fadeIn` | 0.3s ease-out | Entrada de elementos (opacity + translateY) |
| `modalFadeIn` | 0.3s ease-out | Entrada de modais (scale + translateY) |
| `fadeOut` | 0.3s ease-in | Saída de elementos |
| `hub-float` | 8s ease-in-out | Flutuação vertical decorativa |
| `arrowFloat` | 2.5s ease-in-out | Seta animada horizontal |
| `gradientShift` | 4s | Gradiente animado (nome do greeting) |
| `spinGradient` | 10s linear | Borda rotativa (stat cards) |

---

## 11. Dark Mode — Regras Obrigatórias

### Como funciona

- Ativado via atributo `data-theme="dark"` no `<html>`
- Controlado por `hub.darkMode.toggle()` / `hub.darkMode.init()`
- Estado salvo em `localStorage`

### Regra: Todo novo componente DEVE ter override dark

```css
/* Light mode (padrão) */
.meu-componente {
  background: #fff;
  color: #212529;
  border: 1px solid #dee2e6;
}

/* Dark mode (obrigatório) */
[data-theme=dark] .meu-componente {
  background-color: var(--athens-gray-800);   /* ou 900/950 conforme profundidade */
  color: var(--mine-shaft-50);
  border-color: rgba(255, 255, 255, 0.08);
}
```

### Cores dark mode por contexto

| Contexto | Light | Dark |
|----------|-------|------|
| Fundo de página | `#f8f9fa` | `var(--athens-gray-900)` |
| Fundo de card | `#fff` | `var(--athens-gray-800)` |
| Fundo mais profundo | `#f7f8f9` | `var(--athens-gray-950)` |
| Texto principal | `#212529` | `var(--mine-shaft-50)` |
| Texto secundário | `#6c757d` | `var(--mine-shaft-100)` |
| Bordas | `#dee2e6` | `rgba(255,255,255,0.08)` |
| Acento primário | `var(--turq)` | `var(--persian-green-400)` |
| Scrollbar thumb | `var(--turq)` | `var(--persian-green-400)` |

---

## 12. Componentes CSS

### Cards

```css
.hub-card           /* Card branco, sombra nível 1, border-radius ~12px */
.hub-card-header    /* Cabeçalho do card */
.hub-card-body      /* Corpo do card */
.hub-card-footer    /* Rodapé do card */
.hub-stat-card      /* Card de estatística com borda gradiente rotativa */
```

### Layout de Página

```css
.hub-app            /* Flex column, min-height 100vh */
.hub-content        /* Flex 1, padding 24px, margin-left 260px (desktop) */
.hub-page-header    /* Flex row, justify-between — título + ações */
.hub-page-title     /* h1, 1.5rem, bold, cor verdee */
```

### Tabelas

```css
.hub-table-wrapper  /* overflow-x auto, border-radius */
.hub-table          /* thead sticky, hover rows */
.td-acoes           /* Coluna de ações — SEMPRE primeira, white-space nowrap */
.td-truncate        /* max-width 160px, text-overflow ellipsis */
.btn-icon-sm        /* Botão 28x28px para ações em linhas */
```

### Modais

```css
.hub-modal-overlay      /* Fixed, center, backdrop-filter blur(5px), z-index 600 */
.hub-modal-overlay.show /* Visível */
.hub-modal              /* Container, max-width 700px, border-radius 16px */
.hub-modal-header       /* Com botão x */
.hub-modal-body         /* Scroll interno */
.hub-modal-footer       /* Botões Cancelar / Salvar */
.hub-modal-close        /* Botão x (font-size 1.5rem) */
```

### Tabs (Admin)

```css
.admin-tabs-container   /* Container com setas e fade nas bordas */
.admin-tabs-wrapper     /* Scroll horizontal */
#admin-tabs             /* Nav pills com underline ativo */
.tabs-scroll-btn        /* Setas left/right (visíveis se overflow) */
```

### Badges

```css
.count-badge        /* Badge verde com contagem numérica */
.badge-success      /* Background turquesa claro, texto turquesa */
.badge-danger       /* Background vermelho claro, texto vermelho */
.badge-warning      /* Background amarelo claro */
.badge-info         /* Background azul claro */
```

### Perfil — Bento Grid

```css
.perfil-bento-grid      /* CSS Grid 12 colunas */
.perfil-bento-foto      /* Col 1–8, row 1 — avatar + identidade */
.perfil-bento-org       /* Col 9–12, row 1 — estrutura org */
.perfil-bento-sobre     /* Col 1–4, rows 2–3 — sobre mim (2 linhas) */
.perfil-bento-dados     /* Col 5–9, row 2 — dados pessoais */
.perfil-bento-squads    /* Col 9–12, row 2 — squads */
.perfil-bento-gostos    /* Col 5–12, row 3 — gostos pessoais */
.perfil-avatar          /* Círculo 96x96px */
.perfil-squad-chip      /* Chip com border-radius 20px, texto turquesa */
.perfil-gostos-grid     /* Grid 2 colunas */
.perfil-info-row        /* Linha: ícone + label + valor */
```

### Sidebar/Navegação

```css
.hub-nav            /* 260px de largura fixa (desktop) */
                    /* Oculto em mobile (max-width 767px) */
```

---

## 13. Breakpoints Responsivos

| Breakpoint | Query | Comportamento |
|------------|-------|---------------|
| Mobile | `@media (max-width: 767px)` | Sidebar oculta, `.hub-content` sem margin-left, grids empilhados |
| Mobile pequeno | `@media (max-width: 576px)` | Espaçamento extra-reduzido, fontes menores |
| Desktop | `@media (min-width: 768px)` | Sidebar visível, layouts em grid |

---

## 14. Ícones — FontAwesome 6.4.0 Free

### Formato obrigatório

Sempre armazenar como:
```
fa-solid fa-[nome]     → ícones sólidos
fa-brands fa-[nome]    → ícones de marcas
```

### Normalização

Sempre chamar `hub.utils.normalizeIcon(icon, fallback)` ao exibir ícones do banco:
- Adiciona prefixo se ausente
- Mapeia ícones Pro para equivalentes Free
- Retorna fallback se vazio

### Autocomplete no Admin

IDs dos inputs que têm autocomplete: `sq-icone`, `cat-icone`, `fm-icone`, `lk-icone`

---

## 15. Padrões de CRUD (Admin)

### Fluxo padrão

```javascript
// 1. Usuário clica botão na tabela
// <button onclick="window._adminEditEntity(id)">

// 2. Handler monta HTML do formulário
window._adminEditEntity = function(id) {
  var entity = allEntities.find(function(x) { return x.id === id; });
  var formHtml = '<div class="form-group">...</div>';

  // 3. Abre modal
  showEditModal('Editar: ' + esc(entity.nome), formHtml, async function() {
    var updates = {
      campo: document.getElementById('prefixo-campo').value.trim()
    };

    // 4. Salva no Supabase
    var res = await hub.sb.from('table').update(updates).eq('id', id);
    if (res.error) {
      hub.utils.showToast('Erro: ' + res.error.message, 'error');
      return;
    }
    hub.utils.showToast('Salvo com sucesso', 'success');
    hideEditModal();
    loadEntities(); // 5. Recarrega tabela
  });
};
```

### Confirmação para ações destrutivas

```javascript
showConfirm('Desativar este item?', async function() {
  var res = await hub.sb.from('table').update({ is_active: false }).eq('id', id);
  // ...
});
```

### Prefixos de IDs de input por entidade

| Prefixo | Entidade | Exemplos |
|---------|----------|----------|
| `eu-` | User | `eu-nome`, `eu-email`, `eu-gerencia`, `eu-is-admin`, `eu-is-gestor`, `eu-senioridade` |
| `sq-` | Squad | `sq-nome`, `sq-descricao`, `sq-icone`, `sq-link`, `sq-link-label` |
| `cat-` | Categoria | `cat-nome`, `cat-icone` |
| `fm-` | Formulário | `fm-nome`, `fm-url`, `fm-icone` |
| `lk-` | Link Rápido | `lk-titulo`, `lk-url`, `lk-icone`, `lk-secao`, `lk-ordem` |
| `org-` | Org Structure | `org-nome` |
| `desk-` | Mesa | `desk-number`, `desk-zona` |

### Handlers globais (window._admin*)

Todas as funções de CRUD são expostas em `window._admin[Ação][Entidade]`:
```
window._adminEditUser(id)
window._adminDeactivateUser(id)
window._adminAddSquad()
window._adminEditSquad(id)
window._adminManageMembers(id)
window._adminAddMember(squadId)
window._adminRemoveMember(squadId, memberId)
// etc.
```

---

## 16. Supabase & Banco de Dados

### Conexão

```
URL: https://gcqitocopjdilxgupril.supabase.co
Auth: anon key (sem JWT)
RLS: TO anon
```

### Tabelas

#### `users`

| Coluna | Tipo | Nota |
|--------|------|------|
| id | uuid | PK |
| user_name | text | Login único, sem @domain |
| nome | text | Nome completo |
| apelido | text | Como prefere ser chamado |
| email | text | |
| gerencia_id | uuid → org_structure | |
| coordenacao_id | uuid → org_structure | |
| nucleo_id | uuid → org_structure | |
| telefone | text | |
| aniversario | date | |
| endereco | text | Logradouro |
| bairro | text | |
| cep | text | |
| senioridade | text | Ver valores válidos abaixo |
| terceirizado | boolean | |
| is_admin | boolean | |
| is_gestor | boolean | Era `is_coordenador` |
| is_active | boolean | |
| profile_complete | boolean | |
| avatar_url | text | URL pública do bucket Avatars |
| sobre_mim | text | Texto livre |
| gostos_pessoais | jsonb | `{ livros:[], filmes:[], comidas:[], hobbies:[], time_coracao:"" }` |

#### `org_structure`

| Coluna | Tipo |
|--------|------|
| id | uuid |
| nome | text |
| tipo | text — `'gerencia'` \| `'coordenacao'` \| `'nucleo'` |
| parent_id | uuid → self |
| is_active | boolean |

#### `squads`

| Coluna | Tipo |
|--------|------|
| id | uuid |
| nome | text |
| descricao | text |
| categoria_id | uuid → squad_categories |
| icone | text — classe FA |
| link | text (era `link_wrike`) |
| link_label | text — texto do botão |
| is_active | boolean |

#### `squad_members`

| Coluna | Tipo |
|--------|------|
| id | uuid |
| squad_id | uuid → squads |
| user_id | uuid → users |

> **Sem coluna `user_name`** — sempre filtrar por `user_id`.

#### `quick_links`, `forms`, `desks`, `reservations`, `squad_categories`

Ver CLAUDE.md para schema completo destas tabelas.

### Storage — Bucket `Avatars`

- Nome: `Avatars` (A **maiúsculo** — obrigatório)
- Público: sim
- Limite: **150 KB**, apenas **JPG/PNG**
- Upload: `hub.sb.storage.from('Avatars').upload(fileName, file, { upsert: true, contentType: file.type })`
- URL pública: `hub.sb.storage.from('Avatars').getPublicUrl(fileName).data.publicUrl`

---

## 17. Valores de Senioridade

```
'Gerente' | 'Coordenador' | 'Especialista' | 'Sênior' | 'Pleno' |
'Júnior' | 'Assistente' | 'Estagiário' | 'Jovem Aprendiz'
```

---

## 18. Convenções de Nomenclatura

### HTML

| Padrão | Uso | Exemplos |
|--------|-----|----------|
| `data-page="[id]"` | Atributo no `<html>` | `data-page="home"`, `data-page="admin"` |
| `data-tab="[nome]"` | Tab routing | `data-tab="usuarios"` |
| `data-nav="[id]"` | Item de navegação | `data-nav="home"` |
| `#[page]-header-actions` | Área de botões no header | `#perfil-header-actions` |
| `#app-view` | Container principal (oculto até dados carregados) | |
| `#loader` | Spinner global | |
| `#[entidade]-[campo]` | Inputs em modais | `#eu-nome`, `#sq-icone` |

### CSS

| Padrão | Exemplos |
|--------|----------|
| `hub-[componente]` | `hub-card`, `hub-table`, `hub-modal`, `hub-nav` |
| `perfil-[seção]` | `perfil-bento-grid`, `perfil-avatar`, `perfil-squad-chip` |
| `admin-[feature]` | `admin-tabs-container`, `admin-panel-header` |
| `[data-theme=dark] .classe` | Override dark mode |

### JavaScript

| Padrão | Uso |
|--------|-----|
| `camelCase` | Variáveis e funções |
| `UPPER_CASE` | Constantes (`ICON_LIST`, `CACHE_VERSION`) |
| `window._admin[Acao][Entidade]` | Handlers globais |
| `var esc = hub.utils.escapeHtml` | Alias comum no topo do IIFE |
| `all[Entities]` | Arrays de cache (`allUsers`, `allSquads`) |

---

## 19. Padrão de Consulta Supabase

### Select com tratamento de erro

```javascript
var resp = await hub.sb.from('table').select('*').eq('is_active', true).order('nome');
if (resp.error) throw resp.error;
var data = resp.data || [];
```

### Carregamento paralelo

```javascript
var results = await Promise.all([
  hub.sb.from('users').select('*'),
  hub.sb.from('squads').select('*, squad_members(*)'),
  hub.sb.from('org_structure').select('*')
]);

if (results[0].error) throw results[0].error;
var users = results[0].data || [];
```

---

## 20. Regras Obrigatórias (Checklist)

1. **`hub.utils.escapeHtml()`** em todo HTML gerado com dados do banco
2. **`hub.config.basePath`** para caminhos — nunca `BASE_PATH` fora de `main.js`
3. **`squad_members`** filtra por `user_id`, nunca por `user_name`
4. **Bucket `Avatars`** com A maiúsculo
5. **`is_gestor`** é a coluna atual (era `is_coordenador`)
6. **`link`** é a coluna atual (era `link_wrike`)
7. **Bootstrap 4.6.2** — não usar classes ou comportamento do Bootstrap 5
8. **IIFE com `'use strict'`** em todo arquivo JS
9. **Dark mode override** obrigatório para todo novo componente CSS
10. **`profile_complete`** requer: nome, apelido, telefone, aniversario, endereco, bairro, cep, senioridade, gerencia_id; coordenacao_id e nucleo_id obrigatórios exceto para `is_gestor = true`
11. **Avatar: 150 KB**, apenas JPG/PNG
12. **Sem build system** — nenhum npm, webpack, TypeScript
13. **Sem módulos ES6** — nenhum `import`/`export`
14. **Testar dark mode** ao criar qualquer componente visual novo
15. **Coluna Ações** sempre primeira nas tabelas admin
16. **Toast para feedback** — usar `hub.utils.showToast()` para todas as notificações

---

## 21. Linguagem

- Interface em **Português Brasileiro (pt-BR)**
- `<html lang="pt-BR">`
- Mensagens de toast, labels, placeholders e textos de UI em português
- Nomes de variáveis e funções em **inglês** (camelCase)
- Comentários no código podem ser em português ou inglês
