/**
 * HUB MARKETING - Admin SPA
 * CRUD para todas as entidades via tabs com hash-based routing
 */
(function() {
  'use strict';

  // State
  var orgStructure = [];
  var allUsers = [];
  var allSquads = [];
  var allCategories = [];
  var allForms = [];
  var allDesks = [];
  var allQuickLinks = [];

  var esc = function(v) { return hub.utils.escapeHtml(v || ''); };

  // ====================================================================
  // ROUTER - hash-based tab switching
  // ====================================================================
  function initRouter() {
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
  }

  function onHashChange() {
    var hash = window.location.hash.replace('#', '') || 'usuarios';
    switchTab(hash);
  }

  function switchTab(tabName) {
    document.querySelectorAll('#admin-tabs .nav-link').forEach(function(link) {
      link.classList.toggle('active', link.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(function(panel) {
      panel.style.display = 'none';
    });
    var panel = document.getElementById('panel-' + tabName);
    if (panel) {
      panel.style.display = 'block';
      loadTabData(tabName);
    }
  }

  function loadTabData(tab) {
    switch(tab) {
      case 'usuarios': loadUsuarios(); break;
      case 'estrutura': loadEstrutura(); break;
      case 'squads': loadSquads(); break;
      case 'categorias': loadCategorias(); break;
      case 'formularios': loadFormularios(); break;
      case 'mesas': loadMesas(); break;
      case 'registros': loadRegistros(); break;
      case 'links': loadLinks(); break;
    }
  }

  // ====================================================================
  // GENERIC CRUD HELPERS
  // ====================================================================
  function showEditModal(title, bodyHTML, onSave) {
    document.getElementById('edit-modal-title').textContent = title;
    var body = document.getElementById('edit-modal-body');
    body.innerHTML = bodyHTML;
    // Volta scroll para o topo ao abrir o modal
    body.scrollTop = 0;
    document.getElementById('edit-modal-overlay').classList.add('show');
    var saveBtn = document.getElementById('edit-modal-save');
    var newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.id = 'edit-modal-save';
    newBtn.addEventListener('click', onSave);
  }

  function hideEditModal() {
    document.getElementById('edit-modal-overlay').classList.remove('show');
  }

  function showConfirm(message, onConfirm) {
    document.getElementById('confirm-modal-body').innerHTML = '<p>' + message + '</p>';
    document.getElementById('confirm-modal-overlay').classList.add('show');
    var okBtn = document.getElementById('confirm-modal-ok');
    var newBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newBtn, okBtn);
    newBtn.id = 'confirm-modal-ok';
    newBtn.addEventListener('click', function() {
      document.getElementById('confirm-modal-overlay').classList.remove('show');
      onConfirm();
    });
  }

  // Helper: get org name from pre-loaded orgStructure
  function orgName(id) {
    if (!id) return '';
    for (var i = 0; i < orgStructure.length; i++) {
      if (orgStructure[i].id === id) return orgStructure[i].nome;
    }
    return '';
  }

  // Helper: build gerencia options
  function gerenciaOptions(selected) {
    var html = '<option value="">-- Selecione --</option>';
    orgStructure.forEach(function(o) {
      if (o.tipo === 'gerencia' && o.is_active !== false) {
        html += '<option value="' + o.id + '"' + (o.id === selected ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      }
    });
    return html;
  }

  // Helper: build coordenacao options filtered by gerencia
  function coordenacaoOptions(gerenciaId, selected) {
    var html = '<option value="">-- Selecione --</option>';
    orgStructure.forEach(function(o) {
      if (o.tipo === 'coordenacao' && o.parent_id === gerenciaId && o.is_active !== false) {
        html += '<option value="' + o.id + '"' + (o.id === selected ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      }
    });
    return html;
  }

  // Helper: build nucleo options filtered by coordenacao
  function nucleoOptions(coordenacaoId, selected) {
    var html = '<option value="">-- Nenhum --</option>';
    orgStructure.forEach(function(o) {
      if (o.tipo === 'nucleo' && o.parent_id === coordenacaoId && o.is_active !== false) {
        html += '<option value="' + o.id + '"' + (o.id === selected ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
      }
    });
    return html;
  }

  // ====================================================================
  // TAB: USUARIOS
  // ====================================================================
  async function loadUsuarios() {
    var panel = document.getElementById('panel-usuarios');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('users').select('*').order('nome');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro ao carregar usuarios: ' + esc(result.error.message) + '</div>';
      return;
    }
    allUsers = result.data || [];

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">' + allUsers.filter(function(u){ return u.is_active !== false; }).length + ' usuarios ativos</h5>' +
      '<div><label class="mr-2"><input type="checkbox" id="chk-show-inactive-users"> Mostrar inativos</label></div>' +
      '</div>';
    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Nome</th><th>Apelido</th><th>Usuario</th><th>Email</th>' +
      '<th>Gerencia</th><th>Coord.</th><th>Nucleo</th>' +
      '<th>Admin</th><th>Coord</th><th>Acoes</th>' +
      '</tr></thead><tbody id="usuarios-tbody"></tbody></table></div>';

    panel.innerHTML = html;
    renderUsuariosTable(false);

    document.getElementById('chk-show-inactive-users').addEventListener('change', function() {
      renderUsuariosTable(this.checked);
    });
  }

  function renderUsuariosTable(showInactive) {
    var tbody = document.getElementById('usuarios-tbody');
    var rows = '';
    allUsers.forEach(function(u) {
      if (!showInactive && u.is_active === false) return;
      var inactiveClass = u.is_active === false ? ' style="opacity:0.5;"' : '';
      rows += '<tr' + inactiveClass + '>' +
        '<td>' + esc(u.nome) + '</td>' +
        '<td>' + esc(u.apelido) + '</td>' +
        '<td>' + esc(u.user_name) + '</td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td>' + esc(orgName(u.gerencia_id)) + '</td>' +
        '<td>' + esc(orgName(u.coordenacao_id)) + '</td>' +
        '<td>' + esc(orgName(u.nucleo_id)) + '</td>' +
        '<td>' + (u.is_admin ? '<span class="badge badge-success">Sim</span>' : '') + '</td>' +
        '<td>' + (u.is_coordenador ? '<span class="badge badge-info">Sim</span>' : '') + '</td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary mr-1" onclick="window._adminEditUser(' + u.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          (u.is_active !== false ?
            '<button class="btn btn-sm btn-outline-danger" onclick="window._adminDeactivateUser(' + u.id + ')"><i class="fa-solid fa-ban"></i></button>' :
            '<button class="btn btn-sm btn-outline-success" onclick="window._adminReactivateUser(' + u.id + ')"><i class="fa-solid fa-check"></i></button>') +
        '</td></tr>';
    });
    tbody.innerHTML = rows || '<tr><td colspan="10" class="text-center text-muted">Nenhum usuario encontrado</td></tr>';
  }

  window._adminEditUser = function(userId) {
    var u = allUsers.find(function(x) { return x.id === userId; });
    if (!u) return;

    var isAdmin = hub.auth.isAdmin();

    var formHtml = '' +
      '<div class="form-group"><label>Nome</label><input class="form-control" id="eu-nome" value="' + esc(u.nome) + '"></div>' +
      '<div class="form-group"><label>Apelido</label><input class="form-control" id="eu-apelido" value="' + esc(u.apelido) + '"></div>' +
      '<div class="form-group"><label>Email</label><input class="form-control" id="eu-email" value="' + esc(u.email) + '"></div>' +
      '<div class="form-group"><label>Telefone</label><input class="form-control" id="eu-telefone" value="' + esc(u.telefone) + '"></div>' +
      '<div class="form-group"><label>Aniversario</label><input type="date" class="form-control" id="eu-aniversario" value="' + (u.aniversario || '') + '"></div>' +
      '<div class="form-group"><label>Endereco</label><input class="form-control" id="eu-endereco" value="' + esc(u.endereco) + '"></div>' +
      '<div class="row"><div class="col-8"><div class="form-group"><label>Bairro</label><input class="form-control" id="eu-bairro" value="' + esc(u.bairro) + '"></div></div>' +
      '<div class="col-4"><div class="form-group"><label>CEP</label><input class="form-control" id="eu-cep" value="' + esc(u.cep) + '"></div></div></div>' +
      '<div class="form-group"><label>Gerencia</label><select class="form-control" id="eu-gerencia">' + gerenciaOptions(u.gerencia_id) + '</select></div>' +
      '<div class="form-group"><label>Coordenacao</label><select class="form-control" id="eu-coordenacao">' + coordenacaoOptions(u.gerencia_id, u.coordenacao_id) + '</select></div>' +
      '<div class="form-group"><label>Nucleo</label><select class="form-control" id="eu-nucleo">' + nucleoOptions(u.coordenacao_id, u.nucleo_id) + '</select></div>' +
      '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-terceirizado"' + (u.terceirizado ? ' checked' : '') + '><label class="form-check-label" for="eu-terceirizado">Terceirizado</label></div>' +
      (isAdmin ? '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-is-admin"' + (u.is_admin ? ' checked' : '') + '><label class="form-check-label" for="eu-is-admin">Admin</label></div>' +
        '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-is-coord"' + (u.is_coordenador ? ' checked' : '') + '><label class="form-check-label" for="eu-is-coord">Coordenador</label></div>' : '');

    showEditModal('Editar Usuario: ' + u.nome, formHtml, async function() {
      var updates = {
        nome: document.getElementById('eu-nome').value.trim(),
        apelido: document.getElementById('eu-apelido').value.trim(),
        email: document.getElementById('eu-email').value.trim(),
        telefone: document.getElementById('eu-telefone').value.trim(),
        aniversario: document.getElementById('eu-aniversario').value || null,
        endereco: document.getElementById('eu-endereco').value.trim(),
        bairro: document.getElementById('eu-bairro').value.trim(),
        cep: document.getElementById('eu-cep').value.trim(),
        gerencia_id: document.getElementById('eu-gerencia').value || null,
        coordenacao_id: document.getElementById('eu-coordenacao').value || null,
        nucleo_id: document.getElementById('eu-nucleo').value || null,
        terceirizado: document.getElementById('eu-terceirizado').checked
      };
      if (isAdmin) {
        updates.is_admin = document.getElementById('eu-is-admin').checked;
        updates.is_coordenador = document.getElementById('eu-is-coord').checked;
      }

      var res = await hub.sb.from('users').update(updates).eq('id', userId);
      if (res.error) {
        hub.utils.showToast('Erro ao salvar: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Usuario atualizado com sucesso', 'success');
        hideEditModal();
        loadUsuarios();
      }
    });

    // Cascading dropdowns
    document.getElementById('eu-gerencia').addEventListener('change', function() {
      document.getElementById('eu-coordenacao').innerHTML = coordenacaoOptions(this.value, null);
      document.getElementById('eu-nucleo').innerHTML = nucleoOptions(null, null);
    });
    document.getElementById('eu-coordenacao').addEventListener('change', function() {
      document.getElementById('eu-nucleo').innerHTML = nucleoOptions(this.value, null);
    });
  };

  window._adminDeactivateUser = function(userId) {
    var u = allUsers.find(function(x) { return x.id === userId; });
    showConfirm('Desativar o usuario <strong>' + esc(u ? u.nome : '') + '</strong>?', async function() {
      var res = await hub.sb.from('users').update({ is_active: false }).eq('id', userId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Usuario desativado', 'success');
        loadUsuarios();
      }
    });
  };

  window._adminReactivateUser = function(userId) {
    showConfirm('Reativar este usuario?', async function() {
      var res = await hub.sb.from('users').update({ is_active: true }).eq('id', userId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Usuario reativado', 'success');
        loadUsuarios();
      }
    });
  };

  // ====================================================================
  // TAB: ESTRUTURA
  // ====================================================================
  async function loadEstrutura() {
    var panel = document.getElementById('panel-estrutura');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('org_structure').select('*').order('tipo').order('nome');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(result.error.message) + '</div>';
      return;
    }
    orgStructure = result.data || [];

    var gerencias = orgStructure.filter(function(o) { return o.tipo === 'gerencia'; });

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Estrutura Organizacional</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddOrg(\'gerencia\', null)"><i class="fa-solid fa-plus"></i> Nova Gerencia</button>' +
      '</div>';

    html += '<div class="mb-2"><label><input type="checkbox" id="chk-show-inactive-org"> Mostrar inativos</label></div>';

    html += '<div id="org-tree">';
    gerencias.forEach(function(g) {
      if (g.is_active === false) return;
      var coords = orgStructure.filter(function(o) { return o.tipo === 'coordenacao' && o.parent_id === g.id && o.is_active !== false; });
      html += '<div class="card mb-2">';
      html += '<div class="card-header d-flex justify-content-between align-items-center py-2" data-toggle="collapse" data-target="#org-g-' + g.id + '" style="cursor:pointer;">';
      html += '<span><i class="fa-solid fa-building mr-2"></i><strong>' + esc(g.nome) + '</strong></span>';
      html += '<span>' +
        '<button class="btn btn-sm btn-outline-secondary mr-1" onclick="event.stopPropagation(); window._adminAddOrg(\'coordenacao\', \'' + g.id + '\')"><i class="fa-solid fa-plus"></i> Coord</button>' +
        '<button class="btn btn-sm btn-outline-primary mr-1" onclick="event.stopPropagation(); window._adminEditOrg(\'' + g.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
        '<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); window._adminDeactivateOrg(\'' + g.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</span></div>';
      html += '<div class="collapse show" id="org-g-' + g.id + '">';
      html += '<div class="card-body py-2 pl-4">';
      if (coords.length === 0) {
        html += '<p class="text-muted mb-0">Nenhuma coordenacao</p>';
      }
      coords.forEach(function(c) {
        var nucleos = orgStructure.filter(function(o) { return o.tipo === 'nucleo' && o.parent_id === c.id && o.is_active !== false; });
        html += '<div class="mb-2 p-2 border-left border-primary" style="border-left-width:3px !important;">';
        html += '<div class="d-flex justify-content-between align-items-center">';
        html += '<span><i class="fa-solid fa-sitemap mr-1"></i> ' + esc(c.nome) + '</span>';
        html += '<span>' +
          '<button class="btn btn-xs btn-outline-secondary mr-1" onclick="window._adminAddOrg(\'nucleo\', \'' + c.id + '\')"><i class="fa-solid fa-plus"></i> Nucleo</button>' +
          '<button class="btn btn-xs btn-outline-primary mr-1" onclick="window._adminEditOrg(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-xs btn-outline-danger" onclick="window._adminDeactivateOrg(\'' + c.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
          '</span></div>';
        if (nucleos.length > 0) {
          html += '<div class="ml-3 mt-1">';
          nucleos.forEach(function(n) {
            html += '<div class="d-flex justify-content-between align-items-center py-1">';
            html += '<span><i class="fa-solid fa-circle fa-xs mr-1 text-muted"></i> ' + esc(n.nome) + '</span>';
            html += '<span>' +
              '<button class="btn btn-xs btn-outline-primary mr-1" onclick="window._adminEditOrg(\'' + n.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
              '<button class="btn btn-xs btn-outline-danger" onclick="window._adminDeactivateOrg(\'' + n.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
              '</span></div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div></div></div>';
    });
    html += '</div>';

    panel.innerHTML = html;

    document.getElementById('chk-show-inactive-org').addEventListener('change', function() {
      if (this.checked) {
        renderEstruturaWithInactive();
      } else {
        loadEstrutura();
      }
    });
  }

  function renderEstruturaWithInactive() {
    var panel = document.getElementById('panel-estrutura');
    var gerencias = orgStructure.filter(function(o) { return o.tipo === 'gerencia'; });

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Estrutura Organizacional</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddOrg(\'gerencia\', null)"><i class="fa-solid fa-plus"></i> Nova Gerencia</button>' +
      '</div>';
    html += '<div class="mb-2"><label><input type="checkbox" id="chk-show-inactive-org" checked> Mostrar inativos</label></div>';

    html += '<div id="org-tree">';
    gerencias.forEach(function(g) {
      var inactiveStyle = g.is_active === false ? ' opacity:0.5;' : '';
      var coords = orgStructure.filter(function(o) { return o.tipo === 'coordenacao' && o.parent_id === g.id; });
      html += '<div class="card mb-2" style="' + inactiveStyle + '">';
      html += '<div class="card-header d-flex justify-content-between align-items-center py-2" data-toggle="collapse" data-target="#org-g-' + g.id + '" style="cursor:pointer;">';
      html += '<span><i class="fa-solid fa-building mr-2"></i><strong>' + esc(g.nome) + '</strong>' + (g.is_active === false ? ' <span class="badge badge-secondary">Inativo</span>' : '') + '</span>';
      html += '<span>' +
        '<button class="btn btn-sm btn-outline-primary mr-1" onclick="event.stopPropagation(); window._adminEditOrg(\'' + g.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
        '</span></div>';
      html += '<div class="collapse show" id="org-g-' + g.id + '"><div class="card-body py-2 pl-4">';
      coords.forEach(function(c) {
        var cInactive = c.is_active === false ? ' style="opacity:0.5;"' : '';
        var nucleos = orgStructure.filter(function(o) { return o.tipo === 'nucleo' && o.parent_id === c.id; });
        html += '<div class="mb-2 p-2 border-left border-primary"' + cInactive + ' style="border-left-width:3px !important;">';
        html += '<span><i class="fa-solid fa-sitemap mr-1"></i> ' + esc(c.nome) + (c.is_active === false ? ' <span class="badge badge-secondary">Inativo</span>' : '') + '</span>';
        if (nucleos.length > 0) {
          html += '<div class="ml-3 mt-1">';
          nucleos.forEach(function(n) {
            var nInactive = n.is_active === false ? ' style="opacity:0.5;"' : '';
            html += '<div class="py-1"' + nInactive + '><i class="fa-solid fa-circle fa-xs mr-1 text-muted"></i> ' + esc(n.nome) + (n.is_active === false ? ' <span class="badge badge-secondary">Inativo</span>' : '') + '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div></div></div>';
    });
    html += '</div>';

    panel.innerHTML = html;
    document.getElementById('chk-show-inactive-org').addEventListener('change', function() {
      if (this.checked) {
        renderEstruturaWithInactive();
      } else {
        loadEstrutura();
      }
    });
  }

  window._adminAddOrg = function(tipo, parentId) {
    var tipoLabel = tipo === 'gerencia' ? 'Gerencia' : (tipo === 'coordenacao' ? 'Coordenacao' : 'Nucleo');
    var formHtml = '<div class="form-group"><label>Nome</label><input class="form-control" id="org-nome" placeholder="Nome da ' + tipoLabel + '"></div>';

    showEditModal('Nova ' + tipoLabel, formHtml, async function() {
      var nome = document.getElementById('org-nome').value.trim();
      if (!nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var row = { nome: nome, tipo: tipo, is_active: true };
      if (parentId) row.parent_id = parentId;

      var res = await hub.sb.from('org_structure').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast(tipoLabel + ' criada com sucesso', 'success');
        hideEditModal();
        loadEstrutura();
      }
    });
  };

  window._adminEditOrg = function(orgId) {
    var o = orgStructure.find(function(x) { return x.id === orgId; });
    if (!o) return;
    var formHtml = '<div class="form-group"><label>Nome</label><input class="form-control" id="org-nome" value="' + esc(o.nome) + '"></div>';

    showEditModal('Editar ' + o.tipo, formHtml, async function() {
      var nome = document.getElementById('org-nome').value.trim();
      if (!nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('org_structure').update({ nome: nome }).eq('id', orgId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Atualizado com sucesso', 'success');
        hideEditModal();
        loadEstrutura();
      }
    });
  };

  window._adminDeactivateOrg = function(orgId) {
    var o = orgStructure.find(function(x) { return x.id === orgId; });
    showConfirm('Desativar <strong>' + esc(o ? o.nome : '') + '</strong>?', async function() {
      var res = await hub.sb.from('org_structure').update({ is_active: false }).eq('id', orgId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Desativado com sucesso', 'success');
        loadEstrutura();
      }
    });
  };

  // ====================================================================
  // TAB: SQUADS
  // ====================================================================
  async function loadSquads() {
    var panel = document.getElementById('panel-squads');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var catResult = await hub.sb.from('squad_categories').select('*').eq('is_active', true).order('nome');
    allCategories = (catResult.data || []);

    var sqResult = await hub.sb.from('squads').select('*, squad_members(id, user_id)').order('nome');
    if (sqResult.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(sqResult.error.message) + '</div>';
      return;
    }
    allSquads = sqResult.data || [];

    // Also load users for member management
    if (allUsers.length === 0) {
      var uResult = await hub.sb.from('users').select('id, nome, apelido, user_name').eq('is_active', true).order('nome');
      allUsers = uResult.data || [];
    }

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Squads (' + allSquads.filter(function(s) { return s.is_active !== false; }).length + ')</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddSquad()"><i class="fa-solid fa-plus"></i> Novo Squad</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Nome</th><th>Categoria</th><th>Icone</th><th>Descricao</th><th>Membros</th><th>Acoes</th>' +
      '</tr></thead><tbody>';

    allSquads.forEach(function(s) {
      if (s.is_active === false) return;
      var catName = '';
      var cat = allCategories.find(function(c) { return c.id === s.categoria_id; });
      if (cat) catName = cat.nome;
      var memberCount = s.squad_members ? s.squad_members.length : 0;

      html += '<tr>' +
        '<td>' + esc(s.nome) + '</td>' +
        '<td>' + esc(catName) + '</td>' +
        '<td><i class="fa-solid ' + esc(s.icone || 'fa-users') + '"></i> ' + esc(s.icone) + '</td>' +
        '<td>' + esc(s.descricao ? s.descricao.substring(0, 50) : '') + '</td>' +
        '<td><span class="badge badge-primary">' + memberCount + '</span></td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary mr-1" onclick="window._adminEditSquad(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-sm btn-outline-info mr-1" onclick="window._adminManageMembers(\'' + s.id + '\')"><i class="fa-solid fa-user-group"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="window._adminDeactivateSquad(\'' + s.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function squadFormHtml(s) {
    s = s || {};
    var catOpts = '<option value="">-- Selecione --</option>';
    allCategories.forEach(function(c) {
      catOpts += '<option value="' + c.id + '"' + (c.id === s.categoria_id ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
    });

    return '' +
      '<div class="form-group"><label>Nome</label><input class="form-control" id="sq-nome" value="' + esc(s.nome) + '"></div>' +
      '<div class="form-group"><label>Categoria</label><select class="form-control" id="sq-categoria">' + catOpts + '</select></div>' +
      '<div class="form-group"><label>Link Wrike</label><input class="form-control" id="sq-wrike" value="' + esc(s.link_wrike) + '"></div>' +
      '<div class="form-group"><label>Descricao</label><textarea class="form-control" id="sq-descricao" rows="2">' + esc(s.descricao) + '</textarea></div>' +
      '<div class="form-group"><label>Icone (FontAwesome class, ex: fa-users)</label><input class="form-control" id="sq-icone" value="' + esc(s.icone) + '"></div>';
  }

  window._adminAddSquad = function() {
    showEditModal('Novo Squad', squadFormHtml(), async function() {
      var row = {
        nome: document.getElementById('sq-nome').value.trim(),
        categoria_id: document.getElementById('sq-categoria').value || null,
        link_wrike: document.getElementById('sq-wrike').value.trim(),
        descricao: document.getElementById('sq-descricao').value.trim(),
        icone: document.getElementById('sq-icone').value.trim(),
        is_active: true
      };
      if (!row.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('squads').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Squad criado com sucesso', 'success');
        hideEditModal();
        loadSquads();
      }
    });
  };

  window._adminEditSquad = function(squadId) {
    var s = allSquads.find(function(x) { return x.id === squadId; });
    if (!s) return;

    showEditModal('Editar Squad: ' + s.nome, squadFormHtml(s), async function() {
      var updates = {
        nome: document.getElementById('sq-nome').value.trim(),
        categoria_id: document.getElementById('sq-categoria').value || null,
        link_wrike: document.getElementById('sq-wrike').value.trim(),
        descricao: document.getElementById('sq-descricao').value.trim(),
        icone: document.getElementById('sq-icone').value.trim()
      };
      if (!updates.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('squads').update(updates).eq('id', squadId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Squad atualizado', 'success');
        hideEditModal();
        loadSquads();
      }
    });
  };

  window._adminDeactivateSquad = function(squadId) {
    var s = allSquads.find(function(x) { return x.id === squadId; });
    showConfirm('Desativar o squad <strong>' + esc(s ? s.nome : '') + '</strong>?', async function() {
      var res = await hub.sb.from('squads').update({ is_active: false }).eq('id', squadId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Squad desativado', 'success');
        loadSquads();
      }
    });
  };

  window._adminManageMembers = function(squadId) {
    var s = allSquads.find(function(x) { return x.id === squadId; });
    if (!s) return;

    var members = s.squad_members || [];
    var memberUserIds = members.map(function(m) { return m.user_id; });

    var memberListHtml = '';
    if (members.length === 0) {
      memberListHtml = '<p class="text-muted">Nenhum membro</p>';
    } else {
      memberListHtml = '<ul class="list-group mb-3" id="member-list">';
      members.forEach(function(m) {
        var user = allUsers.find(function(u) { return u.id === m.user_id; });
        var userName = user ? (user.apelido || user.nome) : 'ID: ' + m.user_id;
        memberListHtml += '<li class="list-group-item d-flex justify-content-between align-items-center">' +
          esc(userName) +
          '<button class="btn btn-sm btn-outline-danger" onclick="window._adminRemoveMember(\'' + squadId + '\', ' + m.id + ')"><i class="fa-solid fa-xmark"></i></button>' +
          '</li>';
      });
      memberListHtml += '</ul>';
    }

    var userOpts = '<option value="">-- Adicionar membro --</option>';
    allUsers.forEach(function(u) {
      if (memberUserIds.indexOf(u.id) === -1) {
        userOpts += '<option value="' + u.id + '">' + esc(u.nome) + ' (' + esc(u.user_name) + ')</option>';
      }
    });

    var formHtml = '<h6>Membros atuais</h6>' + memberListHtml +
      '<h6>Adicionar membro</h6>' +
      '<div class="input-group">' +
      '<select class="form-control" id="add-member-select">' + userOpts + '</select>' +
      '<div class="input-group-append"><button class="btn btn-primary" onclick="window._adminAddMember(\'' + squadId + '\')">Adicionar</button></div>' +
      '</div>';

    showEditModal('Membros: ' + s.nome, formHtml, function() {
      hideEditModal();
      loadSquads();
    });

    // Change the save button text
    document.getElementById('edit-modal-save').textContent = 'Fechar';
  };

  window._adminAddMember = async function(squadId) {
    var select = document.getElementById('add-member-select');
    var userId = parseInt(select.value);
    if (!userId) { hub.utils.showToast('Selecione um usuario', 'warning'); return; }

    var res = await hub.sb.from('squad_members').insert({ squad_id: squadId, user_id: userId });
    if (res.error) {
      hub.utils.showToast('Erro: ' + res.error.message, 'error');
    } else {
      hub.utils.showToast('Membro adicionado', 'success');
      // Refresh squads data and re-open modal
      var sqResult = await hub.sb.from('squads').select('*, squad_members(id, user_id)').order('nome');
      allSquads = sqResult.data || [];
      window._adminManageMembers(squadId);
    }
  };

  window._adminRemoveMember = async function(squadId, memberRowId) {
    var res = await hub.sb.from('squad_members').delete().eq('id', memberRowId);
    if (res.error) {
      hub.utils.showToast('Erro: ' + res.error.message, 'error');
    } else {
      hub.utils.showToast('Membro removido', 'success');
      var sqResult = await hub.sb.from('squads').select('*, squad_members(id, user_id)').order('nome');
      allSquads = sqResult.data || [];
      window._adminManageMembers(squadId);
    }
  };

  // ====================================================================
  // TAB: CATEGORIAS
  // ====================================================================
  async function loadCategorias() {
    var panel = document.getElementById('panel-categorias');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('squad_categories').select('*').order('nome');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(result.error.message) + '</div>';
      return;
    }
    allCategories = result.data || [];

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Categorias de Squad</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddCategoria()"><i class="fa-solid fa-plus"></i> Nova Categoria</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Nome</th><th>Icone</th><th>Cor</th><th>Acoes</th>' +
      '</tr></thead><tbody>';

    allCategories.forEach(function(c) {
      if (c.is_active === false) return;
      html += '<tr>' +
        '<td>' + esc(c.nome) + '</td>' +
        '<td><i class="fa-solid ' + esc(c.icone || 'fa-tag') + '"></i> ' + esc(c.icone) + '</td>' +
        '<td><span style="display:inline-block;width:20px;height:20px;border-radius:4px;background:' + esc(c.cor || '#ccc') + ';vertical-align:middle;"></span> ' + esc(c.cor) + '</td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary mr-1" onclick="window._adminEditCategoria(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="window._adminDeactivateCategoria(\'' + c.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function categoriaFormHtml(c) {
    c = c || {};
    return '' +
      '<div class="form-group"><label>Nome</label><input class="form-control" id="cat-nome" value="' + esc(c.nome) + '"></div>' +
      '<div class="form-group"><label>Icone (FontAwesome class)</label><input class="form-control" id="cat-icone" value="' + esc(c.icone) + '" placeholder="fa-tag"></div>' +
      '<div class="form-group"><label>Cor</label><input type="color" class="form-control" id="cat-cor" value="' + (c.cor || '#3b82f6') + '" style="height:40px;"></div>';
  }

  window._adminAddCategoria = function() {
    showEditModal('Nova Categoria', categoriaFormHtml(), async function() {
      var row = {
        nome: document.getElementById('cat-nome').value.trim(),
        icone: document.getElementById('cat-icone').value.trim(),
        cor: document.getElementById('cat-cor').value,
        is_active: true
      };
      if (!row.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('squad_categories').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Categoria criada', 'success');
        hideEditModal();
        loadCategorias();
      }
    });
  };

  window._adminEditCategoria = function(catId) {
    var c = allCategories.find(function(x) { return x.id === catId; });
    if (!c) return;

    showEditModal('Editar Categoria', categoriaFormHtml(c), async function() {
      var updates = {
        nome: document.getElementById('cat-nome').value.trim(),
        icone: document.getElementById('cat-icone').value.trim(),
        cor: document.getElementById('cat-cor').value
      };
      if (!updates.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('squad_categories').update(updates).eq('id', catId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Categoria atualizada', 'success');
        hideEditModal();
        loadCategorias();
      }
    });
  };

  window._adminDeactivateCategoria = function(catId) {
    var c = allCategories.find(function(x) { return x.id === catId; });
    showConfirm('Desativar a categoria <strong>' + esc(c ? c.nome : '') + '</strong>?', async function() {
      var res = await hub.sb.from('squad_categories').update({ is_active: false }).eq('id', catId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Categoria desativada', 'success');
        loadCategorias();
      }
    });
  };

  // ====================================================================
  // TAB: FORMULARIOS
  // ====================================================================
  async function loadFormularios() {
    var panel = document.getElementById('panel-formularios');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('forms').select('*').order('nome');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(result.error.message) + '</div>';
      return;
    }
    allForms = result.data || [];

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Formularios (' + allForms.filter(function(f) { return f.is_active !== false; }).length + ')</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddForm()"><i class="fa-solid fa-plus"></i> Novo Formulario</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Nome</th><th>Descricao</th><th>Link</th><th>Tipo</th><th>Acoes</th>' +
      '</tr></thead><tbody>';

    allForms.forEach(function(f) {
      if (f.is_active === false) return;
      html += '<tr>' +
        '<td>' + esc(f.nome) + '</td>' +
        '<td>' + esc(f.descricao_breve ? f.descricao_breve.substring(0, 60) : '') + '</td>' +
        '<td>' + (f.link ? '<a href="' + esc(f.link) + '" target="_blank" class="text-truncate d-inline-block" style="max-width:200px;">' + esc(f.link) + '</a>' : '') + '</td>' +
        '<td><span class="badge badge-' + (f.tipo === 'interno' ? 'primary' : 'secondary') + '">' + esc(f.tipo || 'interno') + '</span></td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary mr-1" onclick="window._adminEditForm(\'' + f.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="window._adminDeactivateForm(\'' + f.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function formFormHtml(f) {
    f = f || {};
    var tipoIntSel = (f.tipo === 'interno' || !f.tipo) ? ' selected' : '';
    var tipoExtSel = f.tipo === 'externo' ? ' selected' : '';

    return '' +
      '<div class="form-group"><label>Nome</label><input class="form-control" id="fm-nome" value="' + esc(f.nome) + '"></div>' +
      '<div class="form-group"><label>Descricao Breve</label><input class="form-control" id="fm-desc-breve" value="' + esc(f.descricao_breve) + '"></div>' +
      '<div class="form-group"><label>Descricao Completa</label><textarea class="form-control" id="fm-desc-completa" rows="3">' + esc(f.descricao_completa) + '</textarea></div>' +
      '<div class="form-group"><label>Link</label><input class="form-control" id="fm-link" value="' + esc(f.link) + '"></div>' +
      '<div class="form-group"><label>Tipo</label><select class="form-control" id="fm-tipo">' +
        '<option value="interno"' + tipoIntSel + '>Interno</option>' +
        '<option value="externo"' + tipoExtSel + '>Externo</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Icone (FontAwesome class)</label><input class="form-control" id="fm-icone" value="' + esc(f.icone) + '" placeholder="fa-file-lines"></div>';
  }

  window._adminAddForm = function() {
    showEditModal('Novo Formulario', formFormHtml(), async function() {
      var row = {
        nome: document.getElementById('fm-nome').value.trim(),
        descricao_breve: document.getElementById('fm-desc-breve').value.trim(),
        descricao_completa: document.getElementById('fm-desc-completa').value.trim(),
        link: document.getElementById('fm-link').value.trim(),
        tipo: document.getElementById('fm-tipo').value,
        icone: document.getElementById('fm-icone').value.trim(),
        is_active: true
      };
      if (!row.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('forms').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Formulario criado', 'success');
        hideEditModal();
        loadFormularios();
      }
    });
  };

  window._adminEditForm = function(formId) {
    var f = allForms.find(function(x) { return x.id === formId; });
    if (!f) return;

    showEditModal('Editar Formulario: ' + f.nome, formFormHtml(f), async function() {
      var updates = {
        nome: document.getElementById('fm-nome').value.trim(),
        descricao_breve: document.getElementById('fm-desc-breve').value.trim(),
        descricao_completa: document.getElementById('fm-desc-completa').value.trim(),
        link: document.getElementById('fm-link').value.trim(),
        tipo: document.getElementById('fm-tipo').value,
        icone: document.getElementById('fm-icone').value.trim()
      };
      if (!updates.nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('forms').update(updates).eq('id', formId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Formulario atualizado', 'success');
        hideEditModal();
        loadFormularios();
      }
    });
  };

  window._adminDeactivateForm = function(formId) {
    var f = allForms.find(function(x) { return x.id === formId; });
    showConfirm('Desativar o formulario <strong>' + esc(f ? f.nome : '') + '</strong>?', async function() {
      var res = await hub.sb.from('forms').update({ is_active: false }).eq('id', formId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Formulario desativado', 'success');
        loadFormularios();
      }
    });
  };

  // ====================================================================
  // TAB: MESAS
  // ====================================================================
  async function loadMesas() {
    var panel = document.getElementById('panel-mesas');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('desks').select('*').order('number');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(result.error.message) + '</div>';
      return;
    }
    allDesks = result.data || [];

    // Load users for fixed_reserve dropdown if needed
    if (allUsers.length === 0) {
      var uResult = await hub.sb.from('users').select('id, nome, apelido, user_name').eq('is_active', true).order('nome');
      allUsers = uResult.data || [];
    }

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Mesas (' + allDesks.length + ')</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddDesk()"><i class="fa-solid fa-plus"></i> Nova Mesa</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Numero</th><th>Nome</th><th>Grid Row</th><th>Grid Col</th><th>Row Span</th><th>Col Span</th><th>Reserva Fixa</th><th>Ativo</th><th>Acoes</th>' +
      '</tr></thead><tbody>';

    allDesks.forEach(function(d) {
      var fixedUser = '';
      if (d.fixed_reserve) {
        var fu = allUsers.find(function(u) { return u.user_name === d.fixed_reserve; });
        fixedUser = fu ? (fu.apelido || fu.nome) : d.fixed_reserve;
      }

      html += '<tr' + (d.is_active === false ? ' style="opacity:0.5;"' : '') + '>' +
        '<td>' + (d.number || '') + '</td>' +
        '<td>' + esc(d.desk_name) + '</td>' +
        '<td>' + (d.grid_row || '') + '</td>' +
        '<td>' + (d.grid_col || '') + '</td>' +
        '<td>' + (d.row_span || 1) + '</td>' +
        '<td>' + (d.col_span || 1) + '</td>' +
        '<td>' + esc(fixedUser) + '</td>' +
        '<td>' + (d.is_active !== false ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-secondary">Nao</span>') + '</td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary" onclick="window._adminEditDesk(' + d.id + ')"><i class="fa-solid fa-pen"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function deskFormHtml(d) {
    d = d || {};
    var userOpts = '<option value="">-- Nenhuma --</option>';
    allUsers.forEach(function(u) {
      userOpts += '<option value="' + esc(u.user_name) + '"' + (u.user_name === d.fixed_reserve ? ' selected' : '') + '>' + esc(u.nome) + ' (' + esc(u.user_name) + ')</option>';
    });

    return '' +
      '<div class="row"><div class="col-4"><div class="form-group"><label>Numero</label><input type="number" class="form-control" id="dk-number" value="' + (d.number || '') + '"></div></div>' +
      '<div class="col-8"><div class="form-group"><label>Nome da Mesa</label><input class="form-control" id="dk-name" value="' + esc(d.desk_name) + '"></div></div></div>' +
      '<div class="row">' +
        '<div class="col-3"><div class="form-group"><label>Grid Row</label><input type="number" class="form-control" id="dk-row" value="' + (d.grid_row || '') + '"></div></div>' +
        '<div class="col-3"><div class="form-group"><label>Grid Col</label><input type="number" class="form-control" id="dk-col" value="' + (d.grid_col || '') + '"></div></div>' +
        '<div class="col-3"><div class="form-group"><label>Row Span</label><input type="number" class="form-control" id="dk-rowspan" value="' + (d.row_span || 1) + '"></div></div>' +
        '<div class="col-3"><div class="form-group"><label>Col Span</label><input type="number" class="form-control" id="dk-colspan" value="' + (d.col_span || 1) + '"></div></div>' +
      '</div>' +
      '<div class="form-group"><label>Reserva Fixa (usuario)</label><select class="form-control" id="dk-fixed">' + userOpts + '</select></div>' +
      '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="dk-active"' + (d.is_active !== false ? ' checked' : '') + '><label class="form-check-label" for="dk-active">Ativo</label></div>';
  }

  window._adminAddDesk = function() {
    showEditModal('Nova Mesa', deskFormHtml(), async function() {
      var row = {
        number: parseInt(document.getElementById('dk-number').value) || null,
        desk_name: document.getElementById('dk-name').value.trim(),
        grid_row: parseInt(document.getElementById('dk-row').value) || null,
        grid_col: parseInt(document.getElementById('dk-col').value) || null,
        row_span: parseInt(document.getElementById('dk-rowspan').value) || 1,
        col_span: parseInt(document.getElementById('dk-colspan').value) || 1,
        fixed_reserve: document.getElementById('dk-fixed').value || null,
        is_active: document.getElementById('dk-active').checked
      };

      var res = await hub.sb.from('desks').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Mesa criada', 'success');
        hideEditModal();
        loadMesas();
      }
    });
  };

  window._adminEditDesk = function(deskId) {
    var d = allDesks.find(function(x) { return x.id === deskId; });
    if (!d) return;

    showEditModal('Editar Mesa #' + (d.number || d.id), deskFormHtml(d), async function() {
      var updates = {
        number: parseInt(document.getElementById('dk-number').value) || null,
        desk_name: document.getElementById('dk-name').value.trim(),
        grid_row: parseInt(document.getElementById('dk-row').value) || null,
        grid_col: parseInt(document.getElementById('dk-col').value) || null,
        row_span: parseInt(document.getElementById('dk-rowspan').value) || 1,
        col_span: parseInt(document.getElementById('dk-colspan').value) || 1,
        fixed_reserve: document.getElementById('dk-fixed').value || null,
        is_active: document.getElementById('dk-active').checked
      };

      var res = await hub.sb.from('desks').update(updates).eq('id', deskId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Mesa atualizada', 'success');
        hideEditModal();
        loadMesas();
      }
    });
  };

  // ====================================================================
  // TAB: REGISTROS
  // ====================================================================
  async function loadRegistros() {
    var panel = document.getElementById('panel-registros');

    // Render the shell only if not yet rendered
    if (!document.getElementById('reg-tbody')) {
      var html = '<h5 class="mb-3">Registros de Reservas</h5>' +
        '<div class="hub-filter-bar mb-3">' +
          '<div class="hub-filter-group"><label>Data</label><input type="date" class="form-control" id="reg-filter-date"></div>' +
          '<div class="hub-filter-group"><label>Mesa</label><input type="text" class="form-control" id="reg-filter-desk" placeholder="Numero ou nome"></div>' +
          '<div class="hub-filter-group"><label>Criado por</label><input type="text" class="form-control" id="reg-filter-created" placeholder="Usuario"></div>' +
          '<div class="hub-filter-group"><label>Cancelado por</label><input type="text" class="form-control" id="reg-filter-canceled" placeholder="Usuario"></div>' +
          '<div class="hub-filter-group" style="align-self:flex-end;"><button class="btn btn-primary" id="reg-filter-btn"><i class="fa-solid fa-search"></i> Filtrar</button></div>' +
        '</div>' +
        '<div id="reg-results-count" class="mb-2 text-muted"></div>' +
        '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
          '<th>Data</th><th>Mesa</th><th>Criado por</th><th>Criado em</th><th>Cancelado por</th><th>Cancelado em</th><th>Check-in</th><th>Status</th>' +
        '</tr></thead><tbody id="reg-tbody"></tbody></table></div>';

      panel.innerHTML = html;

      // Set default date to today and bind filter button
      var today = new Date().toISOString().split('T')[0];
      document.getElementById('reg-filter-date').value = today;
      document.getElementById('reg-filter-btn').addEventListener('click', fetchRegistros);
    }

    // Always auto-fetch when switching to this tab
    fetchRegistros();
  }

  async function fetchRegistros() {
    var tbody = document.getElementById('reg-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Carregando...</td></tr>';

    var dateVal = document.getElementById('reg-filter-date').value;
    var deskVal = document.getElementById('reg-filter-desk').value.trim().toLowerCase();
    var createdVal = document.getElementById('reg-filter-created').value.trim().toLowerCase();
    var canceledVal = document.getElementById('reg-filter-canceled').value.trim().toLowerCase();

    var query = hub.sb.from('reservations').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(500);

    if (dateVal) {
      query = query.eq('date', dateVal);
    }

    var result = await query;
    if (result.error) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Erro: ' + esc(result.error.message) + '</td></tr>';
      return;
    }

    var rows = result.data || [];

    // Client-side filter for desk, created_by, canceled_by
    if (deskVal) {
      rows = rows.filter(function(r) {
        return (r.desk_name || '').toLowerCase().indexOf(deskVal) !== -1;
      });
    }
    if (createdVal) {
      rows = rows.filter(function(r) {
        return (r.created_by || '').toLowerCase().indexOf(createdVal) !== -1;
      });
    }
    if (canceledVal) {
      rows = rows.filter(function(r) {
        return (r.canceled_by || '').toLowerCase().indexOf(canceledVal) !== -1;
      });
    }

    document.getElementById('reg-results-count').textContent = rows.length + ' registro(s) encontrado(s)';

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhum registro encontrado</td></tr>';
      return;
    }

    var html = '';
    rows.forEach(function(r) {
      var isCanceled = !!r.canceled_at;
      var statusBadge = isCanceled ?
        '<span class="badge badge-danger">Cancelado</span>' :
        '<span class="badge badge-success">Ativo</span>';

      var cleanUser = function(u) {
        if (!u) return '';
        return u.replace('@sicoob.com.br', '');
      };

      html += '<tr>' +
        '<td>' + hub.utils.formatDate(r.date) + '</td>' +
        '<td>' + esc(r.desk_name || '') + '</td>' +
        '<td>' + esc(cleanUser(r.created_by)) + '</td>' +
        '<td>' + hub.utils.formatDateTime(r.created_at) + '</td>' +
        '<td>' + esc(cleanUser(r.canceled_by)) + '</td>' +
        '<td>' + (r.canceled_at ? hub.utils.formatDateTime(r.canceled_at) : '') + '</td>' +
        '<td>' + (r.checked_in_at ? '<span class="badge badge-success">Sim</span>' : '') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
  }

  // ====================================================================
  // TAB: LINKS
  // ====================================================================
  async function loadLinks() {
    var panel = document.getElementById('panel-links');
    panel.innerHTML = '<div class="text-center py-4"><div class="spinner-border" role="status"></div></div>';

    var result = await hub.sb.from('quick_links').select('*').order('ordem').order('titulo');
    if (result.error) {
      panel.innerHTML = '<div class="alert alert-danger">Erro: ' + esc(result.error.message) + '</div>';
      return;
    }
    allQuickLinks = result.data || [];

    var html = '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h5 class="mb-0">Links Rapidos (' + allQuickLinks.filter(function(l) { return l.is_active !== false; }).length + ')</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddLink()"><i class="fa-solid fa-plus"></i> Novo Link</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Titulo</th><th>URL</th><th>Icone</th><th>Secao</th><th>Ordem</th><th>Acoes</th>' +
      '</tr></thead><tbody>';

    allQuickLinks.forEach(function(l) {
      if (l.is_active === false) return;
      html += '<tr>' +
        '<td>' + esc(l.titulo) + '</td>' +
        '<td><a href="' + esc(l.url) + '" target="_blank" class="text-truncate d-inline-block" style="max-width:250px;">' + esc(l.url) + '</a></td>' +
        '<td><i class="fa-solid ' + esc(l.icone || 'fa-link') + '"></i> ' + esc(l.icone) + '</td>' +
        '<td>' + esc(l.secao) + '</td>' +
        '<td>' + (l.ordem || 0) + '</td>' +
        '<td class="text-nowrap">' +
          '<button class="btn btn-sm btn-outline-primary mr-1" onclick="window._adminEditLink(\'' + l.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="window._adminDeactivateLink(\'' + l.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td></tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function linkFormHtml(l) {
    l = l || {};
    return '' +
      '<div class="form-group"><label>Titulo</label><input class="form-control" id="lk-titulo" value="' + esc(l.titulo) + '"></div>' +
      '<div class="form-group"><label>URL</label><input class="form-control" id="lk-url" value="' + esc(l.url) + '" placeholder="https://..."></div>' +
      '<div class="form-group"><label>Icone (FontAwesome class)</label><input class="form-control" id="lk-icone" value="' + esc(l.icone) + '" placeholder="fa-link"></div>' +
      '<div class="form-group"><label>Secao</label><input class="form-control" id="lk-secao" value="' + esc(l.secao) + '" placeholder="Ex: ferramentas, comunicacao"></div>' +
      '<div class="form-group"><label>Ordem</label><input type="number" class="form-control" id="lk-ordem" value="' + (l.ordem || 0) + '"></div>';
  }

  window._adminAddLink = function() {
    showEditModal('Novo Link', linkFormHtml(), async function() {
      var row = {
        titulo: document.getElementById('lk-titulo').value.trim(),
        url: document.getElementById('lk-url').value.trim(),
        icone: document.getElementById('lk-icone').value.trim(),
        secao: document.getElementById('lk-secao').value.trim(),
        ordem: parseInt(document.getElementById('lk-ordem').value) || 0,
        is_active: true
      };
      if (!row.titulo) { hub.utils.showToast('Preencha o titulo', 'warning'); return; }

      var res = await hub.sb.from('quick_links').insert(row);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Link criado', 'success');
        hideEditModal();
        loadLinks();
      }
    });
  };

  window._adminEditLink = function(linkId) {
    var l = allQuickLinks.find(function(x) { return x.id === linkId; });
    if (!l) return;

    showEditModal('Editar Link: ' + l.titulo, linkFormHtml(l), async function() {
      var updates = {
        titulo: document.getElementById('lk-titulo').value.trim(),
        url: document.getElementById('lk-url').value.trim(),
        icone: document.getElementById('lk-icone').value.trim(),
        secao: document.getElementById('lk-secao').value.trim(),
        ordem: parseInt(document.getElementById('lk-ordem').value) || 0
      };
      if (!updates.titulo) { hub.utils.showToast('Preencha o titulo', 'warning'); return; }

      var res = await hub.sb.from('quick_links').update(updates).eq('id', linkId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Link atualizado', 'success');
        hideEditModal();
        loadLinks();
      }
    });
  };

  window._adminDeactivateLink = function(linkId) {
    var l = allQuickLinks.find(function(x) { return x.id === linkId; });
    showConfirm('Desativar o link <strong>' + esc(l ? l.titulo : '') + '</strong>?', async function() {
      var res = await hub.sb.from('quick_links').update({ is_active: false }).eq('id', linkId);
      if (res.error) {
        hub.utils.showToast('Erro: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Link desativado', 'success');
        loadLinks();
      }
    });
  };

  // ====================================================================
  // INIT
  // ====================================================================
  document.addEventListener('hub:ready', function(e) {
    if (!hub.auth.isAdminOrCoord()) {
      hub.utils.showToast('Acesso restrito a administradores', 'error');
      setTimeout(function() { window.location.href = '/'; }, 2000);
      return;
    }
    document.getElementById('app-view').style.display = 'block';

    // Pre-load org_structure for reuse across tabs
    hub.sb.from('org_structure').select('*').order('tipo').order('nome').then(function(result) {
      if (result.data) orgStructure = result.data;
      initRouter();
    });
  });

})();
