/**
 * HUB MARKETING - Pagina de Usuarios
 * Lista, filtra e gerencia usuarios do marketing.
 */
(function() {
  'use strict';

  // ====================================================================
  // STATE
  // ====================================================================
  var allUsers = [];
  var orgStructure = []; // all rows from org_structure
  var orgMap = {};        // id -> { id, nome, tipo, parent_id }
  var filteredUsers = [];
  var sortColumn = 'nome';
  var sortAsc = true;

  // ====================================================================
  // INIT - wait for hub:ready
  // ====================================================================
  document.addEventListener('hub:ready', function() {
    // Auth gate
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;

    init();
  });

  async function init() {
    try {
      await loadData();
      populateFilterDropdowns();
      bindEvents();
      applyFilters();
      checkProfileBanner();
      showAppView();
    } catch (err) {
      console.error('Usuarios: init error', err);
      hub.utils.showToast('Erro ao carregar usuarios', 'error');
      hub.utils.hideLoader();
    }
  }

  // ====================================================================
  // DATA LOADING
  // ====================================================================
  async function loadData() {
    // Fetch users and org_structure in parallel
    var usersPromise = hub.sb
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('nome', { ascending: true });

    var orgPromise = hub.sb
      .from('org_structure')
      .select('*')
      .order('nome', { ascending: true });

    var results = await Promise.all([usersPromise, orgPromise]);

    var usersResp = results[0];
    var orgResp = results[1];

    if (usersResp.error) throw usersResp.error;
    if (orgResp.error) throw orgResp.error;

    allUsers = usersResp.data || [];
    orgStructure = orgResp.data || [];

    // Build lookup map
    orgMap = {};
    for (var i = 0; i < orgStructure.length; i++) {
      var row = orgStructure[i];
      orgMap[row.id] = row;
    }
  }

  // ====================================================================
  // HELPERS
  // ====================================================================
  function getOrgName(id) {
    if (!id || !orgMap[id]) return '-';
    return orgMap[id].nome || '-';
  }

  function getOrgsByType(tipo) {
    return orgStructure.filter(function(row) {
      return row.tipo === tipo;
    });
  }

  function getOrgsByTypeAndParent(tipo, parentId) {
    if (!parentId) return [];
    return orgStructure.filter(function(row) {
      return row.tipo === tipo && row.parent_id === parentId;
    });
  }

  // ====================================================================
  // FILTER DROPDOWNS (page filters)
  // ====================================================================
  function populateFilterDropdowns() {
    var gerencias = getOrgsByType('gerencia');
    var selGerencia = document.getElementById('filter-gerencia');

    selGerencia.innerHTML = '<option value="">Todas</option>';
    for (var i = 0; i < gerencias.length; i++) {
      selGerencia.innerHTML += '<option value="' + gerencias[i].id + '">' +
        hub.utils.escapeHtml(gerencias[i].nome) + '</option>';
    }

    // Reset coord and nucleo
    resetFilterCoord();
    resetFilterNucleo();

    // Populate bairro filter with unique values from data
    populateBairroFilter();
  }

  function updateFilterCoord() {
    var gerenciaId = document.getElementById('filter-gerencia').value;
    var selCoord = document.getElementById('filter-coordenacao');

    if (!gerenciaId) {
      resetFilterCoord();
      resetFilterNucleo();
      return;
    }

    var coords = getOrgsByTypeAndParent('coordenacao', gerenciaId);
    selCoord.innerHTML = '<option value="">Todas</option>';
    for (var i = 0; i < coords.length; i++) {
      selCoord.innerHTML += '<option value="' + coords[i].id + '">' +
        hub.utils.escapeHtml(coords[i].nome) + '</option>';
    }

    resetFilterNucleo();
  }

  function updateFilterNucleo() {
    var coordId = document.getElementById('filter-coordenacao').value;
    var selNucleo = document.getElementById('filter-nucleo');

    if (!coordId) {
      resetFilterNucleo();
      return;
    }

    var nucleos = getOrgsByTypeAndParent('nucleo', coordId);
    selNucleo.innerHTML = '<option value="">Todos</option>';
    for (var i = 0; i < nucleos.length; i++) {
      selNucleo.innerHTML += '<option value="' + nucleos[i].id + '">' +
        hub.utils.escapeHtml(nucleos[i].nome) + '</option>';
    }
  }

  function resetFilterCoord() {
    var sel = document.getElementById('filter-coordenacao');
    sel.innerHTML = '<option value="">Todas</option>';
    sel.value = '';
  }

  function resetFilterNucleo() {
    var sel = document.getElementById('filter-nucleo');
    sel.innerHTML = '<option value="">Todos</option>';
    sel.value = '';
  }

  function populateBairroFilter() {
    var sel = document.getElementById('filter-bairro');
    if (!sel) return;

    // Collect unique non-empty bairros, sorted alphabetically
    var bairros = [];
    for (var i = 0; i < allUsers.length; i++) {
      var b = (allUsers[i].bairro || '').trim();
      if (b && bairros.indexOf(b) === -1) {
        bairros.push(b);
      }
    }
    bairros.sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });

    sel.innerHTML = '<option value="">Todos</option>';
    for (var j = 0; j < bairros.length; j++) {
      sel.innerHTML += '<option value="' + hub.utils.escapeHtml(bairros[j]) + '">' +
        hub.utils.escapeHtml(bairros[j]) + '</option>';
    }
  }

  // ====================================================================
  // FILTERING & SORTING
  // ====================================================================
  function applyFilters() {
    var search = (document.getElementById('filter-search').value || '').toLowerCase().trim();
    var gerenciaId = document.getElementById('filter-gerencia').value;
    var coordId = document.getElementById('filter-coordenacao').value;
    var nucleoId = document.getElementById('filter-nucleo').value;
    var bairroFilter = (document.getElementById('filter-bairro') ? document.getElementById('filter-bairro').value : '').toLowerCase();

    filteredUsers = allUsers.filter(function(u) {
      // Text search
      if (search) {
        var haystack = [
          (u.nome || ''),
          (u.apelido || ''),
          (u.user_name || ''),
          (u.email || ''),
          (u.bairro || '')
        ].join(' ').toLowerCase();

        if (haystack.indexOf(search) === -1) return false;
      }

      // Gerencia filter
      if (gerenciaId && u.gerencia_id !== gerenciaId) return false;

      // Coordenacao filter
      if (coordId && u.coordenacao_id !== coordId) return false;

      // Nucleo filter
      if (nucleoId && u.nucleo_id !== nucleoId) return false;

      // Bairro filter
      if (bairroFilter && (u.bairro || '').toLowerCase() !== bairroFilter) return false;

      return true;
    });

    // Apply sort
    sortUsers();

    // Render
    renderTable();
    updateResultsCount();
  }

  function sortUsers() {
    var col = sortColumn;
    var asc = sortAsc;

    filteredUsers.sort(function(a, b) {
      var valA = '';
      var valB = '';

      if (col === 'gerencia') {
        valA = getOrgName(a.gerencia_id).toLowerCase();
        valB = getOrgName(b.gerencia_id).toLowerCase();
      } else if (col === 'coordenacao') {
        valA = getOrgName(a.coordenacao_id).toLowerCase();
        valB = getOrgName(b.coordenacao_id).toLowerCase();
      } else if (col === 'nucleo') {
        valA = getOrgName(a.nucleo_id).toLowerCase();
        valB = getOrgName(b.nucleo_id).toLowerCase();
      } else if (col === 'data_nascimento') {
        valA = a.data_nascimento || '';
        valB = b.data_nascimento || '';
      } else if (col === 'bairro') {
        valA = (a.bairro || '').toLowerCase();
        valB = (b.bairro || '').toLowerCase();
      } else {
        valA = (a[col] || '').toLowerCase();
        valB = (b[col] || '').toLowerCase();
      }

      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
  }

  // ====================================================================
  // TABLE RENDERING
  // ====================================================================
  function renderTable() {
    var tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (filteredUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">' +
        'Nenhum usuario encontrado</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < filteredUsers.length; i++) {
      var u = filteredUsers[i];
      html += '<tr>' +
        '<td>' + hub.utils.escapeHtml(u.nome || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.apelido || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.user_name || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(getOrgName(u.gerencia_id)) + '</td>' +
        '<td>' + hub.utils.escapeHtml(getOrgName(u.coordenacao_id)) + '</td>' +
        '<td>' + hub.utils.escapeHtml(getOrgName(u.nucleo_id)) + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.email || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.telefone || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.data_nascimento ? hub.utils.formatDate(u.data_nascimento) : '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.endereco || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.bairro || '-') + '</td>' +
        '<td>' + (u.is_terceirizado ? '<span class="hub-badge hub-badge-warning">Sim</span>' : '<span class="hub-badge hub-badge-success">Nao</span>') + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;
  }

  function updateResultsCount() {
    var el = document.getElementById('results-count');
    if (!el) return;
    el.textContent = 'Mostrando ' + filteredUsers.length + ' de ' + allUsers.length + ' usuarios';
  }

  // ====================================================================
  // COLUMN SORTING
  // ====================================================================
  function handleSort(col) {
    if (sortColumn === col) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = col;
      sortAsc = true;
    }

    // Update sort icons
    var headers = document.querySelectorAll('.hub-table th[data-sort]');
    for (var i = 0; i < headers.length; i++) {
      var icon = headers[i].querySelector('i');
      if (!icon) continue;
      if (headers[i].getAttribute('data-sort') === col) {
        icon.className = sortAsc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
      } else {
        icon.className = 'fa-solid fa-sort';
      }
    }

    sortUsers();
    renderTable();
  }

  // ====================================================================
  // COPY EMAILS
  // ====================================================================
  function copyEmails() {
    var emails = filteredUsers
      .map(function(u) { return u.email; })
      .filter(function(e) { return e && e.trim() !== ''; });

    if (emails.length === 0) {
      hub.utils.showToast('Nenhum email para copiar', 'warning');
      return;
    }

    var text = emails.join('; ');
    hub.utils.copyToClipboard(text);
  }

  // ====================================================================
  // PROFILE COMPLETE
  // ====================================================================
  function checkProfileBanner() {
    var user = hub.auth.getUser();
    if (!user) return;

    if (user.profileComplete === false) {
      var banner = document.getElementById('profile-banner');
      if (banner) banner.classList.remove('d-none');
    }
  }

  function openProfileModal() {
    populateProfileDropdowns();
    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.classList.add('show');
  }

  function populateProfileDropdowns() {
    var user = hub.auth.getUser();
    var gerencias = getOrgsByType('gerencia');

    // Gerencia
    var selGer = document.getElementById('profile-gerencia');
    selGer.innerHTML = '<option value="">Selecione...</option>';
    for (var i = 0; i < gerencias.length; i++) {
      var selected = (user && user.gerencia_id === gerencias[i].id) ? ' selected' : '';
      selGer.innerHTML += '<option value="' + gerencias[i].id + '"' + selected + '>' +
        hub.utils.escapeHtml(gerencias[i].nome) + '</option>';
    }

    // Trigger cascading updates
    updateProfileCoord();
  }

  function updateProfileCoord() {
    var gerenciaId = document.getElementById('profile-gerencia').value;
    var selCoord = document.getElementById('profile-coordenacao');
    var user = hub.auth.getUser();

    if (!gerenciaId) {
      selCoord.innerHTML = '<option value="">Selecione a gerencia primeiro</option>';
      updateProfileNucleo();
      return;
    }

    var coords = getOrgsByTypeAndParent('coordenacao', gerenciaId);
    selCoord.innerHTML = '<option value="">Selecione...</option>';
    for (var i = 0; i < coords.length; i++) {
      var selected = (user && user.coordenacao_id === coords[i].id) ? ' selected' : '';
      selCoord.innerHTML += '<option value="' + coords[i].id + '"' + selected + '>' +
        hub.utils.escapeHtml(coords[i].nome) + '</option>';
    }

    updateProfileNucleo();
  }

  function updateProfileNucleo() {
    var coordId = document.getElementById('profile-coordenacao').value;
    var selNucleo = document.getElementById('profile-nucleo');
    var user = hub.auth.getUser();

    if (!coordId) {
      selNucleo.innerHTML = '<option value="">Nenhum (ainda nao definido)</option>';
      return;
    }

    var nucleos = getOrgsByTypeAndParent('nucleo', coordId);
    selNucleo.innerHTML = '<option value="">Nenhum (ainda nao definido)</option>';
    for (var i = 0; i < nucleos.length; i++) {
      var selected = (user && user.nucleo_id === nucleos[i].id) ? ' selected' : '';
      selNucleo.innerHTML += '<option value="' + nucleos[i].id + '"' + selected + '>' +
        hub.utils.escapeHtml(nucleos[i].nome) + '</option>';
    }
  }

  async function saveProfile() {
    var user = hub.auth.getUser();
    if (!user || !user.id) {
      hub.utils.showToast('Erro: usuario nao identificado', 'error');
      return;
    }

    var gerenciaId = document.getElementById('profile-gerencia').value || null;
    var coordId = document.getElementById('profile-coordenacao').value || null;
    var nucleoId = document.getElementById('profile-nucleo').value || null;

    if (!gerenciaId || !coordId) {
      hub.utils.showToast('Selecione pelo menos a gerencia e coordenacao', 'warning');
      return;
    }

    var resp = await hub.sb
      .from('users')
      .update({
        gerencia_id: gerenciaId,
        coordenacao_id: coordId,
        nucleo_id: nucleoId,
        profile_complete: true
      })
      .eq('id', user.id);

    if (resp.error) {
      console.error('Profile save error:', resp.error);
      hub.utils.showToast('Erro ao salvar perfil', 'error');
      return;
    }

    hub.utils.showToast('Perfil atualizado com sucesso!', 'success');

    // Close modal
    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.classList.remove('show');

    // Clear cache and reload to refresh user data
    localStorage.removeItem('hub_cached_user');
    localStorage.removeItem('hub_cached_role');
    localStorage.removeItem('hub_cached_source');
    window.location.reload();
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

    // Gerencia filter change -> update coord, then refilter
    var selGerencia = document.getElementById('filter-gerencia');
    if (selGerencia) {
      selGerencia.addEventListener('change', function() {
        updateFilterCoord();
        applyFilters();
      });
    }

    // Coordenacao filter change -> update nucleo, then refilter
    var selCoord = document.getElementById('filter-coordenacao');
    if (selCoord) {
      selCoord.addEventListener('change', function() {
        updateFilterNucleo();
        applyFilters();
      });
    }

    // Nucleo filter change -> refilter
    var selNucleo = document.getElementById('filter-nucleo');
    if (selNucleo) {
      selNucleo.addEventListener('change', function() {
        applyFilters();
      });
    }

    // Bairro filter change -> refilter
    var selBairro = document.getElementById('filter-bairro');
    if (selBairro) {
      selBairro.addEventListener('change', function() {
        applyFilters();
      });
    }

    // Column sorting
    var sortHeaders = document.querySelectorAll('.hub-table th[data-sort]');
    for (var i = 0; i < sortHeaders.length; i++) {
      (function(header) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
          var col = header.getAttribute('data-sort');
          if (col) handleSort(col);
        });
      })(sortHeaders[i]);
    }

    // Copy emails button
    var btnCopy = document.getElementById('btn-copy-emails');
    if (btnCopy) {
      btnCopy.addEventListener('click', copyEmails);
    }

    // Profile banner button
    var btnProfile = document.getElementById('btn-complete-profile');
    if (btnProfile) {
      btnProfile.addEventListener('click', openProfileModal);
    }

    // Profile modal - gerencia change
    var profileGerencia = document.getElementById('profile-gerencia');
    if (profileGerencia) {
      profileGerencia.addEventListener('change', updateProfileCoord);
    }

    // Profile modal - coordenacao change
    var profileCoord = document.getElementById('profile-coordenacao');
    if (profileCoord) {
      profileCoord.addEventListener('change', updateProfileNucleo);
    }

    // Profile modal - save button
    var btnSave = document.getElementById('btn-save-profile');
    if (btnSave) {
      btnSave.addEventListener('click', saveProfile);
    }
  }

})();
