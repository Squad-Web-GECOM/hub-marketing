/**
 * HUB MARKETING - Pagina de Mesas (Desk Booking)
 * Migrado de agendamento-complete-v4.2
 *
 * Depends on: main.js (hub.sb, hub.auth, hub.utils)
 */
(function($) {
  'use strict';

  // ====================================================================
  // STATE
  // ====================================================================
  var state = {
    selectedDate: '',
    desks: [],
    reservations: [],
    availableDates: [],
    viewMode: false
  };

  // ====================================================================
  // INIT - wait for hub:ready
  // ====================================================================
  document.addEventListener('hub:ready', function() {
    // Mesas page allows view mode (no login required)
    state.viewMode = hub.auth._source === 'view';

    setupUI();
    init();
  });

  // ====================================================================
  // SETUP UI (login button)
  // ====================================================================
  function setupUI() {
    if (state.viewMode) {
      $('#open-login-btn').show().on('click', function() {
        hub._loginFlow.open ? hub._loginFlow.open() : hub.auth.showLoginModal();
      });
    }
  }

  // ====================================================================
  // INIT
  // ====================================================================
  async function init() {
    try {
      await loadDesks();
      generateAvailableDates();
      await loadReservations();

      renderDateSelector();
      renderDesks();
      updateFreeCount();
      await updateSuggestion();
      await checkCheckinParam();

      $('#app-view').fadeIn(300);
      hub.utils.hideLoader();
    } catch (err) {
      console.error('Mesas: init error', err);
      hub.utils.showToast('Falha ao iniciar. Verifique sua conexao.', 'danger');
      hub.utils.hideLoader();
    }
  }

  // ====================================================================
  // DATA LOADING
  // ====================================================================
  async function loadDesks() {
    var resp = await hub.sb
      .from('desks')
      .select('*')
      .eq('is_active', true)
      .order('number');

    if (resp.error) throw resp.error;
    state.desks = resp.data || [];
  }

  async function loadReservations() {
    var resp = await hub.sb
      .from('reservations')
      .select('*')
      .eq('date', state.selectedDate);

    if (resp.error) throw resp.error;
    state.reservations = resp.data || [];
  }

  async function refreshData() {
    await loadReservations();
  }

  // ====================================================================
  // AVAILABLE DATES (next 6 business days)
  // ====================================================================
  function generateAvailableDates() {
    var dates = [];
    var today = new Date();
    var daysAdded = 0;
    var i = 0;

    while (daysAdded < 6 && i < 14) {
      var d = new Date(today);
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

  // ====================================================================
  // DATE SELECTOR (modernized: big day number + weekday abbr)
  // ====================================================================
  function renderDateSelector() {
    var html = state.availableDates.map(function(date) {
      var active = state.selectedDate === date ? 'active' : '';
      var parts = date.split('-');
      var dayNum = parseInt(parts[2], 10);
      var weekday = isToday(date) ? 'HOJE' : getWeekdayLabel(date).toUpperCase();

      return '' +
        '<button class="btn btn-secondary date-selector-btn ' + active + '" data-date="' + date + '">' +
          '<div class="d-flex flex-column align-items-center lh-1">' +
            '<span style="font-size:1.4rem;font-weight:700;line-height:1;">' + dayNum + '</span>' +
            '<small class="' + (active ? 'text-white' : 'text-muted') + '" style="font-size:0.7rem;text-transform:uppercase;">' + weekday + '</small>' +
          '</div>' +
        '</button>';
    }).join('');

    $('#date-selector').html(html);
    $('#selected-date-display').text(formatDate(state.selectedDate));

    $('.date-selector-btn').off('click').on('click', function() {
      state.selectedDate = $(this).data('date');
      hub.utils.showLoader();
      refreshData().then(function() {
        renderDateSelector();
        renderDesks();
        updateFreeCount();
        updateSuggestion();
        hub.utils.hideLoader();
      });
    });
  }

  // ====================================================================
  // DESK GRID
  // ====================================================================
  function renderDesks() {
    var $grid = $('#desk-grid');

    if (state.desks.length === 0) {
      $grid.html('<p class="text-center text-muted py-4">Nenhuma mesa ativa encontrada.</p>');
      return;
    }

    var user = hub.auth.getUser();
    var userName = user ? user.user_name : null;
    var isAdmin = user ? user.isAdmin : false;

    // Check if the current user already has a reservation today (non-canceled)
    var hasResToday = state.reservations.some(function(r) {
      return r.created_by === userName && !r.canceled_at;
    });

    var html = state.desks.map(function(desk) {
      // Active (non-canceled) reservation for this desk
      var realRes = null;
      for (var i = 0; i < state.reservations.length; i++) {
        var r = state.reservations[i];
        if (r.desk_name === desk.desk_name && !r.canceled_at) {
          realRes = r;
          break;
        }
      }

      // Check if fixed desk was freed (canceled mesa_fixa record)
      var wasFreed = false;
      for (var j = 0; j < state.reservations.length; j++) {
        var rv = state.reservations[j];
        if (rv.desk_name === desk.desk_name && rv.canceled_at && rv.created_by === 'mesa_fixa') {
          wasFreed = true;
          break;
        }
      }

      var displayRes = null;
      var isOccupied = false;

      if (realRes) {
        displayRes = realRes;
        isOccupied = true;
      } else if (desk.fixed_reserve && !wasFreed) {
        // Fixed desk not freed - show as virtual reservation
        displayRes = {
          created_by: desk.fixed_reserve,
          display_name: desk.fixed_reserve,
          is_virtual: true
        };
        isOccupied = true;
      }

      var isMyRes = displayRes && displayRes.created_by === userName;
      var canBook = !isOccupied && !state.viewMode && (isAdmin || !hasResToday);

      var cardClass = isOccupied ? (isMyRes ? 'my-reservation' : 'occupied') : 'available';
      var statusText = isOccupied ? (displayRes.display_name || displayRes.created_by || 'Reservado') : 'Livre';
      var btnHtml = '';

      if (!state.viewMode) {
        if (isOccupied) {
          if (isAdmin || isMyRes) {
            btnHtml = '<button class="btn btn-sm btn-danger cancel-btn" data-num="' + desk.number + '" data-res-id="' + (displayRes.id || '') + '">Liberar</button>';
          }
        } else if (canBook) {
          btnHtml = '<button class="btn btn-sm btn-primary book-btn" data-num="' + desk.number + '">Reservar</button>';
        }
      }

      // Adjust grid_row for corridor gaps
      var actualGridRow = desk.grid_row;
      if (desk.grid_row >= 3 && desk.grid_row <= 4) {
        actualGridRow = desk.grid_row + 1;
      } else if (desk.grid_row >= 5 && desk.grid_row <= 6) {
        actualGridRow = desk.grid_row + 2;
      } else if (desk.grid_row >= 7) {
        actualGridRow = desk.grid_row + 3;
      }

      var style = 'grid-row:' + actualGridRow + ';grid-column:' + desk.grid_col +
        ';grid-row-end:span ' + (desk.row_span || 1) +
        ';grid-column-end:span ' + (desk.col_span || 1) + ';';

      return '' +
        '<div class="card desk-card ' + cardClass + '" style="' + style + '">' +
          '<div class="card-body p-2 d-flex flex-column justify-content-between text-center">' +
            '<h6 class="card-title mb-1">' + desk.desk_name + '</h6>' +
            '<span class="reserved-name small text-truncate">' + statusText + '</span>' +
            btnHtml +
          '</div>' +
        '</div>';
    }).join('');

    $grid.html(html);

    if (!state.viewMode) {
      $('.book-btn').off('click').on('click', function() {
        makeReservation($(this).data('num'));
      });
      $('.cancel-btn').off('click').on('click', function() {
        cancelReservation($(this).data('num'), $(this).data('res-id'));
      });
    }

    initDragScroll();
  }

  // ====================================================================
  // FREE DESKS COUNTER
  // ====================================================================
  function updateFreeCount() {
    var activeReservations = state.reservations.filter(function(r) { return !r.canceled_at; });
    var occupiedDesks = {};

    activeReservations.forEach(function(r) {
      occupiedDesks[r.desk_name] = true;
    });

    state.desks.forEach(function(desk) {
      if (desk.fixed_reserve) {
        var wasFreed = false;
        for (var i = 0; i < state.reservations.length; i++) {
          var r = state.reservations[i];
          if (r.desk_name === desk.desk_name && r.canceled_at && r.created_by === 'mesa_fixa') {
            wasFreed = true;
            break;
          }
        }
        if (!wasFreed) {
          occupiedDesks[desk.desk_name] = true;
        }
      }
    });

    var occupiedCount = Object.keys(occupiedDesks).length;
    var freeCount = state.desks.length - occupiedCount;
    $('#free-count-badge').text(freeCount + ' Livres');
  }

  // ====================================================================
  // SMART DESK SUGGESTION
  // ====================================================================
  async function updateSuggestion() {
    var $el = $('#suggestion-content');

    if (state.viewMode) {
      $el.html('<span class="text-muted">Faca login para receber sugestoes personalizadas.</span>');
      return;
    }

    var user = hub.auth.getUser();
    if (!user) {
      $el.html('<span class="text-muted">Nenhuma sugestao disponivel.</span>');
      return;
    }

    // Build set of available desks for selected date
    var occupiedDesks = getOccupiedDeskNames();
    var availableDesks = state.desks.filter(function(d) {
      return !occupiedDesks[d.desk_name];
    });

    if (availableDesks.length === 0) {
      $el.html('<span class="text-muted">Nenhuma mesa disponivel nesta data.</span>');
      return;
    }

    // Check if user already has a reservation for today
    var hasRes = state.reservations.some(function(r) {
      return r.created_by === user.user_name && !r.canceled_at;
    });

    if (hasRes && !user.isAdmin) {
      $el.html('<span class="text-muted">Voce ja possui reserva nesta data.</span>');
      return;
    }

    try {
      var scores = {};
      availableDesks.forEach(function(d) { scores[d.desk_name] = 0; });

      // 1. Personal history: most reserved desk in last 30 days
      var thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      var historyDate = thirtyDaysAgo.toISOString().split('T')[0];

      var histResp = await hub.sb
        .from('reservations')
        .select('desk_name')
        .eq('created_by', user.user_name)
        .gte('date', historyDate)
        .is('canceled_at', null);

      var historyCounts = {};
      var topHistoryDesk = null;
      var topHistoryCount = 0;

      if (histResp.data && histResp.data.length > 0) {
        histResp.data.forEach(function(r) {
          historyCounts[r.desk_name] = (historyCounts[r.desk_name] || 0) + 1;
        });
        Object.keys(historyCounts).forEach(function(dn) {
          if (historyCounts[dn] > topHistoryCount) {
            topHistoryCount = historyCounts[dn];
            topHistoryDesk = dn;
          }
        });
        // Apply +3 score to the top personal desk
        if (topHistoryDesk && scores.hasOwnProperty(topHistoryDesk)) {
          scores[topHistoryDesk] += 3;
        }
      }

      // 2. Nucleo proximity (+2pts): desks reserved by same nucleo on selected date
      // 3. Coordenacao proximity (+1pt): same for coordenacao
      if (user.nucleo_id || user.coordenacao_id) {
        // Find colleagues with same nucleo / coordenacao
        var colleagueFilters = [];
        if (user.nucleo_id) colleagueFilters.push({ field: 'nucleo_id', val: user.nucleo_id, pts: 2 });
        if (user.coordenacao_id) colleagueFilters.push({ field: 'coordenacao_id', val: user.coordenacao_id, pts: 1 });

        for (var ci = 0; ci < colleagueFilters.length; ci++) {
          var cf = colleagueFilters[ci];
          var usersResp = await hub.sb
            .from('users')
            .select('user_name')
            .eq(cf.field, cf.val)
            .neq('user_name', user.user_name)
            .eq('is_active', true);

          if (usersResp.data && usersResp.data.length > 0) {
            var colleagueNames = usersResp.data.map(function(u) { return u.user_name; });

            // Find which desks these colleagues reserved for the selected date
            var colResResp = await hub.sb
              .from('reservations')
              .select('desk_name')
              .eq('date', state.selectedDate)
              .is('canceled_at', null)
              .in('created_by', colleagueNames);

            if (colResResp.data) {
              // For each colleague desk, give proximity points to adjacent desks
              var colleagueDesks = {};
              colResResp.data.forEach(function(r) { colleagueDesks[r.desk_name] = true; });

              // Add pts to available desks that are in same grid row neighborhood
              var colleagueDeskObjs = state.desks.filter(function(d) { return colleagueDesks[d.desk_name]; });

              availableDesks.forEach(function(ad) {
                colleagueDeskObjs.forEach(function(cd) {
                  // Same row or adjacent row, within 2 columns = proximity
                  var rowDist = Math.abs(ad.grid_row - cd.grid_row);
                  var colDist = Math.abs(ad.grid_col - cd.grid_col);
                  if (rowDist <= 1 && colDist <= 2) {
                    scores[ad.desk_name] += cf.pts;
                  }
                });
              });
            }
          }
        }
      }

      // Tiebreak: lower desk number
      var bestDesk = null;
      var bestScore = -1;
      availableDesks.forEach(function(d) {
        var s = scores[d.desk_name] || 0;
        if (s > bestScore || (s === bestScore && (!bestDesk || d.number < bestDesk.number))) {
          bestScore = s;
          bestDesk = d;
        }
      });

      if (!bestDesk) {
        $el.html('<span class="text-muted">Nenhuma sugestao disponivel.</span>');
        return;
      }

      // Determine reason text
      var reason = 'Mesa disponivel';
      if (bestScore >= 3 && topHistoryDesk === bestDesk.desk_name) {
        reason = 'Sua mesa mais frequente';
      } else if (bestScore >= 2) {
        reason = 'Perto do seu nucleo';
      } else if (bestScore >= 1) {
        reason = 'Perto da sua coordenacao';
      }

      var suggestionHtml = '' +
        '<div class="d-flex align-items-center justify-content-between">' +
          '<div>' +
            '<strong style="font-size:1.1rem;">' + bestDesk.desk_name + '</strong>' +
            '<div class="text-muted small">' + reason + '</div>' +
          '</div>' +
          '<div class="d-flex gap-2">' +
            (hasRes && !user.isAdmin ? '' :
              '<button class="btn btn-sm btn-primary mr-2 suggestion-book-btn" data-num="' + bestDesk.number + '">Agendar</button>'
            ) +
            '<button class="btn btn-sm btn-outline-secondary suggestion-view-btn">Ver outras</button>' +
          '</div>' +
        '</div>';

      $el.html(suggestionHtml);

      $('.suggestion-book-btn').off('click').on('click', function() {
        makeReservation($(this).data('num'));
      });
      $('.suggestion-view-btn').off('click').on('click', function() {
        $('html, body').animate({ scrollTop: $('#desk-grid').offset().top - 80 }, 400);
      });

    } catch (err) {
      console.error('Mesas: suggestion error', err);
      $el.html('<span class="text-muted">Nao foi possivel gerar sugestao.</span>');
    }
  }

  /**
   * Returns an object whose keys are occupied desk_names for the current date.
   */
  function getOccupiedDeskNames() {
    var occupied = {};

    state.reservations.forEach(function(r) {
      if (!r.canceled_at) occupied[r.desk_name] = true;
    });

    state.desks.forEach(function(desk) {
      if (desk.fixed_reserve) {
        var wasFreed = false;
        for (var i = 0; i < state.reservations.length; i++) {
          var r = state.reservations[i];
          if (r.desk_name === desk.desk_name && r.canceled_at && r.created_by === 'mesa_fixa') {
            wasFreed = true;
            break;
          }
        }
        if (!wasFreed) occupied[desk.desk_name] = true;
      }
    });

    return occupied;
  }

  // ====================================================================
  // RESERVATION ACTIONS
  // ====================================================================
  async function makeReservation(deskNumber) {
    try {
      var desk = state.desks.find(function(d) { return d.number == deskNumber; });
      if (!desk) {
        hub.utils.showToast('Mesa nao encontrada. Tente novamente.', 'warning');
        return;
      }

      var user = hub.auth.getUser();
      if (!user || state.viewMode) {
        hub.utils.showToast('Faca login para reservar.', 'warning');
        return;
      }

      var payload = {
        date: state.selectedDate,
        desk_name: desk.desk_name,
        created_by: user.user_name
      };

      var resp = await hub.sb
        .from('reservations')
        .insert(payload);

      if (resp.error) {
        if (resp.error.message && resp.error.message.indexOf('date_user') !== -1) {
          hub.utils.showToast('Voce ja possui uma reserva para este dia.', 'warning');
        } else {
          hub.utils.showToast('Esta mesa ja foi reservada. Atualize a pagina.', 'warning');
        }
        throw resp.error;
      }

      hub.utils.showToast('Reserva confirmada na ' + desk.desk_name + '!', 'success');
      await refreshData();
      renderDateSelector();
      renderDesks();
      updateFreeCount();
      updateSuggestion();
    } catch (err) {
      console.error('Mesas: reservation error', err);
    }
  }

  async function cancelReservation(deskNumber, resId) {
    try {
      var desk = state.desks.find(function(d) { return d.number == deskNumber; });
      if (!desk) {
        hub.utils.showToast('Mesa nao encontrada.', 'warning');
        return;
      }

      var user = hub.auth.getUser();
      if (!user) return;

      if (!resId) {
        // Free a fixed desk - insert a canceled mesa_fixa record
        await hub.sb.from('reservations').insert({
          date: state.selectedDate,
          desk_name: desk.desk_name,
          created_by: 'mesa_fixa',
          canceled_at: new Date().toISOString(),
          canceled_by: user.user_name
        });
      } else {
        // Cancel an existing reservation
        await hub.sb
          .from('reservations')
          .update({
            canceled_at: new Date().toISOString(),
            canceled_by: user.user_name
          })
          .eq('id', resId);
      }

      hub.utils.showToast('Mesa liberada com sucesso!', 'success');
      await refreshData();
      renderDateSelector();
      renderDesks();
      updateFreeCount();
      updateSuggestion();
    } catch (err) {
      console.error('Mesas: cancel error', err);
      hub.utils.showToast('Nao foi possivel liberar a mesa.', 'danger');
    }
  }

  // ====================================================================
  // CHECK-IN VIA QR CODE
  // ====================================================================
  async function checkCheckinParam() {
    if (state.viewMode) return;

    var urlParams = new URLSearchParams(window.location.search);
    var deskToCheckin = urlParams.get('checkin');
    if (!deskToCheckin) return;

    var user = hub.auth.getUser();
    if (!user) return;

    var res = state.reservations.find(function(r) {
      return r.desk_name === deskToCheckin && r.created_by === user.user_name && !r.canceled_at;
    });

    if (res) {
      await hub.sb
        .from('reservations')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', res.id);
      hub.utils.showToast('Check-in realizado com sucesso!', 'success');
    } else {
      hub.utils.showToast('Nenhum agendamento encontrado para check-in.', 'warning');
    }
  }

  // ====================================================================
  // DRAG SCROLL
  // ====================================================================
  function initDragScroll() {
    var grid = document.getElementById('desk-grid');
    if (!grid) return;

    var isDown = false;
    var startX, startY, scrollLeft, scrollTop;

    grid.addEventListener('mousedown', function(e) {
      if (e.target.closest('button')) return;
      isDown = true;
      grid.style.cursor = 'grabbing';
      startX = e.pageX - grid.offsetLeft;
      startY = e.pageY - grid.offsetTop;
      scrollLeft = grid.scrollLeft;
      scrollTop = grid.scrollTop;
    });

    grid.addEventListener('mouseleave', function() {
      isDown = false;
      grid.style.cursor = 'grab';
    });

    grid.addEventListener('mouseup', function() {
      isDown = false;
      grid.style.cursor = 'grab';
    });

    grid.addEventListener('mousemove', function(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - grid.offsetLeft;
      var y = e.pageY - grid.offsetTop;
      grid.scrollLeft = scrollLeft - (x - startX) * 2;
      grid.scrollTop = scrollTop - (y - startY) * 2;
    });
  }

  // ====================================================================
  // UTILITY FUNCTIONS
  // ====================================================================
  function formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  function formatDateShort(d) {
    var parts = d.split('-');
    return parts[2] + '/' + parts[1];
  }

  function getWeekdayLabel(d) {
    var days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    return days[new Date(d + 'T00:00:00').getDay()];
  }

  function isToday(d) {
    return d === new Date().toISOString().split('T')[0];
  }

})(jQuery);
