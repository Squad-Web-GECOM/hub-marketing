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
  async function init() {
    try {
      hub.utils.showLoader();

      renderGreeting();

      // Fetch stats and quick links in parallel
      await Promise.all([
        loadStats(),
        loadQuickLinks()
      ]);

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
        color: 'var(--turq)',
        title: 'Mesas',
        text: available + ' vagas hoje'
      });
    } catch (err) {
      console.error('Mesas stat error:', err);
      return buildStatCard({
        href: '/mesas/',
        icon: 'fa-chair',
        color: 'var(--turq)',
        title: 'Mesas',
        text: 'Erro ao carregar'
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
        color: 'var(--verdee)',
        title: 'Squads',
        text: 'Voce participa de ' + count + ' squads'
      });
    } catch (err) {
      console.error('Squads stat error:', err);
      return buildStatCard({
        href: '/squads/',
        icon: 'fa-layer-group',
        color: 'var(--verdee)',
        title: 'Squads',
        text: 'Erro ao carregar'
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
        color: 'var(--verdem)',
        title: 'Formularios',
        text: count + ' formularios disponiveis'
      });
    } catch (err) {
      console.error('Formularios stat error:', err);
      return buildStatCard({
        href: '/formularios/',
        icon: 'fa-file-lines',
        color: 'var(--verdem)',
        title: 'Formularios',
        text: 'Erro ao carregar'
      });
    }
  }

  function buildStatCard(opts) {
    // bg do ícone: 10% de opacidade da cor do acento
    var iconBg = opts.color.replace('var(--turq)', 'rgba(0,174,157,0.1)')
                          .replace('var(--verdee)', 'rgba(0,54,65,0.1)')
                          .replace('var(--verdem)', 'rgba(125,182,28,0.1)');

    return '' +
      '<div class="col-md-4 mb-3">' +
        '<a href="' + opts.href + '" class="hub-card-link">' +
          '<div class="hub-card hub-stat-card animate-fadeIn" style="border-left-color:' + opts.color + ';">' +
            '<div class="stat-icon-wrap" style="background:' + iconBg + ';color:' + opts.color + ';">' +
              '<i class="fa-solid ' + opts.icon + '"></i>' +
            '</div>' +
            '<div class="stat-body">' +
              '<div class="stat-title">' + opts.title + '</div>' +
              '<div class="stat-value">' + opts.text + '</div>' +
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
          var icon = hub.utils.escapeHtml(link.icone || 'fa-link');
          html += '' +
            '<div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-2">' +
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

})();
