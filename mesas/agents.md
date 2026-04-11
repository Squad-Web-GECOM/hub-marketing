# agents.md — Página Mesas

## 0) Governança obrigatória

- Qualquer alteração nesta área feita por IA deve obrigatoriamente:
  1. atualizar este `agents.md`;
  2. registrar mudança em `CHANGELOG.md`;
  3. atualizar `Agents.md` da raiz quando houver mudança de regra global.
- Não concluir tarefa com mudança de código sem refletir documentação e versionamento.


## 1) Objetivo da página

- Reserva de mesas por data com recomendação inteligente de posição.

## 2) Dependências

- HTML: `mesas/index.html`
- Scripts:
  - `../assets/js/main.js`
  - `../assets/js/mesas.js`
- CSS: `../assets/css/main.css`

## 3) Comportamento de acesso

- Página permite `view mode` sem login.
- Em `view mode`, usuário vê mapa e pode abrir login.
- Reserva só é permitida para usuário autenticado com perfil completo.

## 4) Estrutura principal

- Seletor de data: `#date-selector`
- Card de sugestão: `#suggestion-card` + `#suggestion-content`
- Mapa: `#desk-grid`
- Badge de disponibilidade: `#free-count-badge`

## 5) Fluxo principal (`assets/js/mesas.js`)

1. `loadDesks()` carrega mesas ativas.
2. `generateAvailableDates()` monta próximos dias úteis.
3. `loadReservations()` carrega reservas da data selecionada.
4. Render:
  - `renderDateSelector()`
  - `renderDesks()`
  - `updateFreeCount()`
  - `updateSuggestion()`

## 6) Regras de reserva

- `makeReservation(deskNumber)`:
  - valida autenticação, perfil completo e concorrência local (`isBooking`),
  - insere em `reservations`.
- `cancelReservation(...)`:
  - cancela reserva existente ou “libera” mesa fixa com registro cancelado `created_by = 'mesa_fixa'`.

## 7) Motor de sugestão

- Critérios de pontuação:
  - histórico pessoal de reservas,
  - proximidade com núcleo (+2),
  - proximidade com coordenação (+1),
  - desempate por menor número da mesa.
- Se já houver mesa atribuída ao usuário (fixa ou reservada), mostra card “Mesa Agendada”.

## 8) Extras técnicos

- `checkCheckinParam()` processa query `?checkin=` para marcar `checked_in_at`.
- `initDragScroll()` habilita arraste do grid.

## 9) CSS-chave

- Grid:
  - `#desk-grid`
- Estados de card:
  - `.desk-card.available`
  - `.desk-card.occupied`
  - `.desk-card.my-reservation`
- Sugestão:
  - `.hub-suggestion-card`
  - `.suggestion-my-reservation`
