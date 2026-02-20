# Hub Marketing — Guia para IA

Este arquivo documenta a arquitetura, padrões e convenções do projeto Hub Marketing para uso em sessões de desenvolvimento com IA. Leia antes de qualquer modificação.

---

## Visão Geral

App estático de intranet para a equipe de Marketing do Sicoob. Hospedado no GitHub Pages e também embarcado em portal Liferay.

- **Frontend:** HTML puro + JavaScript ES5/IIFE + Bootstrap 4.6.2 + jQuery 3.6.0
- **Backend:** Supabase (PostgreSQL + Storage)
- **Sem build system** — nenhum npm, webpack, TypeScript ou transpilação
- **Autenticação:** SSO Liferay ou código de acesso (não JWT nativo do Supabase)
- **Anon key:** O app usa a chave anônima do Supabase. Todos os acessos ao banco e ao Storage são feitos como `anon`. Políticas RLS devem usar `TO anon`.

---

## Estrutura de Arquivos

```
hub-marketing/
├── index.html                  (Home, data-page="home")
├── admin/index.html            (Admin CRUD, data-page="admin")
├── perfil/index.html           (Perfil de usuário, data-page="perfil")
├── usuarios/index.html         (Listagem pública de usuários, data-page="usuarios")
├── squads/index.html           (Cards de squads, data-page="squads")
├── formularios/index.html      (Links para formulários externos, data-page="formularios")
├── mesas/index.html            (Reserva de mesas, data-page="mesas")
├── assets/
│   ├── css/main.css            (Todos os estilos do hub)
│   └── js/
│       ├── main.js             (Módulo compartilhado — hub.auth, hub.nav, hub.utils, hub.sb)
│       ├── admin.js            (CRUD completo do admin)
│       ├── home.js             (Dashboard, links rápidos, aniversariantes)
│       ├── perfil.js           (Página de perfil individual)
│       ├── usuarios.js         (Listagem pública de usuários)
│       ├── squads.js           (Cards e membros de squads)
│       ├── mesas.js            (Reserva de mesas)
│       └── formularios.js      (Formulários externos)
└── claude.md                   (Este arquivo)
```

---

## Bibliotecas (CDN, sem instalação local)

```html
Bootstrap 4.6.2         https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css
Sicoob Styles           https://squad-web-gecom.github.io/sicoob-styles/sicoob-style.css
FontAwesome 6.4.0       https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
Supabase JS v2          https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
jQuery 3.6.0            https://code.jquery.com/jquery-3.6.0.min.js
Bootstrap JS 4.6.2      https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js
```

Cada página carrega nesta ordem: `main.js` → `[page].js`

---

## Padrão de Módulo JS (IIFE)

Todo arquivo JS usa IIFE com `'use strict'`. Nenhum módulo ES6. Sem `import`/`export`.

```javascript
(function() {
  'use strict';

  // variáveis e funções privadas

  // escuta o evento disparado por main.js quando tudo estiver pronto
  document.addEventListener('hub:ready', function() {
    if (!hub.auth.requireAuth()) return;       // redireciona se não logado
    if (!hub.auth.requireMarketingUser()) return; // bloqueia externos
    init();
  });

  async function init() { ... }
})();
```

---

## Objeto Global `window.hub`

Definido em `main.js` e disponível em todas as páginas.

### `hub.sb` — Cliente Supabase (lazy getter)
```javascript
hub.sb.from('users').select('*').eq('is_active', true)
hub.sb.storage.from('Avatars').upload(fileName, file, { upsert: true })
hub.sb.storage.from('Avatars').getPublicUrl(fileName)
```

### `hub.config`
```javascript
hub.config.basePath   // ex: '/hub-marketing' ou ''
// NÃO use BASE_PATH diretamente em outros arquivos — apenas main.js tem essa var local
```

### `hub.auth`
```javascript
hub.auth.isAuthenticated()     // boolean
hub.auth.isAdmin()             // boolean — é admin
hub.auth.isCoordenador()       // boolean — é gestor (coluna is_gestor no DB)
hub.auth.isAdminOrCoord()      // boolean — admin OU gestor
hub.auth.getUser()             // { id, nome, apelido, user_name, email, isAdmin, isCoordenador, isExternal, ... }
hub.auth.requireAuth()         // redireciona se não logado; retorna false se bloqueado
hub.auth.requireMarketingUser() // redireciona externo para /formularios/; retorna false se bloqueado
hub.auth.showLoginModal()
hub.auth.hideLoginModal()
hub.auth.logout()
```

**Atenção:** A chave interna `isCoordenador` no objeto de role mapeia para a coluna `is_gestor` no banco (renomeada da `is_coordenador`).

### `hub.utils`
```javascript
hub.utils.escapeHtml(str)                // previne XSS — use em TODO HTML gerado
hub.utils.showToast(msg, type, duration) // type: 'success'|'error'|'warning'|'info'
hub.utils.showLoader()                   // exibe #loader spinner
hub.utils.hideLoader()                   // oculta #loader
hub.utils.normalizeIcon(icon, fallback)  // garante prefixo FA correto; mapeia Pro→Free
hub.utils.formatDate(dateStr)            // dd/mm/yyyy
hub.utils.formatDateTime(dateStr)        // dd/mm/yyyy hh:mm
hub.utils.copyToClipboard(text)          // clipboard + toast "Copiado!"
hub.utils.debounce(fn, ms)
```

### `hub.nav`
```javascript
hub.nav.render()           // renderiza o sidebar (chamado automaticamente por main.js)
hub.nav.openEditarPerfil() // navega para /perfil/
```

---

## Evento `hub:ready`

Disparado por `main.js` após Supabase, auth, nav e dark mode estarem inicializados.

```javascript
document.addEventListener('hub:ready', function(e) {
  // e.detail.user — usuário logado (ou null se view mode)
});
```

---

## Banco de Dados Supabase

**URL:** `https://gcqitocopjdilxgupril.supabase.co`
**Acesso:** anon key (sem JWT auth)

### Tabela `users`

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid | PK |
| user_name | text | login único, sem @domain |
| nome | text | nome completo |
| apelido | text | como prefere ser chamado |
| email | text | |
| gerencia_id | uuid → org_structure | |
| coordenacao_id | uuid → org_structure | |
| nucleo_id | uuid → org_structure | |
| telefone | text | |
| aniversario | date | |
| endereco | text | logradouro |
| bairro | text | |
| cep | text | |
| senioridade | text | Gerente / Coordenador / Especialista / Sênior / Pleno / Júnior / Assistente / Estagiário / Jovem Aprendiz |
| terceirizado | boolean | |
| is_admin | boolean | |
| is_gestor | boolean | era `is_coordenador`, renomeada na Fase 6 |
| is_active | boolean | |
| profile_complete | boolean | |
| avatar_url | text | URL pública do bucket Avatars |
| sobre_mim | text | texto livre |
| gostos_pessoais | jsonb | `{ livros:[], filmes:[], comidas:[], hobbies:[], time_coracao:"" }` |

### Tabela `org_structure`

| Coluna | Tipo |
|---|---|
| id | uuid |
| nome | text |
| tipo | text — `'gerencia'` \| `'coordenacao'` \| `'nucleo'` |
| parent_id | uuid → self (gerencia → coord → nucleo) |
| is_active | boolean |

### Tabela `squads`

| Coluna | Tipo |
|---|---|
| id | uuid |
| nome | text |
| descricao | text |
| categoria_id | uuid → squad_categories |
| icone | text — classe FA (ex: `fa-solid fa-users`) |
| link | text | era `link_wrike`, renomeada na Fase 5b |
| link_label | text | texto do botão, default "Link" |
| is_active | boolean |

### Tabela `squad_members`

| Coluna | Tipo |
|---|---|
| id | uuid |
| squad_id | uuid → squads |
| user_id | uuid → users |

> ⚠️ Não tem coluna `user_name`. Sempre filtrar por `user_id`.

### Tabela `squad_categories`

| Coluna | Tipo |
|---|---|
| id | uuid |
| nome | text |
| icone | text — classe FA |
| is_active | boolean |

### Tabela `quick_links`

| Coluna | Tipo |
|---|---|
| id | uuid |
| titulo | text |
| url | text |
| icone | text — classe FA |
| descricao | text |
| secao | text — agrupa links (ex: "ferramentas") |
| ordem | integer |
| is_active | boolean |

### Tabela `forms`

| Coluna | Tipo |
|---|---|
| id | uuid |
| nome | text |
| descricao | text |
| url | text |
| icone | text — classe FA |
| ordem | integer |
| is_active | boolean |

### Tabela `desks`

| Coluna | Tipo |
|---|---|
| id | uuid |
| number | integer |
| zona | text |
| label | text |
| row_index | integer |
| col_index | integer |
| row_span | integer |
| col_span | integer |
| fixed_reserve | text — user_name com reserva fixa |
| is_active | boolean |

### Tabela `reservations`

| Coluna | Tipo |
|---|---|
| id | uuid |
| desk_id | uuid → desks |
| user_id | uuid → users |
| date | date |
| created_at | timestamp |

### Storage Bucket `Avatars`

- **Nome:** `Avatars` (com A maiúsculo — obrigatório)
- **Público:** sim
- **Upload:** `hub.sb.storage.from('Avatars').upload(fileName, file, { upsert: true, contentType: file.type })`
- **URL pública:** `hub.sb.storage.from('Avatars').getPublicUrl(fileName).data.publicUrl`
- **Limite:** 150 KB, apenas JPG/PNG
- **Políticas RLS:** `TO anon` (app usa anon key, não JWT)

---

## Padrão de Admin CRUD

### `showEditModal(title, bodyHTML, onSave)`

Usado em `admin.js` para todos os formulários de edição:

```javascript
showEditModal('Editar Usuário: ' + u.nome, formHtml, async function() {
  var updates = {
    campo: document.getElementById('input-id').value.trim()
  };
  var res = await hub.sb.from('users').update(updates).eq('id', userId);
  if (res.error) { hub.utils.showToast('Erro: ' + res.error.message, 'error'); return; }
  hub.utils.showToast('Salvo com sucesso', 'success');
  hideEditModal();
  loadUsuarios(); // recarrega a tabela
});
```

### `showConfirm(message, onConfirm)`

Para ações destrutivas (desativar, remover):

```javascript
showConfirm('Desativar este squad?', async function() {
  var res = await hub.sb.from('squads').update({ is_active: false }).eq('id', id);
  ...
});
```

### Funções expostas globalmente

Botões nas tabelas usam `onclick="window._adminFuncao(id)"`:

```javascript
window._adminEditUser(userId)
window._adminDeactivateUser(userId)
window._adminReactivateUser(userId)
window._adminAddSquad()
window._adminEditSquad(squadId)
window._adminManageMembers(squadId)
window._adminAddMember(squadId)
window._adminRemoveMember(squadId, memberRowId)
window._adminDeactivateSquad(squadId)
window._adminAddCategoria()
window._adminEditCategoria(catId)
window._adminAddLink()
window._adminEditLink(linkId)
window._adminDeactivateLink(linkId)
// etc.
```

### IDs de inputs de formulário por entidade

```
eu-[campo]        → Edit User: eu-nome, eu-email, eu-gerencia, eu-is-admin, eu-is-gestor, eu-senioridade...
sq-[campo]        → Squad: sq-nome, sq-descricao, sq-icone, sq-link, sq-link-label...
cat-[campo]       → Categoria: cat-nome, cat-icone...
fm-[campo]        → Formulário: fm-nome, fm-url, fm-icone...
lk-[campo]        → Link Rápido: lk-titulo, lk-url, lk-icone, lk-secao, lk-ordem...
org-[campo]       → Org Structure: org-nome...
desk-[campo]      → Mesa: desk-number, desk-zona...
```

### Variáveis de estado do admin

```javascript
var allUsers      = [];  // todos os users (loaded uma vez)
var orgStructure  = [];  // org_structure (loaded uma vez)
var allSquads     = [];  // inclui squad_members nested
var allQuickLinks = [];
// etc.
```

---

## CSS — Classes e Variáveis

### Variáveis de cor principais

```css
--turq:      #00ae9d   /* verde-água — cor primária do hub */
--verdee:    #003641   /* verde escuro — sidebar e títulos */
--verdem:    #7db61c   /* verde lima — externos */

/* Athens Gray — backgrounds dark mode */
--athens-gray-800: rgba(30, 41, 59, 1)   /* bg cards dark */
--athens-gray-900: rgba(15, 23, 42, 1)   /* bg página dark */
--athens-gray-950: rgba(3, 7, 18, 1)     /* bg mais escuro */

/* Mine Shaft — textos dark mode */
--mine-shaft-50:  rgba(240, 244, 248, 1) /* texto principal dark */
--mine-shaft-100: rgba(226, 232, 240, 1)
```

### Classes principais

```css
/* Cards */
.hub-card            /* card branco com sombra */
.hub-card-header     /* cabeçalho do card */
.hub-card-body       /* corpo do card */
.hub-card-footer     /* rodapé do card */

/* Layout */
.hub-page-header     /* flex row justify-between — título + ações */
.hub-page-title      /* h1 principal da página */
.admin-panel-header  /* flex row — título da seção + botão Novo */
.admin-panel-title   /* título da seção do admin */
.count-badge         /* badge verde com contagem (ex: "12") */

/* Tabelas */
.hub-table-wrapper   /* div com overflow-x auto + border-radius */
.hub-table           /* tabela com thead sticky, hover rows */
.td-acoes            /* coluna de ações (sempre primeira) — white-space nowrap */
.td-truncate         /* max-width 160px, ellipsis para texto longo */
.btn-icon-sm         /* botão 28×28px para ações em tabela */

/* Modais */
.hub-modal-overlay   /* overlay escuro, z-index 600 */
.hub-modal-overlay.show  /* visível */
.hub-modal           /* container do modal */
.hub-modal-header    /* com botão × */
.hub-modal-body      /* conteúdo com scroll */
.hub-modal-footer    /* botões Cancelar / Salvar */
.hub-modal-close     /* botão × */

/* Tabs (Admin) */
.admin-tabs-container   /* container com setas de scroll e fade */
.admin-tabs-wrapper     /* scrollable wrapper */
#admin-tabs             /* nav-pills com underline ativo */
.tabs-scroll-btn        /* setas left/right, visíveis só se overflow */
.tabs-scroll-btn.visible

/* Perfil — Bento Grid */
.perfil-bento-grid      /* CSS Grid 12 colunas */
.perfil-bento-foto      /* col 1–8, linha 1 */
.perfil-bento-org       /* col 9–12, linha 1 */
.perfil-bento-gostos    /* col 1–4, linhas 2–3 */
.perfil-bento-squads    /* col 5–8, linha 2 */
.perfil-bento-sobre     /* col 9–12, linha 2 */
.perfil-bento-dados     /* col 5–12, linha 3 */
.perfil-foto-inner      /* grid interno: avatar | identidade */
.perfil-avatar          /* círculo 96×96px */
.perfil-squad-chip      /* chip verde com nome do squad */
.perfil-gostos-grid     /* grid 2 colunas para gostos pessoais */
.perfil-gosto-card      /* card individual de gosto */
.perfil-info-row        /* linha de dado (ícone + label + valor) */
```

### Dark Mode

Sempre adicionar override dark mode para novas classes:

```css
[data-theme=dark] .minha-classe {
  background-color: var(--athens-gray-900);
  color: var(--mine-shaft-50);
  border-color: rgba(255,255,255,0.08);
}
```

Sempre testar no tema escuro ao criar novos componentes.

---

## Ícones (FontAwesome 6.4.0 Free)

- Usar sempre `fa-solid fa-[nome]` ou `fa-brands fa-[nome]`
- Chamar `hub.utils.normalizeIcon(icon, fallback)` ao exibir ícones do banco (pode vir incompleto)
- O admin tem autocomplete de ícones nos campos `sq-icone`, `cat-icone`, `fm-icone`, `lk-icone`
- Busca por termos em português via `ICON_PT_DICT` em `admin.js`
- Modal flutuante de referência de ícones (botão "Ícones" no header do Admin, z-index 1100)

---

## Convenções de IDs HTML

```
data-page="[nome]"     → atributo no <html> de cada página
#hub-nav               → container do sidebar (injetado por nav.render())
#app-view              → conteúdo principal (oculto até dados carregados)
#loader                → spinner de carregamento
#perfil-header-actions → área para botões no header do perfil
#edit-modal-overlay    → overlay genérico de edição (admin)
#confirm-modal-overlay → overlay de confirmação (admin)
#icones-modal-overlay  → modal flutuante de ícones (admin)
```

---

## Senioridade — Valores Válidos

```
'Gerente' | 'Coordenador' | 'Especialista' | 'Sênior' | 'Pleno' |
'Júnior' | 'Assistente' | 'Estagiário' | 'Jovem Aprendiz'
```

Visível no perfil apenas para o próprio usuário ou admin/coord.

---

## Cuidados Importantes

1. **Nunca usar `BASE_PATH` fora de `main.js`** — use `hub.config.basePath`
2. **Sempre usar `hub.utils.escapeHtml()`** em todo HTML gerado com dados do banco
3. **Bucket de storage chama-se `Avatars`** (A maiúsculo)
4. **`squad_members` filtra por `user_id`**, não `user_name`
5. **RLS do Supabase usa `TO anon`** — o app nunca autentica via JWT
6. **`is_gestor`** é a coluna atual (era `is_coordenador` até Fase 6)
7. **`link`** é a coluna atual (era `link_wrike` até Fase 5b)
8. **Limite de upload de avatar: 150 KB** (JPG/PNG)
9. **Bootstrap é v4.6.2** — não usar sintaxe do Bootstrap 5
10. **Sem async/await em alguns arquivos legados** — preferir `.then()` se encontrar inconsistência

---

## Fases Já Implementadas

| Fase | Descrição | Status |
|---|---|---|
| 1 | Correções gerais (botões, filtros, dark mode cards) | ✅ |
| 2 | Home: cards turquesa + coluna de aniversariantes | ✅ |
| 3 | Página de Perfil + avatar + sobre_mim + gostos_pessoais | ✅ |
| 4 | Modal de ícones no Admin + autocomplete + dicionário PT | ✅ |
| 5a | Tabelas admin: coluna Ações primeiro, botões compactos | ✅ |
| 5b | Squads: `link_wrike` → `link` + `link_label` | ✅ |
| 5c | Links: datalist de seções existentes | ✅ |
| 5x | Tabs redesign (underline + scroll arrows) + tabelas modernas | ✅ |
| 6 | `is_coordenador` → `is_gestor` + coluna `senioridade` | ✅ |
