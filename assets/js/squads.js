/**
 * HUB MARKETING - Pagina de Squads
 * Lista squads com membros agrupados por coordenacao e nucleo.
 */
(function() {
  'use strict';

  // ====================================================================
  // STATE
  // ====================================================================
  var allSquads = [];
  var allCategories = [];
  var allMembers = [];       // raw squad_members rows
  var allUsers = [];          // users rows
  var orgStructure = [];      // org_structure rows
  var orgMap = {};            // id -> { id, nome, tipo, parent_id }
  var membersBySquad = {};    // squad_id -> [ { user, coordenacao_id, nucleo_id } ]
  var categoryMap = {};       // category id -> category object
  var activeCategory = null;  // null = all

  // ====================================================================
  // INIT - wait for hub:ready
  // ====================================================================
  document.addEventListener('hub:ready', function() {
    // Auth gate
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;

    // Bloqueia acesso com cadastro incompleto
    var u = hub.auth.getUser();
    if (u && !u.profileComplete) {
      document.getElementById('app-view').style.display = 'block';
      document.getElementById('app-view').innerHTML =
        '<div class="hub-profile-gate-page">' +
          '<i class="fa-solid fa-lock fa-2x mb-3" style="color:var(--turq);"></i>' +
          '<h5>Cadastro incompleto</h5>' +
          '<p class="text-muted">Complete seu cadastro para ver os Squads.</p>' +
          '<button class="btn btn-warning" onclick="hub.nav.openEditarPerfil()">' +
            '<i class="fa-solid fa-user-pen mr-1"></i>Completar Cadastro' +
          '</button>' +
        '</div>';
      hub.utils.hideLoader();
      return;
    }

    init();
  });

  async function init() {
    try {
      await loadData();
      buildLookups();
      renderCategoryButtons();
      bindEvents();
      applyFilters();
      showAppView();
    } catch (err) {
      console.error('Squads: init error', err);
      hub.utils.showToast('Erro ao carregar squads', 'error');
      hub.utils.hideLoader();
    }
  }

  // ====================================================================
  // DATA LOADING
  // ====================================================================
  async function loadData() {
    var categoriesPromise = hub.sb
      .from('squad_categories')
      .select('*')
      .eq('is_active', true)
      .order('nome', { ascending: true });

    var squadsPromise = hub.sb
      .from('squads')
      .select('*')
      .eq('is_active', true)
      .order('nome', { ascending: true });

    var membersPromise = hub.sb
      .from('squad_members')
      .select('*');

    var usersPromise = hub.sb
      .from('users')
      .select('*')
      .eq('is_active', true);

    var orgPromise = hub.sb
      .from('org_structure')
      .select('*')
      .order('nome', { ascending: true });

    var results = await Promise.all([
      categoriesPromise,
      squadsPromise,
      membersPromise,
      usersPromise,
      orgPromise
    ]);

    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    if (results[2].error) throw results[2].error;
    if (results[3].error) throw results[3].error;
    if (results[4].error) throw results[4].error;

    allCategories = results[0].data || [];
    allSquads = results[1].data || [];
    allMembers = results[2].data || [];
    allUsers = results[3].data || [];
    orgStructure = results[4].data || [];
  }

  // ====================================================================
  // BUILD LOOKUPS
  // ====================================================================
  function buildLookups() {
    // Org map: id -> row
    orgMap = {};
    for (var i = 0; i < orgStructure.length; i++) {
      var row = orgStructure[i];
      orgMap[row.id] = row;
    }

    // Category map: id -> category
    categoryMap = {};
    for (var i = 0; i < allCategories.length; i++) {
      categoryMap[allCategories[i].id] = allCategories[i];
    }

    // Users map: id -> user
    var usersMap = {};
    for (var i = 0; i < allUsers.length; i++) {
      usersMap[allUsers[i].id] = allUsers[i];
    }

    // Members by squad: squad_id -> [ user objects ]
    membersBySquad = {};
    for (var i = 0; i < allMembers.length; i++) {
      var m = allMembers[i];
      var user = usersMap[m.user_id];
      if (!user) continue; // skip if user not found or inactive

      if (!membersBySquad[m.squad_id]) {
        membersBySquad[m.squad_id] = [];
      }
      membersBySquad[m.squad_id].push(user);
    }
  }

  // ====================================================================
  // HELPERS
  // ====================================================================
  function getOrgName(id) {
    if (!id || !orgMap[id]) return '';
    return orgMap[id].nome || '';
  }

  function getCategoryForSquad(squad) {
    if (!squad.categoria_id) return null;
    return categoryMap[squad.categoria_id] || null;
  }

  /**
   * Group an array of user objects by coordenacao_id, then by nucleo_id.
   * Returns: [ { coordId, coordName, nucleos: [ { nucleoId, nucleoName, users: [...] } ] } ]
   */
  function groupMembersByOrg(members) {
    if (!members || members.length === 0) return [];

    // Group by coordenacao_id
    var coordGroups = {};
    var coordOrder = [];

    for (var i = 0; i < members.length; i++) {
      var u = members[i];
      var cId = u.coordenacao_id || '__none__';

      if (!coordGroups[cId]) {
        coordGroups[cId] = {};
        coordOrder.push(cId);
      }

      var nId = u.nucleo_id || '__none__';
      if (!coordGroups[cId][nId]) {
        coordGroups[cId][nId] = [];
      }
      coordGroups[cId][nId].push(u);
    }

    // Build structured result
    var result = [];
    for (var c = 0; c < coordOrder.length; c++) {
      var cId = coordOrder[c];
      var coordName = cId === '__none__' ? 'Sem coordenacao' : getOrgName(cId);
      var nucleoMap = coordGroups[cId];
      var nucleos = [];
      var nucleoIds = Object.keys(nucleoMap);

      for (var n = 0; n < nucleoIds.length; n++) {
        var nId = nucleoIds[n];
        var nucleoName = nId === '__none__' ? '' : getOrgName(nId);
        nucleos.push({
          nucleoId: nId,
          nucleoName: nucleoName,
          users: nucleoMap[nId]
        });
      }

      result.push({
        coordId: cId,
        coordName: coordName,
        nucleos: nucleos
      });
    }

    return result;
  }

  // ====================================================================
  // CATEGORY BUTTONS
  // ====================================================================
  function renderCategoryButtons() {
    var container = document.getElementById('category-buttons');
    if (!container) return;

    var html = '';

    // "Todos" button - always first
    html += '<button class="btn btn-sm btn-outline-primary squad-cat-btn active" data-category="">' +
      '<i class="fa-solid fa-border-all"></i> Todos</button>';

    for (var i = 0; i < allCategories.length; i++) {
      var cat = allCategories[i];
      var icon = normalizeIcon(cat.icone ? hub.utils.escapeHtml(cat.icone) : '');
      var nome = hub.utils.escapeHtml(cat.nome);
      var cor = hub.utils.escapeHtml(cat.cor || '#6c757d');

      html += '<button class="btn btn-sm btn-outline-secondary squad-cat-btn" ' +
        'data-category="' + cat.id + '" data-cor="' + cor + '">' +
        '<i class="' + icon + '"></i> ' + nome + '</button>';
    }

    container.innerHTML = html;
  }

  function setActiveCategory(catId) {
    activeCategory = catId || null;

    var buttons = document.querySelectorAll('.squad-cat-btn');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var btnCat = btn.getAttribute('data-category');
      var cor = btn.getAttribute('data-cor');

      if (btnCat === (catId || '')) {
        btn.classList.add('active');
        // Apply category color as active state
        if (cor) {
          btn.style.backgroundColor = cor;
          btn.style.borderColor = cor;
          btn.style.color = '#fff';
        } else {
          // "Todos" button - use primary style
          btn.classList.remove('btn-outline-secondary');
          btn.classList.add('btn-outline-primary', 'active');
          btn.style.backgroundColor = '';
          btn.style.borderColor = '';
          btn.style.color = '';
        }
      } else {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    }
  }

  // ====================================================================
  // FILTERING
  // ====================================================================
  function applyFilters() {
    var search = (document.getElementById('filter-search').value || '').toLowerCase().trim();
    var filtered = [];

    for (var i = 0; i < allSquads.length; i++) {
      var squad = allSquads[i];

      // Category filter (String coercion: categoria_id é int, activeCategory é string do data-category)
      if (activeCategory && String(squad.categoria_id) !== String(activeCategory)) continue;

      // Text search
      if (search) {
        var haystack = (squad.nome || '').toLowerCase() + ' ' +
          (squad.descricao || '').toLowerCase();

        // Also search member names
        var members = membersBySquad[squad.id] || [];
        for (var m = 0; m < members.length; m++) {
          haystack += ' ' + (members[m].nome || '').toLowerCase() +
            ' ' + (members[m].apelido || '').toLowerCase();
        }

        if (haystack.indexOf(search) === -1) continue;
      }

      filtered.push(squad);
    }

    renderGrid(filtered);
    updateResultsCount(filtered.length, allSquads.length);
  }

  // ====================================================================
  // GRID RENDERING
  // ====================================================================
  function renderGrid(squads) {
    var grid = document.getElementById('squads-grid');
    var emptyState = document.getElementById('empty-state');
    if (!grid) return;

    if (squads.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    var html = '';
    for (var i = 0; i < squads.length; i++) {
      html += renderCard(squads[i], i);
    }
    grid.innerHTML = html;
  }

  // Wrapper local para hub.utils.normalizeIcon com fallback de squad
  function normalizeIcon(icon) {
    return hub.utils.normalizeIcon(icon, 'fa-solid fa-users');
  }

  function renderCard(squad, index) {
    var esc = hub.utils.escapeHtml;
    var cat = getCategoryForSquad(squad);
    var catName = cat ? esc(cat.nome) : '';
    var catCor = cat ? esc(cat.cor || '#6c757d') : '#6c757d';
    var icon = normalizeIcon(squad.icone ? esc(squad.icone) : '');
    var nome = esc(squad.nome || '');
    var descricao = squad.descricao ? esc(squad.descricao) : '';

    // Members grouped by org
    var members = membersBySquad[squad.id] || [];
    var grouped = groupMembersByOrg(members);
    var membersHtml = renderMembersSection(grouped);

    // Wrike link
    var wrikeHtml = '';
    var squadLink = squad.link || squad.link_wrike;
    if (squadLink) {
      var linkLabel = squad.link_label || 'Link';
      wrikeHtml = '<div class="hub-card-footer">' +
        '<a href="' + esc(squadLink) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="btn btn-sm btn-secondary btn-icon">' +
        '<i class="fa-solid fa-external-link-alt"></i> ' + esc(linkLabel) + '</a></div>';
    }

    // Description
    var descHtml = descricao ?
      '<p class="squad-desc">' + descricao + '</p>' : '';

    return '' +
      '<div class="col-12 col-md-6 col-xl-4 mb-4">' +
        '<div class="hub-card animate-fadeIn" style="height:100%; display:flex; flex-direction:column;">' +
          '<div class="hub-card-header" style="display:flex; align-items:center; gap:0.75rem;">' +
            '<div style="width:36px; height:36px; border-radius:8px; background:' + catCor + '15; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
              '<i class="' + icon + '" style="color:' + catCor + '; font-size:1rem;"></i>' +
            '</div>' +
            '<div style="flex:1; min-width:0;">' +
              '<h6 class="squad-card-title">' + nome + '</h6>' +
              (catName ? '<span class="badge" style="background-color:' + catCor + '; color:#fff; font-size:0.7rem; font-weight:600;">' + catName + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="hub-card-body" style="flex:1;">' +
            descHtml +
            membersHtml +
          '</div>' +
          wrikeHtml +
        '</div>' +
      '</div>';
  }

  function renderMembersSection(grouped) {
    if (grouped.length === 0) {
      return '<p class="squad-members-empty">Nenhum membro atribuido</p>';
    }

    var html = '';
    for (var c = 0; c < grouped.length; c++) {
      var coordGroup = grouped[c];
      var coordName = hub.utils.escapeHtml(coordGroup.coordName || 'Sem coordenacao');

      html += '<div class="squad-coord-group">';
      html += '<div class="squad-coord-label">' +
        '<i class="fa-solid fa-sitemap squad-coord-icon"></i>' +
        coordName + '</div>';

      for (var n = 0; n < coordGroup.nucleos.length; n++) {
        var nucleoGroup = coordGroup.nucleos[n];
        var users = nucleoGroup.users;

        for (var u = 0; u < users.length; u++) {
          var user = users[u];
          var displayName = hub.utils.escapeHtml(user.apelido || user.nome || '');
          var nucleoLabel = nucleoGroup.nucleoName ?
            ' <span class="squad-nucleo-label">(' + hub.utils.escapeHtml(nucleoGroup.nucleoName) + ')</span>' : '';
          var nameHtml = user.user_name
            ? '<a href="' + hub.config.basePath + '/perfil/?u=' + hub.utils.escapeHtml(user.user_name) + '" class="squad-member-link">' + displayName + '</a>'
            : displayName;

          html += '<div class="squad-member-row">' + nameHtml + nucleoLabel + '</div>';
        }
      }

      html += '</div>';
    }

    return html;
  }

  function updateResultsCount(shown, total) {
    var el = document.getElementById('results-count');
    if (!el) return;
    el.textContent = 'Mostrando ' + shown + ' de ' + total + ' squads';
  }

  // ====================================================================
  // UI HELPERS
  // ====================================================================
  function showAppView() {
    hub.utils.hideLoader();
    var appView = document.getElementById('app-view');
    if (appView) appView.style.display = 'block';
  }

  // ====================================================================
  // EVENT BINDINGS
  // ====================================================================
  function bindEvents() {
    // Search with debounce
    var searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('input', hub.utils.debounce(function() {
        applyFilters();
      }, 250));
    }

    // Category button clicks (event delegation)
    var catContainer = document.getElementById('category-buttons');
    if (catContainer) {
      catContainer.addEventListener('click', function(e) {
        var btn = e.target.closest('.squad-cat-btn');
        if (!btn) return;
        var catId = btn.getAttribute('data-category');
        setActiveCategory(catId || null);
        applyFilters();
      });
    }

    // Clear filters button
    var btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
      btnClear.addEventListener('click', function() {
        var searchInput = document.getElementById('filter-search');
        if (searchInput) searchInput.value = '';
        setActiveCategory(null);
        applyFilters();
      });
    }
  }

})();
