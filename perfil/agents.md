# agents.md — Página Perfil

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Exibir perfil detalhado do usuário e permitir edição completa do próprio cadastro.

## 2) Dependências

- HTML: `perfil/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/perfil.js`
- CSS: `../assets/css/main.css`

## 3) Regras de acesso

- Requer autenticação e usuário de marketing.
- `?u=user_name`: abre perfil de outro usuário.
- Sem `?u`: abre perfil do usuário logado.
- `?edit=1`: abre modal de edição automaticamente (quando perfil próprio).

## 4) Estrutura da UI

- Bento grid:
  - `.perfil-bento-foto`
  - `.perfil-bento-org`
  - `.perfil-bento-sobre`
  - `.perfil-bento-dados`
  - `.perfil-bento-squads`
  - `.perfil-bento-gostos`
- Modal de edição:
  - `#perfil-edit-overlay`
  - campos `#edit-*`.

## 5) Fluxo do script (`assets/js/perfil.js`)

1. Carrega em paralelo:
  - `org_structure`,
  - usuário alvo em `users`.
2. Renderiza blocos do perfil:
  - identidade,
  - org,
  - aniversário/signo/idade,
  - contato/endereço,
  - sobre mim,
  - gostos,
  - squads (join em `squad_members`).
3. Se perfil próprio:
  - habilita botão de editar,
  - ativa upload de avatar.

## 6) Edição e persistência

- Salva em `users` com validação por perfil hierárquico:
  - gerente,
  - coordenador/gestor,
  - demais.
- Calcula `profile_complete` no cliente.
- Faz upload no bucket `Avatars` (com `upsert`).

## 7) Pontos de atenção

- Política documentada fala em 150 KB para avatar, mas no código atual a validação aceita 300 KB.
- Sempre manter `escapeHtml` em render dinâmico.
- Alterações de IDs no modal quebram fluxo do `savePerfilEdit`.

## 8) CSS-chave da página

- Avatar e identidade:
  - `.perfil-avatar*`
  - `.perfil-user-email-*`
- Informações:
  - `.perfil-info-row`
  - `.perfil-idade-badge`
- Gostos:
  - `.perfil-gostos-grid`
  - `.perfil-gosto-card`
  - `.perfil-gosto-tag`
