/**
 * HUB MARKETING - Home Page
 * Greeting, Stats Cards, Quick Links
 */
(function() {
  'use strict';

  document.addEventListener('hub:ready', function() {
    // Auth gate
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;

    init();
  });

  // ==================================================================
  // INIT
  // ==================================================================
  var currentBirthdayMonth = new Date().getMonth(); // 0-indexed
  var currentBirthdayYear  = new Date().getFullYear();
  var allBirthdayUsers = [];

  async function init() {
    try {
      hub.utils.showLoader();

      renderGreeting();

      // Fetch stats, quick links and birthday users in parallel
      await Promise.all([
        loadStats(),
        loadQuickLinks(),
        loadAllBirthdayUsers()
      ]);

      renderBirthdays();
      bindBirthdayNav();

      // Show the app view
      var appView = document.getElementById('app-view');
      if (appView) appView.style.display = 'block';
    } catch (err) {
      console.error('Home init error:', err);
      hub.utils.showToast('Erro ao carregar a home', 'danger');
    } finally {
      hub.utils.hideLoader();
    }
  }

  // ==================================================================
  // GREETING
  // ==================================================================
  function renderGreeting() {
    var user = hub.auth.getUser();
    if (!user) return;

    var hour = new Date().getHours();
    var greeting;
    if (hour >= 5 && hour < 12) {
      greeting = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      greeting = 'Boa tarde';
    } else {
      greeting = 'Boa noite';
    }

    var displayName = user.apelido || user.nome;
    var el = document.getElementById('greeting');
    if (el) {
      el.textContent = greeting + ', ' + displayName + '!';
    }

    // Subtítulo com data atual
    var dateEl = document.getElementById('greeting-date');
    if (dateEl) {
      var now = new Date();
      var opts = { weekday: 'long', day: 'numeric', month: 'long' };
      dateEl.textContent = now.toLocaleDateString('pt-BR', opts);
    }
  }

  // ==================================================================
  // STATS CARDS
  // ==================================================================
  async function loadStats() {
    var results = await Promise.all([
      fetchMesasStat(),
      fetchSquadsStat(),
      fetchFormulariosStat()
    ]);

    var container = document.getElementById('stats-row');
    if (!container) return;

    container.innerHTML = results.join('');
  }

  async function fetchMesasStat() {
    try {
      // Get total active desks
      var desksResp = await hub.sb
        .from('desks')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      var totalDesks = desksResp.count || 0;

      // Get reservations for today (not canceled)
      var today = new Date().toISOString().split('T')[0];
      var reservResp = await hub.sb
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .is('canceled_at', null);

      var reserved = reservResp.count || 0;
      var available = Math.max(0, totalDesks - reserved);

      return buildStatCard({
        href: '/mesas/',
        icon: 'fa-chair',
        title: 'Mesas',
        number: available,
        label: 'vagas disponiveis hoje'
      });
    } catch (err) {
      console.error('Mesas stat error:', err);
      return buildStatCard({
        href: '/mesas/',
        icon: 'fa-chair',
        title: 'Mesas',
        label: 'Erro ao carregar'
      });
    }
  }

  async function fetchSquadsStat() {
    try {
      var user = hub.auth.getUser();
      var count = 0;

      if (user && user.id) {
        var resp = await hub.sb
          .from('squad_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        count = resp.count || 0;
      }

      return buildStatCard({
        href: '/squads/',
        icon: 'fa-layer-group',
        title: 'Squads',
        number: count,
        label: 'que voce participa'
      });
    } catch (err) {
      console.error('Squads stat error:', err);
      return buildStatCard({
        href: '/squads/',
        icon: 'fa-layer-group',
        title: 'Squads',
        label: 'Erro ao carregar'
      });
    }
  }

  async function fetchFormulariosStat() {
    try {
      var resp = await hub.sb
        .from('forms')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      var count = resp.count || 0;

      return buildStatCard({
        href: '/formularios/',
        icon: 'fa-file-lines',
        title: 'Formularios',
        number: count,
        label: 'disponiveis'
      });
    } catch (err) {
      console.error('Formularios stat error:', err);
      return buildStatCard({
        href: '/formularios/',
        icon: 'fa-file-lines',
        title: 'Formularios',
        label: 'Erro ao carregar'
      });
    }
  }

  function buildStatCard(opts) {
    var valueHtml = '';
    if (opts.number !== undefined) {
      var labelHtml = opts.label
        ? '<div class="stat-label-text">' + opts.label + '</div>'
        : '';
      valueHtml = '<div class="stat-value-row">' +
        '<div class="stat-number">' + opts.number + '</div>' +
        labelHtml +
      '</div>';
    } else if (opts.label) {
      valueHtml = '<div class="stat-label-text">' + opts.label + '</div>';
    }

    return '' +
      '<div class="col-md-4 mb-3">' +
        '<a href="' + opts.href + '" class="hub-card-link">' +
          '<div class="hub-card hub-stat-card animate-fadeIn">' +
            '<div class="stat-icon-wrap">' +
              '<i class="fa-solid ' + opts.icon + '"></i>' +
            '</div>' +
            '<div class="stat-body">' +
              '<div class="stat-title">' + opts.title + '</div>' +
              valueHtml +
            '</div>' +
          '</div>' +
        '</a>' +
      '</div>';
  }

  // ==================================================================
  // QUICK LINKS
  // ==================================================================
  async function loadQuickLinks() {
    var container = document.getElementById('quick-links-container');
    if (!container) return;

    try {
      var resp = await hub.sb
        .from('quick_links')
        .select('*')
        .eq('is_active', true)
        .order('ordem', { ascending: true });

      if (resp.error) throw resp.error;

      var links = resp.data || [];

      if (links.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum link rapido configurado. Admins podem adicionar via painel Admin.</p>';
        return;
      }

      // Group by secao
      var sections = {};
      links.forEach(function(link) {
        var secao = link.secao || 'Outros';
        if (!sections[secao]) sections[secao] = [];
        sections[secao].push(link);
      });

      var html = '';
      Object.keys(sections).forEach(function(secao) {
        html += '<div class="mb-4">';
        html += '<h5 class="hub-section-title mb-3">' + hub.utils.escapeHtml(secao) + '</h5>';
        html += '<div class="row">';

        sections[secao].forEach(function(link) {
          var icon = hub.utils.normalizeIcon(link.icone, 'fa-solid fa-link');
          html += '' +
            '<div class="col-12 col-sm-6 col-lg-4 mb-2">' +
              '<a href="' + hub.utils.escapeHtml(link.url) + '" target="_blank" class="hub-link-card animate-fadeIn">' +
                '<div class="link-icon-wrap" style="background:rgba(0,174,157,0.1);color:var(--turq);">' +
                  '<i class="' + icon + '"></i>' +
                '</div>' +
                '<span class="link-title">' + hub.utils.escapeHtml(link.titulo) + '</span>' +
                '<i class="fa-solid fa-arrow-up-right-from-square link-arrow"></i>' +
              '</a>' +
            '</div>';
        });

        html += '</div></div>';
      });

      container.innerHTML = html;
    } catch (err) {
      console.error('Quick links error:', err);
      hub.utils.showToast('Erro ao carregar links rapidos', 'danger');
    }
  }

  // ==================================================================
  // ANIVERSARIANTES
  // ==================================================================
  async function loadAllBirthdayUsers() {
    try {
      var resp = await hub.sb
        .from('users')
        .select('nome, apelido, aniversario, user_name')
        .eq('is_active', true)
        .not('aniversario', 'is', null);

      if (resp.error) throw resp.error;
      allBirthdayUsers = resp.data || [];
    } catch (err) {
      console.error('Birthday load error:', err);
      allBirthdayUsers = [];
    }
  }

  function getBirthdaysForMonth(month, year) {
    // month: 0-indexed JS month
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var monthStr = pad(month + 1); // convert to 1-indexed for DB (aniversario format: YYYY-MM-DD)

    return allBirthdayUsers
      .filter(function(u) {
        if (!u.aniversario) return false;
        var parts = u.aniversario.split('-');
        return parts.length >= 2 && parts[1] === monthStr;
      })
      .map(function(u) {
        var parts = u.aniversario.split('-');
        return {
          nome: u.apelido || u.nome || '',
          user_name: u.user_name || '',
          day: parseInt(parts[2], 10),
          month: parseInt(parts[1], 10) - 1, // back to 0-indexed
          year: parts[0] ? parseInt(parts[0], 10) : null
        };
      })
      .sort(function(a, b) { return a.day - b.day; });
  }

  function renderBirthdays() {
    var monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    var labelEl = document.getElementById('birthday-month-label');
    if (labelEl) labelEl.textContent = monthNames[currentBirthdayMonth];

    var listEl = document.getElementById('birthday-list');
    if (!listEl) return;

    var today = new Date();
    var todayDay   = today.getDate();
    var todayMonth = today.getMonth();

    var people = getBirthdaysForMonth(currentBirthdayMonth, currentBirthdayYear);

    if (people.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:0.875rem; margin:0;">Nenhum aniversariante este mês.</p>';
      return;
    }

    var html = '<ul class="birthday-list">';
    people.forEach(function(p) {
      var isToday = (currentBirthdayMonth === todayMonth && p.day === todayDay);
      var isFuture = (currentBirthdayMonth === todayMonth && p.day > todayDay);
      var dayPad = p.day < 10 ? '0' + p.day : '' + p.day;
      var monthPad = (p.month + 1) < 10 ? '0' + (p.month + 1) : '' + (p.month + 1);

      var todayClass = isToday ? ' birthday-today' : '';
      var todayIcon  = isToday ? ' <i class="fa-solid fa-cake-candles birthday-cake-icon"></i>' : '';
      var futureClass = isFuture ? ' birthday-future' : '';

      html += '<li class="birthday-item' + todayClass + futureClass + '">' +
        '<span class="birthday-day-badge">' + dayPad + '/' + monthPad + '</span>' +
        '<span class="birthday-name">' + hub.utils.escapeHtml(p.nome) + todayIcon + '</span>' +
      '</li>';
    });
    html += '</ul>';

    listEl.innerHTML = html;
  }

  function bindBirthdayNav() {
    var prevBtn = document.getElementById('birthday-prev');
    var nextBtn = document.getElementById('birthday-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        currentBirthdayMonth--;
        if (currentBirthdayMonth < 0) {
          currentBirthdayMonth = 11;
          currentBirthdayYear--;
        }
        renderBirthdays();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        currentBirthdayMonth++;
        if (currentBirthdayMonth > 11) {
          currentBirthdayMonth = 0;
          currentBirthdayYear++;
        }
        renderBirthdays();
      });
    }
  }

})();
