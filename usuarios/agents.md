# agents.md — Página Usuários

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Exibir diretório completo de usuários ativos com filtros e ordenação.

## 2) Dependências

- HTML: `usuarios/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/usuarios.js`
- CSS: `../assets/css/main.css`

## 3) Regras de acesso

- Requer autenticação e usuário de marketing.
- Exibe banner para usuário logado com perfil incompleto.

## 4) Estrutura da UI

- Filtros:
  - `#filter-search`
  - `#filter-gerencia`
  - `#filter-coordenacao`
  - `#filter-nucleo`
  - `#filter-bairro`
- Tabela:
  - `#users-tbody`
- Ações:
  - `#btn-copy-emails`
  - `#btn-complete-profile`
- Modal de perfil:
  - `#profile-modal-overlay`
  - campos `#profile-*`.

## 5) Fluxo do script (`assets/js/usuarios.js`)

1. Carrega `users` + `org_structure`.
2. Popula filtros dependentes (gerência > coordenação > núcleo).
3. Aplica filtros e ordenação em memória.
4. Renderiza tabela e contador de resultados.
5. Exibe banner de perfil incompleto quando aplicável.
6. Permite completar/editar perfil via modal interno.

## 6) Ordenação e filtros

- Colunas com `data-sort` alteram `sortColumn` e `sortAsc`.
- Busca considera nome, apelido, `user_name`, email e bairro.
- Filtro por bairro é extraído dinamicamente da base carregada.

## 7) Modal de perfil (desta página)

- Salva campos pessoais, org, endereço, sobre mim e gostos.
- Recalcula `profile_complete`.
- Limpa cache local de auth e recarrega página para refletir sidebar e sessão.

## 8) CSS-chave

- Barra de filtros:
  - `.hub-filter-bar`
  - `.hub-filter-group`
  - `.hub-search-box`
- Tabela:
  - `.hub-table`
  - `.td-truncate`
- Banner:
  - `#profile-banner`

## 9) Pontos de atenção

- Link para perfil na tabela hoje inclui trecho `/web/mkt/perfil/?u=...`.
- Se mudar padrão de rotas, revisar geração de link.
- Todos os conteúdos dinâmicos devem continuar escapados com `hub.utils.escapeHtml`.
