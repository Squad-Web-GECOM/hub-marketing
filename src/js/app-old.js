(function($) {
  'use strict';

  // CONFIG
  const SUPABASE_URL = 'https://gcqitocopjdilxgupril.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWl0b2NvcGpkaWx4Z3VwcmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODM5MTEsImV4cCI6MjA3MTk1OTkxMX0.GTqh--djGKQfCgCnlpRNNx75KMEXNImSPcs8OQ7K5gc';

  // DOM
  const loader = $('#loader');
  const appView = $('#app-view');
  const userNameDisplay = $('#user-name');
  const dateSelector = $('#date-selector');
  const selectedDateDisplay = $('#selected-date-display');
  const deskGrid = $('#desk-grid');
  const alertContainer = $('#alert-container');

  // Estado
  let currentUser = null;
  let selectedDate = '';
  let desks = [];
  let reservations = [];
  let availableDates = [];
  let sb = null; // cliente Supabase

  // Inicialização
  $(document).ready(() => {
    appView.hide();
    showLoader(true);
    init();
  });

  async function init() {
    try {
      await ensureSupabase();
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('SDK do Supabase não disponível');
      }
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      identifyUserFromLiferay();
      if (!currentUser) {
        showAlert('Não foi possível identificar o usuário no Liferay.', 'danger');
        showLoader(false);
        return;
      }

      userNameDisplay.text(currentUser.name);

      generateAvailableDates();
      await loadDesks();
      await loadReservations();

      renderPage();

      appView.show();
      showLoader(false);
    } catch (err) {
      console.error(err);
      showAlert('Falha ao iniciar a aplicação. Verifique o carregamento do Supabase e o ThemeDisplay.', 'danger');
      showLoader(false);
    }
  }

  // Garante o SDK do Supabase
  async function ensureSupabase() {
    if (window.supabase?.createClient) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar o script do Supabase'));
      document.head.appendChild(s);
    });
  }

  // Identificação via Liferay
  function identifyUserFromLiferay() {
    try {
      const isSignedIn = Liferay?.ThemeDisplay?.isSignedIn?.();
      if (!isSignedIn) {
        currentUser = null;
        return;
      }
      const email = Liferay?.ThemeDisplay?.getUserEmailAddress?.() || '';
      const localPart = email && email.includes('@') ? email.split('@')[0] : '';
      if (!email || !localPart) {
        currentUser = null;
        return;
      }
      currentUser = { id: email, name: localPart, email };
    } catch (e) {
      console.error('ThemeDisplay indisponível', e);
      currentUser = null;
    }
  }

  // Renderização
  function renderPage() {
    renderDateSelector();
    renderDesks();
  }

  // NOVO seletor de datas
  function renderDateSelector() {
    selectedDateDisplay.text(formatDate(selectedDate));

    const datesHtml = availableDates.map(date => {
      const active = selectedDate === date ? 'active' : '';
      const top = formatDateShort(date); // DD/MM
      const bottom = isToday(date) ? 'Hoje' : getWeekdayLabel(date); // Hoje ou dia da semana
      return `
        <button class="btn btn-secondary date-selector-btn ${active}" data-date="${date}">
          <div class="d-flex flex-column align-items-center lh-1">
            <span class="fw-semibold">${top}</span>
            <small class="text-muted">${bottom}</small>
          </div>
        </button>
      `;
    }).join('');

    dateSelector.html(datesHtml);
    $('.date-selector-btn').on('click', handleDateSelect);
  }

  function renderDesks() {
    deskGrid.html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="visually-hidden">Carregando...</span></div></div>');
    if (desks.length === 0) {
      deskGrid.html('<p class="text-center text-muted">Nenhuma mesa ativa encontrada.</p>');
      return;
    }

    const userReservation = reservations.find(r => r.user_id === currentUser.id);

    const desksHtml = desks.map(desk => {
      const reservation = reservations.find(r => r.desk_number === desk.number);
      const isOccupied = !!reservation;
      const isMyReservation = isOccupied && reservation.user_id === currentUser.id;
      const canBook = !isOccupied && !userReservation;

      let cardClass = 'available';
      let statusText = 'Livre';
      let buttonHtml = '';

      if (isMyReservation) {
        cardClass = 'my-reservation';
        statusText = '<span class="reserved">Minha Reserva<span>';
        buttonHtml = `<button class="btn btn-sm btn-danger cancel-reservation-btn" data-reservation-id="${reservation.id}">Cancelar</button>`;
      } else if (isOccupied) {
        cardClass = 'occupied';
        statusText = `<span class="reserved">${reservation.user_name}<span>`;
        buttonHtml = '<button class="btn btn-sm btn-dark" disabled>Ocupada</button>';
      } else if (canBook) {
        buttonHtml = `<button class="btn btn-sm btn-primary make-reservation-btn" data-desk-number="${desk.number}">Reservar</button>`;
      } else {
        cardClass = 'occupied';
        buttonHtml = '<button class="btn btn-sm btn-dark" disabled>Indisponível</button>';
      }

      return `
        <div class="col-xl-3 col-lg-4 col-md-6 col-sm-12">
          <div class="card h-100 desk-card ${cardClass}">
            <div class="card-body">
              <h5 class="card-title">${getDeskName(desk.number)}</h5>
              <p class="card-text">${statusText}</p>
              ${buttonHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    deskGrid.html(`<div class="row gap-row-4">${desksHtml}</div>`);
    $('.make-reservation-btn').on('click', handleMakeReservation);
    $('.cancel-reservation-btn').on('click', handleCancelReservation);
  }

  // Eventos
  function handleDateSelect(e) {
    const $btn = $(e.currentTarget);
    selectedDate = $btn.data('date');

    // ativa o botão clicado e desativa os demais
    $('.date-selector-btn').removeClass('active');
    $btn.addClass('active');

    // atualiza o cabeçalho
    selectedDateDisplay.text(formatDate(selectedDate));

    // carrega reservas e reexibe as mesas
    deskGrid.html('<div class="d-flex justify-content-center"><div class="spinner-border" role="status"><span class="visualmente-hidden">&nbsp;</span></div></div>');
    loadReservations().then(renderDesks);
  }

  async function handleMakeReservation(e) {
    const deskNumber = $(e.currentTarget).data('desk-number');
    await makeReservation(deskNumber);
  }

  async function handleCancelReservation(e) {
    const reservationId = $(e.currentTarget).data('reservation-id');
    await cancelReservation(reservationId);
  }

  // Supabase
  async function loadDesks() {
    try {
      const { data, error } = await sb
        .from('desks')
        .select('*')
        .eq('is_active', true)
        .order('number');
      if (error) throw error;
      desks = data || [];
    } catch (error) {
      console.error('Erro ao carregar mesas', error);
      showAlert('Não foi possível carregar as mesas.', 'danger');
    }
  }

  async function loadReservations() {
    try {
      const { data, error } = await sb
        .from('reservations')
        .select('*')
        .eq('date', selectedDate)
        .is('canceled_at', null);
      if (error) throw error;
      reservations = data || [];
    } catch (error) {
      console.error('Erro ao carregar reservas', error);
      showAlert('Não foi possível carregar as reservas.', 'danger');
    }
  }

  async function makeReservation(deskNumber) {
    try {
      const payload = {
        date: selectedDate,
        desk_number: deskNumber,
        user_id: currentUser.id,
        user_name: currentUser.name
      };
      const { error } = await sb.from('reservations').insert(payload);
      if (error) {
        if (error.message && error.message.includes('reservations_date_user_id_key')) {
          showAlert('Você já possui uma reserva para este dia.', 'warning');
        } else {
          showAlert('Esta mesa já foi reservada. Atualize a página.', 'warning');
        }
        throw error;
      }
      showAlert(`Reserva confirmada na ${getDeskName(deskNumber)} para ${formatDate(selectedDate)}.`, 'success');
      await loadReservations();
      renderDesks();
    } catch (error) {
      console.error('Erro ao reservar', error);
    }
  }

  async function cancelReservation(reservationId) {
    try {
      const { error } = await sb
        .from('reservations')
        .update({ canceled_at: new Date().toISOString(), canceled_by: currentUser.id })
        .eq('id', reservationId)
        .eq('user_id', currentUser.id);
      if (error) throw error;
      showAlert('Reserva cancelada com sucesso.', 'success');
      await loadReservations();
      renderDesks();
    } catch (error) {
      console.error('Erro ao cancelar', error);
      showAlert('Não foi possível cancelar a reserva.', 'danger');
    }
  }

  // Helpers
  function showLoader(visible) {
    if (visible) loader.show(); else loader.hide();
  }

  // Bootstrap 4 toasts com visual de alert e autohide em 3s
function showAlert(message, type = 'info') {
  const container = getToastContainer();

  const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const html = `
    <div id="${id}" class="toast alert alert-${type} border-0"
         role="alert" aria-live="assertive" aria-atomic="true"
         data-autohide="true" data-delay="3000">
      <div class="toast-body d-flex align-items-center">
        <div class="flex-fill">${message}</div>
        <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', html);
  const $el = $(`#${id}`);
  $el.toast({ autohide: true, delay: 3000 });
  $el.toast('show');
  $el.on('hidden.bs.toast', function() { $(this).remove(); });
}

function getToastContainer() {
  let container = document.getElementById('toast-stack');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-stack';
    // posição no canto superior direito
    container.style.position = 'fixed';
    container.style.bottom = '1rem';
    container.style.right = '1rem';
    container.style.zIndex = 1080;
    // empilhar com espaçamento
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '.5rem';
    document.body.appendChild(container);
  }
  return container;
}

  function generateAvailableDates() {
    const dates = [];
    const today = new Date();
    let daysAdded = 0;
    let i = 0;

    while (daysAdded < 6 && i < 14) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dateString = date.toISOString().split('T')[0];
        dates.push(dateString);
        daysAdded++;
      }
      i++;
    }
    availableDates = dates;
    if (dates.length > 0 && !selectedDate) {
      selectedDate = dates[0];
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  // NOVOS helpers para o seletor
  function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  }

  function getWeekdayLabel(dateStr) {
    const d = new Date(dateStr);
    const idx = d.getUTCDay();
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return names[idx];
  }

  function isToday(dateStr) {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr === todayStr;
  }

function getDeskName(deskNumber) {
    if (deskNumber >= 1 && deskNumber <= 3) return `Mesa A${deskNumber}`;
    if (deskNumber >= 4 && deskNumber <= 7) return `Mesa B${deskNumber - 3}`;
    if (deskNumber >= 8 && deskNumber <= 12) return `Mesa C${deskNumber - 7}`;
    if (deskNumber >= 13 && deskNumber <= 18) return `Mesa D${deskNumber - 12}`;
    if (deskNumber >= 19 && deskNumber <= 21) return `Mesa E${deskNumber - 18}`;
    if (deskNumber >= 22 && deskNumber <= 23) return `Mesa F${deskNumber - 21}`;
    if (deskNumber >= 24 && deskNumber <= 24) return `Mesa G${deskNumber - 23}`;
    return `Mesa ${deskNumber}`;
  }

})(jQuery);