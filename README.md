# Hub Marketing — v1.0

Portal interno da equipe de Marketing do Sicoob. App estático multi-página, hospedado no GitHub Pages e embarcado no portal Liferay.

**Versão:** 1.0
**Data de lançamento:** 06/03/2026
**Status:** Produção

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Stack Técnica](#stack-técnica)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Páginas e Funcionalidades](#páginas-e-funcionalidades)
5. [Banco de Dados (Supabase)](#banco-de-dados-supabase)
6. [Autenticação e Controle de Acesso](#autenticação-e-controle-de-acesso)
7. [Módulo Compartilhado (`main.js`)](#módulo-compartilhado-mainjs)
8. [Identidade Visual](#identidade-visual)
9. [Integração Liferay](#integração-liferay)
10. [Build Script](#build-script)
11. [Como Rodar Localmente](#como-rodar-localmente)
12. [Convenções de Código](#convenções-de-código)
13. [Deploy](#deploy)

---

## Visão Geral

O Hub Marketing é um portal intranet estático criado para centralizar ferramentas, informações e funcionalidades da equipe de Marketing do Sicoob. Substituiu o sistema legado (v4.2 — `old/`) com uma arquitetura mais moderna, dados reais no Supabase e 7 páginas funcionais.

### Principais recursos

- **Home** — Dashboard com estatísticas, links rápidos e aniversariantes do mês
- **Mesas** — Reserva de mesas de trabalho com sugestão inteligente e reservas fixas
- **Squads** — Cards dos squads com membros, links e categorias
- **Formulários** — Atalhos para formulários externos da equipe
- **Usuários** — Diretório completo com filtros hierárquicos por organização
- **Perfil** — Página de perfil individual com avatar, sobre mim, gostos pessoais e bento grid
- **Admin** — SPA com 8 abas CRUD: Usuários, Squads, Categorias, Formulários, Links, Org, Mesas, Reservas

---

## Stack Técnica

| Tecnologia | Versão | Uso |
|---|---|---|
| HTML | 5 | Estrutura de todas as páginas |
| JavaScript | ES5 / IIFE | Toda a lógica client-side (sem módulos ES6) |
| Bootstrap | 4.6.2 | Layout, grid, componentes UI |
| jQuery | 3.6.0 | DOM, eventos |
| FontAwesome | 6.4.0 Free | Ícones (apenas `fa-solid` e `fa-brands`) |
| Supabase JS | v2 | Cliente de banco de dados (PostgreSQL + Storage) |
| Sicoob Styles | CDN | CSS de identidade visual do Sicoob |

**Sem build system.** Nenhum npm, webpack, TypeScript ou transpilação. Todos os scripts são carregados via CDN.

---

## Estrutura de Arquivos

```
hub-marketing/
├── index.html                  # Home (data-page="home")
├── admin/index.html            # Admin CRUD (data-page="admin")
├── perfil/index.html           # Perfil de usuário (data-page="perfil")
├── usuarios/index.html         # Diretório de usuários (data-page="usuarios")
├── squads/index.html           # Cards de squads (data-page="squads")
├── formularios/index.html      # Links para formulários (data-page="formularios")
├── mesas/index.html            # Reserva de mesas (data-page="mesas")
│
├── assets/
│   ├── css/
│   │   ├── main.css            # CSS compilado de todos os partials SCSS
│   │   └── main.css.map        # Source map
│   └── js/
│       ├── main.js             # Módulo compartilhado (hub.auth, hub.nav, hub.utils, hub.sb)
│       ├── home.js             # Dashboard, links rápidos, aniversariantes
│       ├── admin.js            # CRUD completo (8 tabs)
│       ├── perfil.js           # Perfil individual com edição
│       ├── usuarios.js         # Listagem pública com filtros
│       ├── squads.js           # Cards e membros de squads
│       ├── mesas.js            # Sistema de reservas
│       └── formularios.js      # Grid de formulários externos
│
├── src/scss/                   # Fonte de verdade dos estilos V1
│   ├── main.scss               # Entrypoint Sass (usa @use)
│   └── v1/
│       ├── _global.scss        # Agregador global V1
│       ├── _profile-gate.scss
│       ├── _squads.scss
│       ├── _birthdays.scss
│       ├── _perfil.scss
│       ├── _admin-icons.scss
│       └── global/
│           ├── _foundation-effects.scss
│           ├── _navigation.scss
│           ├── _components.scss
│           ├── _mesas-scrollbar.scss
│           ├── _dark-mode.scss
│           └── _expansion-standards.scss
│
├── js-liferay/                 # JS pré-compilado para uso no Liferay
│   ├── home.js                 # config + main.js + home.js
│   ├── admin.js                # config + main.js + admin.js
│   ├── perfil.js               # config + main.js + perfil.js
│   ├── usuarios.js             # config + main.js + usuarios.js
│   ├── squads.js               # config + main.js + squads.js
│   ├── mesas.js                # config + main.js + mesas.js
│   └── formularios.js          # config + main.js + formularios.js
│
├── build-liferay.sh            # Script que gera os arquivos em js-liferay/
├── claude.md                   # Documentação técnica para uso com IA
├── CHANGELOG.md                # Histórico de versões
├── README.md                   # Este arquivo
│
└── old/                        # Release histórica v4.2 (somente referência)
    ├── README-V4.md
    ├── agendamento-complete-v4.js
    └── style-v4.css
```

---

## Páginas e Funcionalidades

### Home (`/`)
- Cards de estatísticas: total de usuários, squads, mesas disponíveis hoje, reservas hoje
- Grid de links rápidos organizados por seção (gerenciados pelo Admin)
- Painel de aniversariantes do mês com destaques para o dia

### Mesas (`/mesas/`)
- Grade visual de mesas com zonas de trabalho
- Reserva por clique com picker de data
- Sugestão inteligente: propõe mesa próxima à coordenação do usuário
- Reservas fixas (indicadas visualmente, bloqueadas para novos agendamentos)
- Cancelamento de reserva própria
- Alerta de cadastro incompleto (redireciona para `/perfil/`)

### Squads (`/squads/`)
- Cards de squads agrupados por categoria
- Cada card exibe: nome, descrição, ícone, membros (avatar + apelido), link externo
- Filtros por categoria e busca por nome
- Membros filtrados pela coordenação/núcleo do usuário logado (quando disponível)

### Formulários (`/formularios/`)
- Grid de cards com atalhos para formulários externos (Google Forms, SharePoint etc.)
- Gerenciados via Admin (nome, URL, ícone, ordem)
- Acessível para usuários externos (sem exigir Marketing)

### Usuários (`/usuarios/`)
- Tabela completa de todos os usuários ativos
- Filtros: busca por texto, gerência, coordenação, núcleo, bairro, terceirizado
- Ordenação por coluna (nome, apelido, usuário, aniversário, bairro)
- Click no nome abre perfil completo (`/perfil/?u=user_name`)
- Modal de conclusão de cadastro (para usuário próprio com perfil incompleto)

### Perfil (`/perfil/?u=user_name`)
- Layout bento grid responsivo com múltiplos cards
- Avatar (upload JPG/PNG, máx. 150 KB, bucket Supabase `Avatars`)
- Informações: nome, apelido, usuário, e-mail, telefone, aniversário (com signo e idade)
- Estrutura organizacional: gerência, coordenação, núcleo
- Senioridade e flag terceirizado (visível para próprio usuário e admin/gestor)
- Sobre mim (texto livre, 500 caracteres)
- Gostos pessoais: livros, filmes/séries, comidas, hobbies, time do coração
- Endereço (logradouro, bairro, CEP)
- Squads do usuário exibidos como chips
- Edição completa via modal (seções: Dados Pessoais → Estrutura Org → Endereço → Sobre mim → Gostos)
- **Profile gate:** usuário com cadastro incompleto é bloqueado em certas páginas até concluir o perfil

### Admin (`/admin/`)
- Acesso restrito a `is_admin = true`
- SPA com 8 abas:
  1. **Usuários** — CRUD completo, ativar/desativar, criar novo usuário
  2. **Squads** — CRUD com ícones, links e gerenciamento de membros
  3. **Categorias** — Categorias de squads
  4. **Formulários** — Links para formulários externos
  5. **Links Rápidos** — Links da seção Home
  6. **Org Structure** — Gerências, coordenações e núcleos
  7. **Mesas** — Configuração de mesas (número, zona, reservas fixas)
  8. **Reservas** — Listagem e gestão de reservas de mesas
- Modal flutuante de referência de ícones FontAwesome (com busca em português)
- Autocomplete de ícones nos campos de formulário

---

## Banco de Dados (Supabase)

**URL:** `https://gcqitocopjdilxgupril.supabase.co`
**Acesso:** Chave anônima (`anon`) — sem autenticação JWT nativa
**Políticas RLS:** Todas as políticas usam `TO anon`

### Tabelas

| Tabela | Descrição |
|---|---|
| `users` | Usuários do hub com dados pessoais, org, avatar, gostos |
| `org_structure` | Gerências, coordenações e núcleos (hierarquia com `parent_id`) |
| `squads` | Squads com nome, descrição, ícone, link, categoria |
| `squad_members` | Membros de squads (`squad_id`, `user_id`) |
| `squad_categories` | Categorias de squads |
| `quick_links` | Links rápidos da Home |
| `forms` | Formulários externos |
| `desks` | Configuração de mesas (posição, zona, reserva fixa) |
| `reservations` | Reservas de mesas (`desk_id`, `user_id`, `date`) |

### Storage

| Bucket | Tipo | Uso |
|---|---|---|
| `Avatars` | Público | Avatares de usuários (JPG/PNG, máx. 150 KB) |

### Senioridades válidas

`Gerente` · `Coordenador` · `Especialista` · `Sênior` · `Pleno` · `Júnior` · `Assistente` · `Estagiário` · `Jovem Aprendiz`

### Regras de `profile_complete`

O campo `users.profile_complete` é recalculado a cada save do perfil conforme o nível hierárquico:

| Senioridade | Obrigatórios |
|---|---|
| **Gerente** | Nome + Apelido + Telefone + Aniversário + Senioridade |
| **Coordenador** (`is_gestor=true` ou senioridade) | + Gerência + Coordenação |
| **Demais** | + Gerência + Coordenação + Núcleo |

Campos nunca obrigatórios: endereço, bairro, CEP, avatar, sobre mim, gostos pessoais.

---

## Autenticação e Controle de Acesso

O app não usa o JWT nativo do Supabase. A autenticação é baseada em:

1. **SSO Liferay** — quando embutido no portal, o Liferay injeta o `user_name` do usuário logado via `window.Liferay` ou variável equivalente
2. **Código de acesso** — modal de login com campo `user_name` (sem senha), para uso fora do Liferay (ex: GitHub Pages direto)

### Papéis

| Papel | Condição | Acesso |
|---|---|---|
| **Admin** | `is_admin = true` | Todas as páginas + Admin CRUD |
| **Gestor** | `is_gestor = true` | Todas as páginas de Marketing |
| **Marketing** | `is_active = true` e não externo | Todas as páginas de Marketing |
| **Externo** | Usuário sem `@sicoob.com.br` | Somente `/formularios/` |

### Funções de guarda (em `main.js`)

```javascript
hub.auth.requireAuth()          // redireciona para login se não autenticado
hub.auth.requireMarketingUser() // redireciona externo para /formularios/
hub.auth.isAdmin()              // boolean
hub.auth.isAdminOrCoord()       // boolean (admin OU is_gestor)
```

---

## Módulo Compartilhado (`main.js`)

Carregado em todas as páginas antes do JS específico. Expõe o objeto global `window.hub`.

```javascript
hub.sb           // cliente Supabase (lazy getter)
hub.config       // { basePath: '' | '/hub-marketing' }
hub.auth         // autenticação e controle de acesso
hub.utils        // utilitários (escapeHtml, showToast, formatDate, etc.)
hub.nav          // renderização do sidebar
```

### Evento `hub:ready`

Disparado quando Supabase, auth, nav e dark mode estão inicializados:

```javascript
document.addEventListener('hub:ready', function(e) {
  // e.detail.user — usuário logado (ou null)
  init();
});
```

---

## Identidade Visual

### Cores principais

| Token | Valor | Uso |
|---|---|---|
| `--turq` | `#00ae9d` | Cor primária — botões, destaques, ativo |
| `--verdee` | `#003641` | Verde escuro — sidebar, títulos |
| `--verdem` | `#7db61c` | Verde lima — usuários externos |
| `--athens-gray-800` | `rgba(30,41,59,1)` | Cards dark mode |
| `--athens-gray-900` | `rgba(15,23,42,1)` | Background dark mode |
| `--mine-shaft-50` | `rgba(240,244,248,1)` | Texto principal dark mode |

### Dark Mode

Ativado via `[data-theme="dark"]` no `<html>`. Toggle persistido em `localStorage`. Todo componente novo deve incluir override:

```css
[data-theme=dark] .minha-classe {
  background-color: var(--athens-gray-900);
  color: var(--mine-shaft-50);
  border-color: rgba(255,255,255,0.08);
}
```

---

## Integração Liferay

O app é embarcado em páginas do portal Liferay. Hoje coexistem dois formatos de publicação:

1. **Legado (inline):** colar conteúdo de JS/CSS nas configurações da página.
2. **Recomendado (Documentos e Mídias):** publicar arquivos versionados e referenciar por URL.

> Observação: os imports de Bootstrap/jQuery/Sicoob Styles presentes nos HTML deste repositório existem para simular ambiente local. No Liferay, essas dependências já podem estar disponíveis globalmente.

### Configuração por página

Cada arquivo compilado começa com:

```javascript
// ─── Configuração desta página (ANTES de main.js) ───
window.HUB_PAGE = 'home'; // nome da página atual
window.HUB_PAGES = {
  home:        '/web/mkt/home',
  mesas:       '/web/mkt/mesas',
  squads:      '/web/mkt/squads',
  formularios: '/web/mkt/formularios',
  usuarios:    '/web/mkt/usuarios',
  admin:       '/web/mkt/admin',
  perfil:      '/web/mkt/perfil'
};
```

Os arquivos prontos para uso em Liferay ficam em `js-liferay/`.

### Estratégia recomendada (Documentos e Mídias)

1. Publicar `main.css` e os JS (`main.js` + `[page].js` ou bundle `js-liferay/[page].js`) em **Documentos e Mídias**.
2. Usar URL versionada dos arquivos nas configurações da página.
3. No Conteúdo Web, manter apenas o HTML do `<body>` (sem tags `<script>` locais).
4. Atualizar versão dos arquivos publicados a cada release e registrar no `CHANGELOG.md`.

---

## Build Script

O script `build-liferay.sh` gera automaticamente os 7 arquivos em `js-liferay/` concatenando:
**[config de página] + main.js + [page].js**

### Como usar

```bash
# Na raiz do projeto (hub-marketing/)
./build-liferay.sh
```

Deve ser executado sempre que `main.js` ou qualquer `[page].js` for alterado.

### Saída esperada

```
=== Build Liferay JS ===
[OK] js-liferay/home.js        (1689 linhas)
[OK] js-liferay/admin.js       (3204 linhas)
[OK] js-liferay/perfil.js      (1954 linhas)
[OK] js-liferay/usuarios.js    (1847 linhas)
[OK] js-liferay/squads.js      (1724 linhas)
[OK] js-liferay/mesas.js       (2023 linhas)
[OK] js-liferay/formularios.js (1353 linhas)
```

---

## Como Rodar Localmente

Como o projeto não tem build system, basta servir os arquivos estáticos:

```bash
# Python (recomendado)
cd hub-marketing/
python3 -m http.server 8080
# → http://localhost:8080

# Node.js (se disponível)
npx serve .
```

> ⚠️ Não abrir `index.html` diretamente no browser (`file://`) — o Supabase e as rotas relativas não funcionarão corretamente sem um servidor HTTP.

---

## Convenções de Código

### Padrão de módulo (IIFE)

```javascript
(function() {
  'use strict';

  document.addEventListener('hub:ready', function() {
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;
    init();
  });

  async function init() { /* ... */ }
})();
```

### Regras

- **Nenhum `import`/`export`** — projeto ES5 puro
- **Sempre `hub.utils.escapeHtml()`** em todo HTML gerado com dados do banco (previne XSS)
- **`hub.config.basePath`** para caminhos relativos (nunca a variável `BASE_PATH` local de `main.js`)
- **Bucket `Avatars`** com A maiúsculo — obrigatório
- **`squad_members` filtra por `user_id`**, nunca por `user_name`
- **Bootstrap 4.6.2** — não usar sintaxe do Bootstrap 5
- **Ícones:** sempre `fa-solid fa-[nome]` ou `fa-brands fa-[nome]`; chamar `hub.utils.normalizeIcon()` ao exibir ícones vindos do banco

---

## Deploy

O projeto é hospedado em dois ambientes:

| Ambiente | URL | Como atualizar |
|---|---|---|
| GitHub Pages | `https://squad-web-gecom.github.io/hub-marketing/` | Push para branch `main` |
| Liferay | Portal interno Sicoob | Preferencialmente publicar JS/CSS em Documentos e Mídias e referenciar por URL (fallback: colagem inline de `js-liferay/[page].js`) |
