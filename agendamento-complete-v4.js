/**
 * AGENDAMENTO DE MESAS - SISTEMA COMPLETO v4.2
 * Arquivo único consolidado com todas as funcionalidades
 * 
 * Correções v4.2:
 * - Grid columns e rows usando dados do banco (grid_col, grid_row, col_span, row_span)
 * - Botão Sair e labels Admin/Externo restaurados
 * - Remoção de @sicoob.com.br também na tabela de registros
 * - Lógica v4 mantida, apenas ID usa modelo v1 (sem enviar)
 * 
 * Compatibilidade: Liferay 7.0.1 Community Edition
 * Versão: 4.2
 * Data: 08/01/2026
 */

(function($) {
  'use strict';

  // ============================================================================
  // CONFIGURAÇÃO
  // ============================================================================
  const CONFIG = {
    URL: 'https://gcqitocopjdilxgupril.supabase.co',
    KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWl0b2NvcGpkaWx4Z3VwcmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODM5MTEsImV4cCI6MjA3MTk1OTkxMX0.GTqh--djGKQfCgCnlpRNNx75KMEXNImSPcs8OQ7K5gc',
    ADMINS: [
      'anac.ferreira', 'raquel.frois', 'fagner.carvalho',
      'gustavoh.carvalho', 'kelly.valente', 'simara.borges',
      'daniela.marques', 'karen.lacerda', 'priscilla.rezende',
      'katia.bodur', 'joao.vidal'
    ],
    TABLE_DESKS: 'desks_2026',
    TABLE_RESERVATIONS: 'reservations_2026'
  };

  const CACHED_USER_KEY = 'agendamento_cached_user';
  const CACHED_ROLE_KEY = 'agendamento_cached_role';
  const CACHED_SOURCE_KEY = 'agendamento_cached_source';
  
  const ACCESS_CODES = {
    ADMIN: 'MKTadmin',
    EXTERNAL: 'MKTexterno'
  };
  
  const ADMIN_USERS = CONFIG.ADMINS;
  
  const EXTERNAL_USERS = [
    'guilherme.duarte', 'lara.pacheco', 'jonathan.araujo',
    'fabiola.souza', 'guilherme.rezende', 'pedrov.rodrigues'
  ];

  // ============================================================================
  // ESTADO DA APLICAÇÃO
  // ============================================================================
  let state = {
    currentUser: null,
    isAdmin: false,
    isViewMode: false,
    selectedDate: '',
    desks: [],
    reservations: [],
    allReservations: [],
    availableDates: [],
    sb: null,
    currentView: 'reserves',
    filters: {
      date: '',
      desk: '',
      createdBy: '',
      canceledBy: ''
    }
  };

  let modalState = {
    currentStep: 'choice',
    currentUsername: '',
    currentType: ''
  };

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================
  async function init() {
    $('#loader').show();
    $('#app-view').hide();

    try {
      await ensureSupabase();
      state.sb = window.supabase.createClient(CONFIG.URL, CONFIG.KEY);

      console.info('✅ Supabase inicializado');
      console.info('👤 Usuário:', state.currentUser);

      await loadDesks();
      generateAvailableDates();
      await refreshData();

      setupUI();
      renderPage();
      await checkCheckinParam();

      $('#app-view').fadeIn(300);
      $('#loader').hide();

    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      showAlert('Falha ao iniciar aplicação. Verifique sua conexão.', 'danger');
      $('#loader').hide();
    }
  }

  async function ensureSupabase() {
    if (window.supabase?.createClient) return;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar SDK Supabase'));
      document.head.appendChild(script);
    });
  }

  // ============================================================================
  // CARREGAMENTO DE DADOS
  // ============================================================================
  async function loadDesks() {
    try {
      const { data, error } = await state.sb
        .from(CONFIG.TABLE_DESKS)
        .select('*')
        .eq('is_active', true)
        .order('number');

      if (error) throw error;
      state.desks = data || [];
      console.info(`📋 ${state.desks.length} mesas carregadas`);

    } catch (error) {
      console.error('❌ Erro ao carregar mesas:', error);
      showAlert('Não foi possível carregar as mesas.', 'danger');
    }
  }

  async function loadReservations() {
    try {
      // Carregar TODAS as reservas do dia (incluindo canceladas)
      // Precisamos das canceladas para verificar se mesa fixa foi liberada
      const { data, error } = await state.sb
        .from(CONFIG.TABLE_RESERVATIONS)
        .select('*')
        .eq('date', state.selectedDate);

      if (error) throw error;
      state.reservations = data || [];

    } catch (error) {
      console.error('❌ Erro ao carregar reservas:', error);
      showAlert('Não foi possível carregar as reservas.', 'danger');
    }
  }

  async function loadAllReservations() {
    if (!state.isAdmin) return;

    try {
      const { data, error } = await state.sb
        .from(CONFIG.TABLE_RESERVATIONS)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      state.allReservations = data || [];
      console.info(`📊 ${state.allReservations.length} registros carregados`);

    } catch (error) {
      console.error('❌ Erro ao carregar todos os registros:', error);
    }
  }

  async function refreshData() {
    await loadReservations();
    await loadAllReservations();
  }

  // ============================================================================
  // CONFIGURAÇÃO DA INTERFACE
  // ============================================================================
  function setupUI() {
    // Informações do usuário
    const roleLabels = {
      'admin': ' <span style="color: #00AE9D; font-weight: 600;">(Admin)</span>',
      'user': '',
      'external': ' <span style="color: #7db61c; font-weight: 600;">(Externo)</span>'
    };

    const roleLabel = roleLabels[state.currentUser.role] || '';
    $('#user-name').text(state.currentUser.name);
    $('#user-role-label').html(roleLabel);
    $('#user-logged-container').show();

    // Botão de Sair
    if (!state.isViewMode) {
      const logoutBtn = `
        <button id="logout-btn-app" class="btn btn-sm btn-outline-danger ml-3" style="padding: .25rem .75rem; font-size: .875rem;">
          Sair
        </button>
      `;
      $('#user-logged-container').append(logoutBtn);
      $('#logout-btn-app').on('click', handleLogout);
    }

    // Botão de login (modo visualização)
    if (state.isViewMode) {
      $('#open-login-btn').show();
    }

    // Tabs de admin
    if (state.isAdmin) {
      $('.admin').show();
      
      $('#btn-reserves').off('click').on('click', () => {
        state.currentView = 'reserves';
        $('#btn-reserves').removeClass('btn-secondary').addClass('btn-primary');
        $('#btn-registers').removeClass('btn-primary').addClass('btn-secondary');
        renderPage();
      });

      $('#btn-registers').off('click').on('click', () => {
        state.currentView = 'registers';
        $('#btn-registers').removeClass('btn-secondary').addClass('btn-primary');
        $('#btn-reserves').removeClass('btn-primary').addClass('btn-secondary');
        renderPage();
      });
    }
  }

  function handleLogout() {
    localStorage.removeItem(CACHED_USER_KEY);
    localStorage.removeItem(CACHED_ROLE_KEY);
    localStorage.removeItem(CACHED_SOURCE_KEY);
    location.reload();
  }

  // ============================================================================
  // RENDERIZAÇÃO PRINCIPAL
  // ============================================================================
  function renderPage() {
    if (state.currentView === 'reserves') {
      renderReservesView();
    } else {
      renderRegistersView();
    }
  }

  function renderReservesView() {
    renderDateSelector();
    renderDesks();
    updateAvailableDesksCount();
    
    // Atualizar ícone e título para Reservas
    $('.card:has(#date-selector) .card-header').html(`
      <span style="font-size: 2rem;">📅</span>
      <h5 class="m-0">Selecionar Data</h5>
    `);
    
    $('.card:has(#desk-grid) .card-header').html(`
      <span style="font-size: 2rem;">📍</span>
      <h5 class="m-0">
        <span id="number-desks" class="bg-dark c-light px-1 py-0 border-radius-1"></span> 
        Mesas Disponíveis - <span id="selected-date-display" class="c-dark fw-800"></span>
      </h5>
    `);
    
    // Atualizar a data depois de criar os elementos
    $('#selected-date-display').text(formatDate(state.selectedDate));
    updateAvailableDesksCount();
  }

  function renderRegistersView() {
    renderFilters();
    renderLogsTable();
    
    // Atualizar ícone e título para Registros
    $('.card:has(#date-selector) .card-header').html(`
      <span style="font-size: 2rem;">🔍</span>
      <h5 class="m-0">Filtros de registros</h5>
    `);
    
    $('.card:has(#desk-grid) .card-header').html(`
      <span style="font-size: 2rem;">📊</span>
      <h5 class="m-0">Agendamentos e cancelamentos</h5>
    `);
  }

  // ============================================================================
  // SELETOR DE DATAS
  // ============================================================================
  function renderDateSelector() {
    $('#selected-date-display').text(formatDate(state.selectedDate));

    const html = state.availableDates.map(date => {
      const active = state.selectedDate === date ? 'active' : '';
      return `
        <button class="btn btn-secondary date-selector-btn ${active}" data-date="${date}">
          <div class="d-flex flex-column align-items-center lh-1">
            <span class="fw-semibold">${formatDateShort(date)}</span>
            <small class="${state.selectedDate === date ? 'text-white' : 'text-muted'}">
              ${isToday(date) ? 'Hoje' : getWeekdayLabel(date)}
            </small>
          </div>
        </button>`;
    }).join('');

    $('#date-selector').html(html);
    $('.date-selector-btn').off('click').on('click', handleDateSelect);
  }

  // ============================================================================
  // GRID DE MESAS
  // ============================================================================
  function renderDesks() {
    const $grid = $('#desk-grid');
    $grid.html('<div class="d-flex justify-content-center py-4"><div class="spinner-border text-primary" role="status"></div></div>');

    if (state.desks.length === 0) {
      $grid.html('<p class="text-center text-muted py-4">Nenhuma mesa ativa encontrada.</p>');
      return;
    }

    const hasResToday = state.reservations.some(r => 
      r.user_id === state.currentUser.id && !r.canceled_at
    );

    const html = state.desks.map(desk => {
      // Verificar se existe reserva ativa (não cancelada) para esta mesa
      const realRes = state.reservations.find(r => 
        r.desk == desk.name && !r.canceled_at
      );
      
      // Verificar se a mesa fixa foi liberada (tem registro cancelado)
      const wasFreed = state.reservations.find(r => 
        r.desk == desk.name && r.canceled_at && r.user_id === 'mesa_fixa'
      );

      let displayRes = null;
      let isOccupied = false;

      if (realRes) {
        // Tem reserva ativa
        displayRes = realRes;
        isOccupied = true;
      } else if (desk.fixed_reserve && !wasFreed) {
        // Mesa fixa que NÃO foi liberada
        displayRes = {
          user_name: desk.fixed_reserve.split('@')[0],
          user_id: desk.fixed_reserve,
          is_virtual: true
        };
        isOccupied = true;
      }
      // Se wasFreed é true OU não tem fixed_reserve, a mesa está livre

      const isMyRes = displayRes?.user_id === state.currentUser?.id;
      const canBook = !isOccupied && !state.isViewMode && (state.isAdmin || !hasResToday);

      let cardClass = isOccupied ? (isMyRes ? 'my-reservation' : 'occupied') : 'available';
      let statusText = isOccupied ? displayRes.user_name : 'Livre';
      let btnHtml = '';

      if (!state.isViewMode) {
        if (isOccupied) {
          if (state.isAdmin || isMyRes) {
            btnHtml = `<button class="btn btn-sm btn-danger cancel-btn" 
                        data-num="${desk.number}" 
                        data-res-id="${displayRes.id || ''}">Liberar</button>`;
          }
        } else if (canBook) {
          btnHtml = `<button class="btn btn-sm btn-primary book-btn" 
                      data-num="${desk.number}">Reservar</button>`;
        }
      }

      // Ajustar grid_row considerando os corredores
      let actualGridRow = desk.grid_row;
      
      if (desk.grid_row >= 3 && desk.grid_row <= 4) {
        actualGridRow = desk.grid_row + 1;
      } else if (desk.grid_row >= 5 && desk.grid_row <= 6) {
        actualGridRow = desk.grid_row + 2;
      } else if (desk.grid_row >= 7) {
        actualGridRow = desk.grid_row + 3;
      }

      const style = `
        grid-row: ${actualGridRow}; 
        grid-column: ${desk.grid_col}; 
        grid-row-end: span ${desk.row_span || 1}; 
        grid-column-end: span ${desk.col_span || 1};
      `;

      return `
        <div class="card desk-card ${cardClass}" style="${style}">
          <div class="card-body p-2 d-flex flex-column justify-content-between text-center">
            <h6 class="card-title mb-1">${desk.name}</h6>
            <span class="reserved-name small text-truncate">${statusText}</span>
            ${btnHtml}
          </div>
        </div>`;
    }).join('');

    $grid.html(html);

    if (!state.isViewMode) {
      $('.book-btn').off('click').on('click', function() {
        makeReservation($(this).data('num'));
      });
      $('.cancel-btn').off('click').on('click', function() {
        cancelReservation($(this).data('num'), $(this).data('res-id'));
      });
    }

    initDragScroll();
  }

  // ============================================================================
  // FILTROS (SEÇÃO DE LOGS)
  // ============================================================================
  function renderFilters() {
    const dates = [...new Set(state.allReservations.map(r => r.date))].sort();
    
    const deskNames = [...new Set(state.allReservations.map(r => r.desk).filter(Boolean))].sort();
    
    // Filtrar apenas usuários que realmente criaram reservas
    const creators = [...new Set(
      state.allReservations
        .map(r => r.user_name)
        .filter(Boolean)
    )].sort();
    
    // Filtrar apenas usuários que realmente cancelaram reservas
    const cancelers = [...new Set(
      state.allReservations
        .filter(r => r.canceled_by)
        .map(r => r.canceled_by)
    )].sort();

    // Função para limpar email
    const cleanEmail = (email) => {
      if (!email) return email;
      return email.replace('@sicoob.com.br', '');
    };

    // Data de hoje para filtro inicial
    const today = new Date().toISOString().split('T')[0];
    const initialDate = dates.includes(today) ? today : '';
    
    // Definir filtro inicial se ainda não definido
    if (!state.filters.date && initialDate) {
      state.filters.date = initialDate;
    }

    const html = `
      <div class="row g-3">
        <div class="col-md-3">
          <label class="form-label">Dia da reserva</label>
          <select class="form-select" id="filter-date">
            <option value="">Todas</option>
            ${dates.map(d => `<option value="${d}" ${d === state.filters.date ? 'selected' : ''}>${formatDate(d)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Mesa</label>
          <select class="form-select" id="filter-desk">
            <option value="">Todas</option>
            ${deskNames.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Criado por</label>
          <select class="form-select" id="filter-created">
            <option value="">Todos</option>
            ${creators.map(c => `<option value="${c}">${cleanEmail(c)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Cancelado por</label>
          <select class="form-select" id="filter-canceled">
            <option value="">Todos</option>
            ${cancelers.map(c => `<option value="${c}">${cleanEmail(c)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    $('#date-selector').html(html);

    $('#filter-date').on('change', function() {
      state.filters.date = $(this).val();
      renderLogsTable();
    });
    $('#filter-desk').on('change', function() {
      state.filters.desk = $(this).val();
      renderLogsTable();
    });
    $('#filter-created').on('change', function() {
      state.filters.createdBy = $(this).val();
      renderLogsTable();
    });
    $('#filter-canceled').on('change', function() {
      state.filters.canceledBy = $(this).val();
      renderLogsTable();
    });
  }

  // ============================================================================
  // TABELA DE LOGS
  // ============================================================================
  function renderLogsTable() {
    let filtered = state.allReservations;

    if (state.filters.date) {
      filtered = filtered.filter(r => r.date === state.filters.date);
    }
    if (state.filters.desk) {
      filtered = filtered.filter(r => r.desk === state.filters.desk);
    }
    if (state.filters.createdBy) {
      filtered = filtered.filter(r => r.user_name === state.filters.createdBy);
    }
    if (state.filters.canceledBy) {
      filtered = filtered.filter(r => r.canceled_by === state.filters.canceledBy);
    }

    // Função para limpar email
    const cleanEmail = (email) => {
      if (!email) return '-';
      return email.replace('@sicoob.com.br', '');
    };

    const html = `
      <table class="table table-striped table-hover align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Dia da reserva</th>
            <th>Mesa</th>
            <th>Criado por</th>
            <th>Criado em</th>
            <th>Cancelado por</th>
            <th>Cancelado em</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="6" class="text-center text-muted py-4">
                Nenhum registro encontrado
              </td>
            </tr>
          ` : filtered.map(r => {
            return `
              <tr>
                <td>${formatDate(r.date)}</td>
                <td><span class="badge bg-primary">${r.desk || '-'}</span></td>
                <td>${cleanEmail(r.user_name)}</td>
                <td><small class="text-muted">${formatDateTime(r.created_at)}</small></td>
                <td>${cleanEmail(r.canceled_by)}</td>
                <td><small class="text-muted">${r.canceled_at ? formatDateTime(r.canceled_at) : '-'}</small></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    $('#desk-grid').html(html);
  }

  // ============================================================================
  // CONTADOR DE MESAS DISPONÍVEIS
  // ============================================================================
  function updateAvailableDesksCount() {
    const activeReservations = state.reservations.filter(r => !r.canceled_at);
    const occupiedDesks = new Set();

    // Adicionar mesas com reservas ativas
    activeReservations.forEach(r => {
      occupiedDesks.add(r.desk);
    });

    // Adicionar mesas fixas que NÃO foram liberadas
    state.desks.forEach(desk => {
      if (desk.fixed_reserve) {
        const wasFreed = state.reservations.find(r => 
          r.desk == desk.name && r.canceled_at && r.user_id === 'mesa_fixa'
        );
        // Só conta como ocupada se NÃO foi liberada
        if (!wasFreed) {
          occupiedDesks.add(desk.name);
        }
      }
    });

    const availableCount = state.desks.length - occupiedDesks.size;
    $('#number-desks').text(availableCount);
  }

  // ============================================================================
  // DRAG SCROLL NO GRID
  // ============================================================================
  function initDragScroll() {
    const grid = document.getElementById('desk-grid');
    if (!grid) return;

    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    grid.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDown = true;
      grid.style.cursor = 'grabbing';
      startX = e.pageX - grid.offsetLeft;
      startY = e.pageY - grid.offsetTop;
      scrollLeft = grid.scrollLeft;
      scrollTop = grid.scrollTop;
    });

    grid.addEventListener('mouseleave', () => {
      isDown = false;
      grid.style.cursor = 'grab';
    });

    grid.addEventListener('mouseup', () => {
      isDown = false;
      grid.style.cursor = 'grab';
    });

    grid.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - grid.offsetLeft;
      const y = e.pageY - grid.offsetTop;
      const walkX = (x - startX) * 2;
      const walkY = (y - startY) * 2;
      grid.scrollLeft = scrollLeft - walkX;
      grid.scrollTop = scrollTop - walkY;
    });
  }

  // ============================================================================
  // AÇÕES DE RESERVA
  // ============================================================================
  async function makeReservation(deskNumber) {
    try {
      const desk = state.desks.find(d => d.number == deskNumber);
      
      if (!desk) {
        console.error(`Mesa não encontrada. Number: ${deskNumber}`);
        showAlert('Mesa não encontrada. Tente novamente.', 'warning');
        return;
      }

      // Payload SEM id - deixa o banco gerar automaticamente
      // desk agora é string com o NAME da mesa
      const payload = {
        date: state.selectedDate,
        desk: desk.name,
        user_id: state.currentUser.id,
        user_name: state.currentUser.name
      };

      console.info('📝 Criando reserva:', payload);

      const { error } = await state.sb
        .from(CONFIG.TABLE_RESERVATIONS)
        .insert(payload);

      if (error) {
        if (error.message?.includes('reservations_2026_date_user_id_key')) {
          showAlert('Você já possui uma reserva para este dia.', 'warning');
        } else {
          showAlert('Esta mesa já foi reservada. Atualize a página.', 'warning');
        }
        throw error;
      }

      showAlert(`Reserva confirmada na ${desk.name}!`, 'success');
      await refreshData();
      renderPage();

    } catch (error) {
      console.error('❌ Erro ao reservar:', error);
    }
  }

  async function cancelReservation(deskNumber, resId) {
    try {
      const desk = state.desks.find(d => d.number == deskNumber);
      
      if (!desk) {
        showAlert('Mesa não encontrada.', 'warning');
        return;
      }
      
      if (!resId) {
        // Liberar mesa fixa - criar registro de cancelamento
        const fixedReserveUser = desk.fixed_reserve 
          ? desk.fixed_reserve.split('@')[0] 
          : 'Reservado';
        
        await state.sb.from(CONFIG.TABLE_RESERVATIONS).insert({
          date: state.selectedDate,
          desk: desk.name,
          user_id: 'mesa_fixa',
          user_name: fixedReserveUser,
          canceled_at: new Date().toISOString(),
          canceled_by: state.currentUser.id
        });
      } else {
        // Cancelar reserva existente
        await state.sb
          .from(CONFIG.TABLE_RESERVATIONS)
          .update({
            canceled_at: new Date().toISOString(),
            canceled_by: state.currentUser.id
          })
          .eq('id', resId);
      }

      showAlert('Mesa liberada com sucesso!', 'success');
      await refreshData();
      renderPage();

    } catch (error) {
      console.error('❌ Erro ao cancelar:', error);
      showAlert('Não foi possível liberar a mesa.', 'danger');
    }
  }

  // ============================================================================
  // CHECK-IN VIA QR CODE
  // ============================================================================
  async function checkCheckinParam() {
    if (state.isViewMode) return;

    const urlParams = new URLSearchParams(window.location.search);
    const deskToCheckin = urlParams.get('checkin');

    if (deskToCheckin) {
      const res = state.reservations.find(r =>
        r.desk === deskToCheckin &&
        r.user_id === state.currentUser.id &&
        !r.canceled_at
      );

      if (res) {
        await state.sb
          .from(CONFIG.TABLE_RESERVATIONS)
          .update({ checked_in_at: new Date().toISOString() })
          .eq('id', res.id);
        showAlert('Check-in realizado com sucesso!', 'success');
      } else {
        showAlert('Nenhum agendamento encontrado para check-in.', 'warning');
      }
    }
  }

  // ============================================================================
  // MANIPULADORES DE EVENTOS
  // ============================================================================
  function handleDateSelect(e) {
    state.selectedDate = $(e.currentTarget).data('date');
    $('#loader').show();
    refreshData().then(() => {
      renderPage();
      $('#loader').hide();
    });
  }

  function generateAvailableDates() {
    const dates = [];
    const today = new Date();
    let daysAdded = 0;
    let i = 0;

    while (daysAdded < 6 && i < 14) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      if (d.getDay() >= 1 && d.getDay() <= 5) {
        dates.push(d.toISOString().split('T')[0]);
        daysAdded++;
      }
      i++;
    }

    state.availableDates = dates;
    if (!state.selectedDate && dates.length > 0) {
      state.selectedDate = dates[0];
    }
  }

  // ============================================================================
  // SISTEMA DE NOTIFICAÇÕES
  // ============================================================================
  function showAlert(message, type = 'info') {
    const container = getToastContainer();
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const html = `
      <div id="${id}" class="toast alert alert-${type} border-0" 
           role="alert" aria-live="assertive" aria-atomic="true" 
           data-autohide="true" data-delay="3000">
        <div class="toast-body d-flex align-items-center">
          <div class="flex-fill">${message}</div>
          <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Fechar">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    
    const $toast = $(`#${id}`);
    $toast.toast({ autohide: true, delay: 3000 });
    $toast.toast('show');
    $toast.on('hidden.bs.toast', function() {
      $(this).remove();
    });
  }

  function getToastContainer() {
    let container = document.getElementById('toast-stack');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-stack';
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: '1080',
        display: 'flex',
        flexDirection: 'column',
        gap: '.5rem'
      });
      document.body.appendChild(container);
    }
    
    return container;
  }

  // ============================================================================
  // FUNÇÕES UTILITÁRIAS
  // ============================================================================
  function formatDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  function formatDateTime(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateShort(d) {
    const [, month, day] = d.split('-');
    return `${day}/${month}`;
  }

  function getWeekdayLabel(d) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[new Date(d + 'T00:00:00').getDay()];
  }

  function isToday(d) {
    return d === new Date().toISOString().split('T')[0];
  }

  // ============================================================================
  // MODAL DE LOGIN
  // ============================================================================
  function addLoginModal() {
    const modalHtml = `
      <div id="login-overlay">
        <div id="login-modal">
          <div class="modal-icon">🔐</div>
          <h3 id="modal-title">Fazer Login</h3>
          <p class="subtitle" id="modal-subtitle">Escolha como deseja acessar o sistema</p>
          
          <div id="choice-step">
            <div class="login-choice-buttons">
              <button class="login-choice-btn sisbr" id="btn-sisbr">
                <span class="icon">🏢</span>
                <span>Acesso via Sisbr</span>
              </button>
              <button class="login-choice-btn admin" id="btn-admin">
                <span class="icon">👨‍💼</span>
                <span>Administrador</span>
              </button>
              <button class="login-choice-btn external" id="btn-external">
                <span class="icon">👤</span>
                <span>Usuário Externo</span>
              </button>
            </div>
            <button id="cancel-choice-btn" class="btn-secondary btn-action" style="width: 100%; margin-top: 1rem;">Cancelar</button>
          </div>

          <div id="admin-input-step" style="display: none;">
            <input type="text" id="admin-username-input" placeholder="Digite seu usuário admin" autocomplete="username">
            <div class="btn-group">
              <button id="back-from-admin-btn" class="btn-secondary btn-action">Voltar</button>
              <button id="next-admin-btn" class="btn-primary btn-action">Continuar</button>
            </div>
          </div>

          <div id="external-input-step" style="display: none;">
            <input type="text" id="external-username-input" placeholder="Digite seu usuário" autocomplete="username">
            <div class="btn-group">
              <button id="back-from-external-btn" class="btn-secondary btn-action">Voltar</button>
              <button id="next-external-btn" class="btn-primary btn-action">Continuar</button>
            </div>
          </div>

          <div id="code-step" style="display: none;">
            <input type="password" id="code-input" placeholder="Digite o código de acesso" autocomplete="off">
            <div class="btn-group">
              <button id="back-from-code-btn" class="btn-secondary btn-action">Voltar</button>
              <button id="login-final-btn" class="btn-primary btn-action">Entrar</button>
            </div>
          </div>

          <div id="secret-input-step" style="display: none;">
            <input type="text" id="secret-username-input" placeholder="Digite seu usuário" autocomplete="username">
            <div class="btn-group">
              <button id="back-from-secret-btn" class="btn-secondary btn-action">Voltar</button>
              <button id="secret-login-btn" class="btn-primary btn-action">Entrar</button>
            </div>
          </div>

          <div id="login-error" class="alert-box alert-error"></div>
          <div id="login-success" class="alert-box alert-success"></div>
        </div>
      </div>
    `;

    $('body').append(modalHtml);
  }

  function openLoginModal() {
    $('#login-overlay').addClass('show');
    resetModal();
  }

  function closeLoginModal() {
    $('#login-overlay').removeClass('show');
    resetModal();
  }

  function resetModal() {
    modalState = { currentStep: 'choice', currentUsername: '', currentType: '' };
    $('#choice-step, #admin-input-step, #external-input-step, #code-step, #secret-input-step').hide();
    $('#choice-step').show();
    $('#admin-username-input, #external-username-input, #code-input, #secret-username-input').val('');
    $('#login-error, #login-success').hide();
    $('#modal-title').text('Fazer Login');
    $('#modal-subtitle').text('Escolha como deseja acessar o sistema');
  }

  function showError(message) {
    $('#login-error').html(`<strong>⚠️ ${message}</strong>`).show();
    $('#login-success').hide();
  }

  function showSuccess(message) {
    $('#login-success').html(`<strong>✅ ${message}</strong>`).show();
    $('#login-error').hide();
  }

  function handleSisbrChoice() {
    window.location.href = 'https://www.sicoob.com.br/group/acessos/mesasmkt';
  }

  function handleAdminChoice() {
    $('#choice-step').hide();
    $('#admin-input-step').show();
    $('#modal-title').text('Acesso Administrador');
    $('#modal-subtitle').text('Digite seu nome de usuário administrativo');
    $('#admin-username-input').focus();
  }

  function handleExternalChoice() {
    $('#choice-step').hide();
    $('#external-input-step').show();
    $('#modal-title').text('Acesso Externo');
    $('#modal-subtitle').text('Digite seu nome de usuário');
    $('#external-username-input').focus();
  }

  function handleSecretChoice() {
    $('#choice-step').hide();
    $('#secret-input-step').show();
    $('#modal-title').text('🔒 Login');
    $('#modal-subtitle').text('Digite seu usuário completo');
    $('#secret-username-input').focus();
    $('#login-error, #login-success').hide();
  }

  function handleAdminUsernameSubmit() {
    const username = $('#admin-username-input').val().trim().toLowerCase();
    
    if (!username) {
      showError('Por favor, digite um nome de usuário.');
      return;
    }

    if (!ADMIN_USERS.includes(username)) {
      showError('Usuário não encontrado na lista de administradores.');
      return;
    }

    modalState.currentUsername = username;
    modalState.currentType = 'admin';
    showCodeStep();
  }

  function handleExternalUsernameSubmit() {
    const username = $('#external-username-input').val().trim().toLowerCase();
    
    if (!username) {
      showError('Por favor, digite um nome de usuário.');
      return;
    }

    if (!EXTERNAL_USERS.includes(username)) {
      showError('Usuário não encontrado na lista de externos.');
      return;
    }

    modalState.currentUsername = username;
    modalState.currentType = 'external';
    showCodeStep();
  }

  function showCodeStep() {
    $('#admin-input-step, #external-input-step').hide();
    $('#code-step').show();
    $('#modal-title').text('Código de Acesso');
    $('#modal-subtitle').text('Digite o código fornecido');
    $('#code-input').val('').focus();
    $('#login-error, #login-success').hide();
  }

  function handleCodeSubmit() {
    const code = $('#code-input').val().trim();
    
    if (!code) {
      showError('Por favor, digite o código de acesso.');
      return;
    }

    const expectedCode = modalState.currentType === 'admin' ? ACCESS_CODES.ADMIN : ACCESS_CODES.EXTERNAL;
    
    if (code !== expectedCode) {
      showError('Código incorreto. Tente novamente.');
      return;
    }

    const role = modalState.currentType === 'admin' ? 'admin' : 'external';
    const email = `${modalState.currentUsername}@sicoob.com.br`;
    
    const user = {
      id: email,
      name: modalState.currentUsername,
      email: email,
      role: role
    };

    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    localStorage.setItem(CACHED_ROLE_KEY, role);
    localStorage.setItem(CACHED_SOURCE_KEY, 'code');

    showSuccess('Login realizado! Redirecionando...');
    
    setTimeout(() => {
      location.reload();
    }, 1000);
  }

  function handleSecretLogin() {
    const username = $('#secret-username-input').val().trim().toLowerCase();
    
    if (!username) {
      showError('Por favor, digite um nome de usuário.');
      return;
    }

    let role = 'user';
    if (ADMIN_USERS.includes(username.split('@')[0])) {
      role = 'admin';
    } else if (EXTERNAL_USERS.includes(username.split('@')[0])) {
      role = 'external';
    }

    const cleanUsername = username.split('@')[0];
    const email = username.includes('@') ? username : `${username}@sicoob.com.br`;
    
    const user = {
      id: email,
      name: cleanUsername,
      email: email,
      role: role
    };

    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    localStorage.setItem(CACHED_ROLE_KEY, role);
    localStorage.setItem(CACHED_SOURCE_KEY, 'secret');

    showSuccess('Login realizado! Redirecionando...');
    
    setTimeout(() => {
      location.reload();
    }, 1000);
  }

  function bindModalEvents() {
    $('#btn-sisbr').off('click').on('click', handleSisbrChoice);
    $('#btn-admin').off('click').on('click', handleAdminChoice);
    $('#btn-external').off('click').on('click', handleExternalChoice);
    
    // Clique no ícone para ativar modo secreto
    $('.modal-icon').off('click').on('click', handleSecretChoice);
    
    $('#cancel-choice-btn').off('click').on('click', closeLoginModal);
    
    // Voltar
    $('#back-from-admin-btn').off('click').on('click', resetModal);
    $('#back-from-external-btn').off('click').on('click', resetModal);
    $('#back-from-code-btn').off('click').on('click', () => {
      if (modalState.currentType === 'admin') {
        handleAdminChoice();
      } else {
        handleExternalChoice();
      }
    });
    $('#back-from-secret-btn').off('click').on('click', resetModal);
    
    // Próximo passo
    $('#next-admin-btn').off('click').on('click', handleAdminUsernameSubmit);
    $('#next-external-btn').off('click').on('click', handleExternalUsernameSubmit);
    $('#login-final-btn').off('click').on('click', handleCodeSubmit);
    $('#secret-login-btn').off('click').on('click', handleSecretLogin);
    
    // Enter
    $('#admin-username-input').off('keypress').on('keypress', e => {
      if (e.which === 13) handleAdminUsernameSubmit();
    });
    $('#external-username-input').off('keypress').on('keypress', e => {
      if (e.which === 13) handleExternalUsernameSubmit();
    });
    $('#code-input').off('keypress').on('keypress', e => {
      if (e.which === 13) handleCodeSubmit();
    });
    $('#secret-username-input').off('keypress').on('keypress', e => {
      if (e.which === 13) handleSecretLogin();
    });
    
    // Fechar overlay
    $('#login-overlay').off('click').on('click', function(e) {
      if (e.target.id === 'login-overlay') {
        closeLoginModal();
      }
    });
  }

  // ============================================================================
  // AUTENTICAÇÃO E INICIALIZAÇÃO
  // ============================================================================
  function checkAuthentication() {
    const cachedUser = localStorage.getItem(CACHED_USER_KEY);
    const cachedRole = localStorage.getItem(CACHED_ROLE_KEY);
    const cachedSource = localStorage.getItem(CACHED_SOURCE_KEY);

    if (cachedUser && cachedRole) {
      try {
        state.currentUser = JSON.parse(cachedUser);
        state.isAdmin = cachedRole === 'admin';
        state.isViewMode = false;
        
        console.info('🔓 Autenticação do cache:', cachedSource);
        return true;
      } catch (error) {
        console.error('Erro ao parsear cache:', error);
        localStorage.removeItem(CACHED_USER_KEY);
        localStorage.removeItem(CACHED_ROLE_KEY);
        localStorage.removeItem(CACHED_SOURCE_KEY);
      }
    }

    if (typeof Liferay !== 'undefined' && Liferay?.ThemeDisplay?.isSignedIn?.()) {
      try {
        const email = Liferay.ThemeDisplay.getUserEmailAddress() || '';
        const emailLower = email.toLowerCase(); // FORÇAR LOWERCASE
        const localPart = emailLower.split('@')[0];
        
        if (emailLower && localPart) {
          const role = ADMIN_USERS.includes(localPart) ? 'admin' : 'user';
          
          state.currentUser = {
            id: emailLower,
            name: localPart,
            email: emailLower,
            role: role
          };
          state.isAdmin = role === 'admin';
          state.isViewMode = false;

          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(state.currentUser));
          localStorage.setItem(CACHED_ROLE_KEY, role);
          localStorage.setItem(CACHED_SOURCE_KEY, 'liferay');

          console.info('🔓 Autenticação via Liferay');
          return true;
        }
      } catch (error) {
        console.error('Erro ao autenticar via Liferay:', error);
      }
    }

    console.info('👁️ Modo visualização ativado');
    state.currentUser = {
      id: 'viewer@public',
      name: 'Visitante',
      email: 'viewer@public',
      role: 'viewer'
    };
    state.isAdmin = false;
    state.isViewMode = true;

    return false;
  }

  // ============================================================================
  // INICIALIZAÇÃO DO APLICATIVO
  // ============================================================================
  $(document).ready(function() {
    console.info('🚀 Iniciando aplicação de agendamento v4.1...');
    
    addLoginModal();
    bindModalEvents();
    
    const hasAuth = checkAuthentication();
    
    if (!hasAuth) {
      $('#open-login-btn').off('click').on('click', openLoginModal);
    }
    
    init();
  });

})(jQuery);