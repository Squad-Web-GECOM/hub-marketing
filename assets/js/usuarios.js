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

    // Bloqueia acesso com cadastro incompleto
    var u = hub.auth.getUser();
    if (u && !u.profileComplete) {
      document.getElementById('app-view').style.display = 'block';
      document.getElementById('app-view').innerHTML =
        '<div class="hub-profile-gate-page">' +
          '<i class="fa-solid fa-lock fa-2x mb-3" style="color:var(--turq);"></i>' +
          '<h5>Cadastro incompleto</h5>' +
          '<p class="text-muted">Complete seu cadastro para ver os Usuários.</p>' +
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
      populateFilterDropdowns();
      bindEvents();
      applyFilters();
      checkProfileBanner();
      showAppView();

      // Auto-abre modal se veio de outro page via ?perfil=1
      var urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('perfil') === '1') {
        // Remove o param da URL sem reload
        try {
          var cleanUrl = window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        } catch(e) {}
        setTimeout(function() { openProfileModal(); }, 200);
      }
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

    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;

    allUsers = results[0].data || [];
    orgStructure = results[1].data || [];

    orgMap = {};
    for (var i = 0; i < orgStructure.length; i++) {
      orgMap[orgStructure[i].id] = orgStructure[i];
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
    return orgStructure.filter(function(row) { return row.tipo === tipo; });
  }

  function getOrgsByTypeAndParent(tipo, parentId) {
    if (!parentId) return [];
    return orgStructure.filter(function(row) {
      return row.tipo === tipo && String(row.parent_id) === String(parentId);
    });
  }

  // ====================================================================
  // FILTER DROPDOWNS (page filters)
  // ====================================================================
  function populateFilterDropdowns() {
    var gerencias = getOrgsByType('gerencia');
    var selGerencia = document.getElementById('filter-gerencia');
    selGerencia.innerHTML = '<option value="">Todas</option>';
    gerencias.forEach(function(g) {
      selGerencia.innerHTML += '<option value="' + g.id + '">' + hub.utils.escapeHtml(g.nome) + '</option>';
    });
    resetFilterCoord();
    resetFilterNucleo();
    populateBairroFilter();
  }

  function updateFilterCoord() {
    var gerenciaId = document.getElementById('filter-gerencia').value;
    var selCoord = document.getElementById('filter-coordenacao');
    if (!gerenciaId) { resetFilterCoord(); resetFilterNucleo(); return; }
    var coords = getOrgsByTypeAndParent('coordenacao', gerenciaId);
    selCoord.innerHTML = '<option value="">Todas</option>';
    coords.forEach(function(c) {
      selCoord.innerHTML += '<option value="' + c.id + '">' + hub.utils.escapeHtml(c.nome) + '</option>';
    });
    resetFilterNucleo();
  }

  function updateFilterNucleo() {
    var coordId = document.getElementById('filter-coordenacao').value;
    var selNucleo = document.getElementById('filter-nucleo');
    if (!coordId) { resetFilterNucleo(); return; }
    var nucleos = getOrgsByTypeAndParent('nucleo', coordId);
    selNucleo.innerHTML = '<option value="">Todos</option>';
    nucleos.forEach(function(n) {
      selNucleo.innerHTML += '<option value="' + n.id + '">' + hub.utils.escapeHtml(n.nome) + '</option>';
    });
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
    var bairros = [];
    allUsers.forEach(function(u) {
      var b = (u.bairro || '').trim();
      if (b && bairros.indexOf(b) === -1) bairros.push(b);
    });
    bairros.sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });
    sel.innerHTML = '<option value="">Todos</option>';
    bairros.forEach(function(b) {
      sel.innerHTML += '<option value="' + hub.utils.escapeHtml(b) + '">' + hub.utils.escapeHtml(b) + '</option>';
    });
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
      if (search) {
        var haystack = [(u.nome || ''), (u.apelido || ''), (u.user_name || ''), (u.email || ''), (u.bairro || '')].join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      if (gerenciaId && String(u.gerencia_id) !== String(gerenciaId)) return false;
      if (coordId && String(u.coordenacao_id) !== String(coordId)) return false;
      if (nucleoId && String(u.nucleo_id) !== String(nucleoId)) return false;
      if (bairroFilter && (u.bairro || '').toLowerCase() !== bairroFilter) return false;
      return true;
    });

    sortUsers();
    renderTable();
    updateResultsCount();
  }

  function sortUsers() {
    var col = sortColumn;
    var asc = sortAsc;
    filteredUsers.sort(function(a, b) {
      var valA = '', valB = '';
      if (col === 'gerencia') { valA = getOrgName(a.gerencia_id).toLowerCase(); valB = getOrgName(b.gerencia_id).toLowerCase(); }
      else if (col === 'coordenacao') { valA = getOrgName(a.coordenacao_id).toLowerCase(); valB = getOrgName(b.coordenacao_id).toLowerCase(); }
      else if (col === 'nucleo') { valA = getOrgName(a.nucleo_id).toLowerCase(); valB = getOrgName(b.nucleo_id).toLowerCase(); }
      else if (col === 'data_nascimento') { valA = a.aniversario || ''; valB = b.aniversario || ''; }
      else if (col === 'bairro') { valA = (a.bairro || '').toLowerCase(); valB = (b.bairro || '').toLowerCase(); }
      else { valA = (a[col] || '').toLowerCase(); valB = (b[col] || '').toLowerCase(); }
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
      tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Nenhum usuario encontrado</td></tr>';
      return;
    }
    var html = '';
    filteredUsers.forEach(function(u) {
      html += '<tr>' +
        '<td>' + (u.user_name ? '<a href="' + hub.config.basePath + '/perfil/?u=' + hub.utils.escapeHtml(u.user_name) + '">' + hub.utils.escapeHtml(u.nome || '-') + '</a>' : hub.utils.escapeHtml(u.nome || '-')) + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.apelido || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.user_name || '-') + '</td>' +
        '<td class="td-truncate">' + hub.utils.escapeHtml(getOrgName(u.gerencia_id)) + '</td>' +
        '<td class="td-truncate">' + hub.utils.escapeHtml(getOrgName(u.coordenacao_id)) + '</td>' +
        '<td class="td-truncate">' + hub.utils.escapeHtml(getOrgName(u.nucleo_id)) + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.email || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.telefone || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.aniversario ? hub.utils.formatDate(u.aniversario) : '-') + '</td>' +
        '<td class="td-truncate">' + hub.utils.escapeHtml(u.endereco || '-') + '</td>' +
        '<td>' + hub.utils.escapeHtml(u.bairro || '-') + '</td>' +
        '<td>' + (u.terceirizado ? '<span class="hub-badge hub-badge-warning">Sim</span>' : '<span class="hub-badge hub-badge-success">Nao</span>') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  function updateResultsCount() {
    var el = document.getElementById('results-count');
    if (el) el.textContent = 'Mostrando ' + filteredUsers.length + ' de ' + allUsers.length + ' usuarios';
  }

  // ====================================================================
  // COLUMN SORTING
  // ====================================================================
  function handleSort(col) {
    if (sortColumn === col) { sortAsc = !sortAsc; } else { sortColumn = col; sortAsc = true; }
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
    var emails = filteredUsers.map(function(u) { return u.email; }).filter(function(e) { return e && e.trim(); });
    if (emails.length === 0) { hub.utils.showToast('Nenhum email para copiar', 'warning'); return; }
    hub.utils.copyToClipboard(emails.join('; '));
  }

  // ====================================================================
  // PROFILE BANNER
  // ====================================================================
  function checkProfileBanner() {
    var user = hub.auth.getUser();
    if (!user) return;
    if (!user.profileComplete) {
      var banner = document.getElementById('profile-banner');
      if (banner) banner.classList.remove('d-none');
    }
  }

  // ====================================================================
  // PROFILE MODAL — abertura e populacao
  // ====================================================================
  function openProfileModal() {
    var user = hub.auth.getUser();
    if (!user) return;

    // Titulo dinamico
    var title = document.getElementById('profile-modal-title');
    if (title) title.textContent = user.profileComplete ? 'Editar Perfil' : 'Complete seu Cadastro';

    // Preencher campos pessoais
    var nomeEl = document.getElementById('profile-nome');
    if (nomeEl) nomeEl.value = user.nome || '';

    var apelidoEl = document.getElementById('profile-apelido');
    if (apelidoEl) apelidoEl.value = user.apelido || '';

    var telEl = document.getElementById('profile-telefone');
    if (telEl) telEl.value = user.telefone || '';

    var aniEl = document.getElementById('profile-aniversario');
    if (aniEl) aniEl.value = user.aniversario || '';

    var endEl = document.getElementById('profile-endereco');
    if (endEl) endEl.value = user.endereco || '';

    var bairroEl = document.getElementById('profile-bairro');
    if (bairroEl) bairroEl.value = user.bairro || '';

    var cepEl = document.getElementById('profile-cep');
    if (cepEl) cepEl.value = user.cep || '';

    // Preencher dropdowns org
    populateProfileDropdowns();

    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.classList.add('show');
  }

  function populateProfileDropdowns() {
    var user = hub.auth.getUser();
    var gerencias = getOrgsByType('gerencia');

    var selGer = document.getElementById('profile-gerencia');
    selGer.innerHTML = '<option value="">Selecione...</option>';
    gerencias.forEach(function(g) {
      var sel = (user && String(user.gerencia_id) === String(g.id)) ? ' selected' : '';
      selGer.innerHTML += '<option value="' + g.id + '"' + sel + '>' + hub.utils.escapeHtml(g.nome) + '</option>';
    });

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
    coords.forEach(function(c) {
      var sel = (user && String(user.coordenacao_id) === String(c.id)) ? ' selected' : '';
      selCoord.innerHTML += '<option value="' + c.id + '"' + sel + '>' + hub.utils.escapeHtml(c.nome) + '</option>';
    });

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
    nucleos.forEach(function(n) {
      var sel = (user && String(user.nucleo_id) === String(n.id)) ? ' selected' : '';
      selNucleo.innerHTML += '<option value="' + n.id + '"' + sel + '>' + hub.utils.escapeHtml(n.nome) + '</option>';
    });
  }

  // ====================================================================
  // SALVAR PERFIL
  // ====================================================================
  async function saveProfile() {
    var user = hub.auth.getUser();
    if (!user || !user.id) {
      hub.utils.showToast('Erro: usuario nao identificado', 'error');
      return;
    }

    var gerenciaId = document.getElementById('profile-gerencia').value || null;
    var coordId = document.getElementById('profile-coordenacao').value || null;
    var nucleoId = document.getElementById('profile-nucleo').value || null;
    var apelido = (document.getElementById('profile-apelido').value || '').trim();
    var telefone = (document.getElementById('profile-telefone').value || '').trim();
    var aniversario = document.getElementById('profile-aniversario').value || null;
    var endereco = (document.getElementById('profile-endereco').value || '').trim();
    var bairro = (document.getElementById('profile-bairro').value || '').trim();
    var cep = (document.getElementById('profile-cep').value || '').trim();

    if (!gerenciaId || !coordId) {
      hub.utils.showToast('Selecione pelo menos a gerencia e a coordenacao', 'warning');
      return;
    }

    var updates = {
      gerencia_id: gerenciaId,
      coordenacao_id: coordId,
      nucleo_id: nucleoId,
      apelido: apelido || null,
      telefone: telefone || null,
      aniversario: aniversario,
      endereco: endereco || null,
      bairro: bairro || null,
      cep: cep || null,
      profile_complete: true
    };

    var btnSave = document.getElementById('btn-save-profile');
    if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Salvando...'; }

    var resp = await hub.sb.from('users').update(updates).eq('id', user.id);

    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Salvar'; }

    if (resp.error) {
      hub.utils.showToast('Erro ao salvar perfil: ' + resp.error.message, 'error');
      return;
    }

    hub.utils.showToast('Perfil atualizado com sucesso!', 'success');

    // Fecha o modal
    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.classList.remove('show');

    // Invalida cache forçando re-fetch no próximo load
    try {
      localStorage.removeItem('hub_cached_user');
      localStorage.removeItem('hub_cached_role');
      localStorage.removeItem('hub_cached_source');
    } catch(e) {}

    // Recarrega a pagina para atualizar sidebar e dados
    setTimeout(function() { window.location.reload(); }, 600);
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
    // Search
    var searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.addEventListener('input', hub.utils.debounce(applyFilters, 250));

    // Gerencia filter
    var selGer = document.getElementById('filter-gerencia');
    if (selGer) selGer.addEventListener('change', function() { updateFilterCoord(); applyFilters(); });

    // Coordenacao filter
    var selCoord = document.getElementById('filter-coordenacao');
    if (selCoord) selCoord.addEventListener('change', function() { updateFilterNucleo(); applyFilters(); });

    // Nucleo filter
    var selNucleo = document.getElementById('filter-nucleo');
    if (selNucleo) selNucleo.addEventListener('change', applyFilters);

    // Bairro filter
    var selBairro = document.getElementById('filter-bairro');
    if (selBairro) selBairro.addEventListener('change', applyFilters);

    // Column sorting
    var sortHeaders = document.querySelectorAll('.hub-table th[data-sort]');
    sortHeaders.forEach(function(header) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', function() {
        var col = header.getAttribute('data-sort');
        if (col) handleSort(col);
      });
    });

    // Copy emails
    var btnCopy = document.getElementById('btn-copy-emails');
    if (btnCopy) btnCopy.addEventListener('click', copyEmails);

    // Profile banner button
    var btnProfile = document.getElementById('btn-complete-profile');
    if (btnProfile) btnProfile.addEventListener('click', openProfileModal);

    // Profile modal cascading dropdowns
    var profileGer = document.getElementById('profile-gerencia');
    if (profileGer) profileGer.addEventListener('change', updateProfileCoord);

    var profileCoord = document.getElementById('profile-coordenacao');
    if (profileCoord) profileCoord.addEventListener('change', updateProfileNucleo);

    // Profile modal save
    var btnSave = document.getElementById('btn-save-profile');
    if (btnSave) btnSave.addEventListener('click', saveProfile);

    // Profile modal close/cancel
    var btnClose = document.getElementById('btn-close-profile-modal');
    if (btnClose) btnClose.addEventListener('click', function() {
      document.getElementById('profile-modal-overlay').classList.remove('show');
    });
    var btnCancel = document.getElementById('btn-cancel-profile');
    if (btnCancel) btnCancel.addEventListener('click', function() {
      document.getElementById('profile-modal-overlay').classList.remove('show');
    });

    // Botao "Editar Perfil" no sidebar (injetado pelo main.js se existir)
    // Delegado via hub para uso global
    window._openProfileModal = openProfileModal;
  }

})();
