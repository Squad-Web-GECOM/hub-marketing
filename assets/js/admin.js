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
    // Mostra preview dos ícones já preenchidos ao abrir o modal
    ICON_INPUT_IDS.forEach(function(id) {
      var inp = document.getElementById(id);
      if (inp && inp.value) updateIconPreview(id, inp.value.trim());
    });
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

    var activeCount = allUsers.filter(function(u){ return u.is_active !== false; }).length;
    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-users"></i> Usuários <span class="count-badge">' + activeCount + '</span></h5>' +
      '<label class="d-flex align-items-center gap-1 mb-0" style="font-size:0.82rem;cursor:pointer;"><input type="checkbox" id="chk-show-inactive-users" class="mr-1"> Mostrar inativos</label>' +
      '</div>';
    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Nome</th><th>Apelido</th><th>Usuário</th><th>Email</th>' +
      '<th>Gerência</th><th>Coord.</th><th>Núcleo</th>' +
      '<th>Senioridade</th><th>Admin</th><th>Gestor</th>' +
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
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary mr-1" title="Editar" onclick="window._adminEditUser(' + u.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          (u.is_active !== false ?
            '<button class="btn btn-icon-sm btn-outline-danger" title="Desativar" onclick="window._adminDeactivateUser(' + u.id + ')"><i class="fa-solid fa-ban"></i></button>' :
            '<button class="btn btn-icon-sm btn-outline-success" title="Reativar" onclick="window._adminReactivateUser(' + u.id + ')"><i class="fa-solid fa-check"></i></button>') +
        '</td>' +
        '<td>' + esc(u.nome) + '</td>' +
        '<td>' + esc(u.apelido) + '</td>' +
        '<td><code style="font-size:0.78rem;">' + esc(u.user_name) + '</code></td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td class="td-truncate">' + esc(orgName(u.gerencia_id)) + '</td>' +
        '<td class="td-truncate">' + esc(orgName(u.coordenacao_id)) + '</td>' +
        '<td class="td-truncate">' + esc(orgName(u.nucleo_id)) + '</td>' +
        '<td>' + esc(u.senioridade || '') + '</td>' +
        '<td>' + (u.is_admin ? '<span class="badge badge-success">Admin</span>' : '') + '</td>' +
        '<td>' + (u.is_gestor ? '<span class="badge badge-info">Gestor</span>' : '') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = rows || '<tr><td colspan="11" class="text-center text-muted">Nenhum usuario encontrado</td></tr>';
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
      '<div class="form-group"><label>Senioridade</label><select class="form-control" id="eu-senioridade">' +
        '<option value="">— Não definida —</option>' +
        ['Gerente','Coordenador','Especialista','Sênior','Pleno','Júnior','Assistente','Estagiário','Jovem Aprendiz'].map(function(s) {
          return '<option value="' + s + '"' + (u.senioridade === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
      '</select></div>' +
      '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-terceirizado"' + (u.terceirizado ? ' checked' : '') + '><label class="form-check-label" for="eu-terceirizado">Terceirizado</label></div>' +
      (isAdmin ? '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-is-admin"' + (u.is_admin ? ' checked' : '') + '><label class="form-check-label" for="eu-is-admin">Admin</label></div>' +
        '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="eu-is-gestor"' + (u.is_gestor ? ' checked' : '') + '><label class="form-check-label" for="eu-is-gestor">Gestor</label></div>' : '');

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
        terceirizado: document.getElementById('eu-terceirizado').checked,
        senioridade: document.getElementById('eu-senioridade').value || null
      };
      if (isAdmin) {
        updates.is_admin   = document.getElementById('eu-is-admin').checked;
        updates.is_gestor  = document.getElementById('eu-is-gestor').checked;
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
        '<button class="btn btn-sm btn-primary mr-1" onclick="event.stopPropagation(); window._adminAddOrg(\'coordenacao\', \'' + g.id + '\')"><i class="fa-solid fa-plus"></i> Coord</button>' +
        '<button class="btn btn-sm btn-secondary mr-1" onclick="event.stopPropagation(); window._adminEditOrg(\'' + g.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
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
          '<button class="btn btn-xs btn-primary mr-1" onclick="window._adminAddOrg(\'nucleo\', \'' + c.id + '\')"><i class="fa-solid fa-plus"></i> Nucleo</button>' +
          '<button class="btn btn-xs btn-secondary mr-1" onclick="window._adminEditOrg(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-xs btn-outline-danger" onclick="window._adminDeactivateOrg(\'' + c.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
          '</span></div>';
        if (nucleos.length > 0) {
          html += '<div class="ml-3 mt-1">';
          nucleos.forEach(function(n) {
            html += '<div class="d-flex justify-content-between align-items-center py-1">';
            html += '<span><i class="fa-solid fa-circle fa-xs mr-1 text-muted"></i> ' + esc(n.nome) + '</span>';
            html += '<span>' +
              '<button class="btn btn-xs btn-secondary mr-1" onclick="window._adminEditOrg(\'' + n.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
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
        '<button class="btn btn-sm btn-secondary mr-1" onclick="event.stopPropagation(); window._adminEditOrg(\'' + g.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
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
    console.log('[Admin] _adminEditOrg called, id:', orgId, '| orgStructure.length:', orgStructure.length);
    var o = orgStructure.find(function(x) { return String(x.id) === String(orgId); });
    if (!o) {
      console.warn('[Admin] Org not found in cache, re-fetching...');
      // Tenta recarregar orgStructure e tentar novamente
      hub.sb.from('org_structure').select('*').then(function(r) {
        if (r.data) {
          orgStructure = r.data;
          var o2 = orgStructure.find(function(x) { return String(x.id) === String(orgId); });
          if (!o2) { hub.utils.showToast('Org nao encontrada (id: ' + orgId + ')', 'error'); return; }
          _adminEditOrgRun(o2, orgId);
        }
      });
      return;
    }
    _adminEditOrgRun(o, orgId);
  };

  function _adminEditOrgRun(o, orgId) {
    var formHtml = '<div class="form-group"><label>Nome</label><input class="form-control" id="org-nome" value="' + esc(o.nome) + '"></div>';

    showEditModal('Editar ' + o.tipo, formHtml, async function() {
      var nome = document.getElementById('org-nome').value.trim();
      if (!nome) { hub.utils.showToast('Preencha o nome', 'warning'); return; }

      var res = await hub.sb.from('org_structure').update({ nome: nome }).eq('id', orgId).select();
      console.log('[Admin] org_structure update result:', res);
      if (res.error) {
        hub.utils.showToast('Erro ao salvar: ' + res.error.message, 'error');
      } else {
        hub.utils.showToast('Atualizado com sucesso', 'success');
        hideEditModal();
        loadEstrutura();
      }
    });
  };

  window._adminDeactivateOrg = function(orgId) {
    var o = orgStructure.find(function(x) { return String(x.id) === String(orgId); });
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

    var squadCount = allSquads.filter(function(s) { return s.is_active !== false; }).length;
    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-users-gear"></i> Squads <span class="count-badge">' + squadCount + '</span></h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddSquad()"><i class="fa-solid fa-plus mr-1"></i>Novo Squad</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Nome</th><th>Categoria</th><th>Ícone</th><th>Descrição</th><th>Membros</th>' +
      '</tr></thead><tbody>';

    allSquads.forEach(function(s) {
      if (s.is_active === false) return;
      var catName = '';
      var cat = allCategories.find(function(c) { return c.id === s.categoria_id; });
      if (cat) catName = cat.nome;
      var memberCount = s.squad_members ? s.squad_members.length : 0;

      html += '<tr>' +
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary mr-1" title="Editar" onclick="window._adminEditSquad(\'' + s.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-icon-sm btn-outline-info mr-1" title="Membros" onclick="window._adminManageMembers(\'' + s.id + '\')"><i class="fa-solid fa-user-group"></i></button>' +
          '<button class="btn btn-icon-sm btn-outline-danger" title="Desativar" onclick="window._adminDeactivateSquad(\'' + s.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td>' +
        '<td><strong>' + esc(s.nome) + '</strong></td>' +
        '<td>' + esc(catName) + '</td>' +
        '<td><i class="' + hub.utils.normalizeIcon(s.icone, 'fa-solid fa-users') + ' mr-1"></i><code style="font-size:0.75rem;">' + esc(s.icone) + '</code></td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(s.descricao ? s.descricao.substring(0, 60) : '') + '</td>' +
        '<td><span class="badge badge-primary">' + memberCount + '</span></td>' +
        '</tr>';
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
      '<div class="form-group"><label>Link</label><input class="form-control" id="sq-link" value="' + esc(s.link || s.link_wrike) + '" placeholder="https://..."></div>' +
      '<div class="form-group"><label>Texto do botão</label><input class="form-control" id="sq-link-label" value="' + esc(s.link_label || '') + '" placeholder="Ex: Wrike, Notion, Drive..."></div>' +
      '<div class="form-group"><label>Descricao</label><textarea class="form-control" id="sq-descricao" rows="2">' + esc(s.descricao) + '</textarea></div>' +
      '<div class="form-group"><label>Ícone</label><div class="icon-input-wrap"><input class="form-control" id="sq-icone" value="' + esc(s.icone) + '" placeholder="fa-solid fa-users" autocomplete="off"><span class="icon-preview" id="icon-preview-sq-icone" style="display:none"></span></div></div>';
  }

  window._adminAddSquad = function() {
    showEditModal('Novo Squad', squadFormHtml(), async function() {
      var row = {
        nome: document.getElementById('sq-nome').value.trim(),
        categoria_id: document.getElementById('sq-categoria').value || null,
        link: document.getElementById('sq-link').value.trim(),
        link_label: document.getElementById('sq-link-label').value.trim() || null,
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
    var s = allSquads.find(function(x) { return String(x.id) === String(squadId); });
    if (!s) return;

    showEditModal('Editar Squad: ' + s.nome, squadFormHtml(s), async function() {
      var updates = {
        nome: document.getElementById('sq-nome').value.trim(),
        categoria_id: document.getElementById('sq-categoria').value || null,
        link: document.getElementById('sq-link').value.trim(),
        link_label: document.getElementById('sq-link-label').value.trim() || null,
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
    var s = allSquads.find(function(x) { return String(x.id) === String(squadId); });
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
    var s = allSquads.find(function(x) { return String(x.id) === String(squadId); });
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

    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-tags"></i> Categorias de Squad</h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddCategoria()"><i class="fa-solid fa-plus mr-1"></i>Nova Categoria</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Nome</th><th>Ícone</th><th>Cor</th>' +
      '</tr></thead><tbody>';

    allCategories.forEach(function(c) {
      if (c.is_active === false) return;
      html += '<tr>' +
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary mr-1" title="Editar" onclick="window._adminEditCategoria(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-icon-sm btn-outline-danger" title="Desativar" onclick="window._adminDeactivateCategoria(\'' + c.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td>' +
        '<td><strong>' + esc(c.nome) + '</strong></td>' +
        '<td><i class="' + hub.utils.normalizeIcon(c.icone, 'fa-solid fa-tag') + ' mr-1"></i><code style="font-size:0.75rem;">' + esc(c.icone) + '</code></td>' +
        '<td><span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(c.cor || '#ccc') + ';vertical-align:middle;border:1px solid rgba(0,0,0,0.1);"></span> <code style="font-size:0.75rem;">' + esc(c.cor) + '</code></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function categoriaFormHtml(c) {
    c = c || {};
    return '' +
      '<div class="form-group"><label>Nome</label><input class="form-control" id="cat-nome" value="' + esc(c.nome) + '"></div>' +
      '<div class="form-group"><label>Ícone</label><div class="icon-input-wrap"><input class="form-control" id="cat-icone" value="' + esc(c.icone) + '" placeholder="fa-solid fa-tag" autocomplete="off"><span class="icon-preview" id="icon-preview-cat-icone" style="display:none"></span></div></div>' +
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
    var c = allCategories.find(function(x) { return String(x.id) === String(catId); });
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
    var c = allCategories.find(function(x) { return String(x.id) === String(catId); });
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

    var formCount = allForms.filter(function(f) { return f.is_active !== false; }).length;
    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-file-lines"></i> Formulários <span class="count-badge">' + formCount + '</span></h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddForm()"><i class="fa-solid fa-plus mr-1"></i>Novo Formulário</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Nome</th><th>Descrição</th><th>Link</th><th>Tipo</th>' +
      '</tr></thead><tbody>';

    allForms.forEach(function(f) {
      if (f.is_active === false) return;
      html += '<tr>' +
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary mr-1" title="Editar" onclick="window._adminEditForm(\'' + f.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-icon-sm btn-outline-danger" title="Desativar" onclick="window._adminDeactivateForm(\'' + f.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td>' +
        '<td><strong>' + esc(f.nome) + '</strong></td>' +
        '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(f.descricao_breve ? f.descricao_breve.substring(0, 60) : '') + '</td>' +
        '<td>' + (f.link ? '<a href="' + esc(f.link) + '" target="_blank" title="' + esc(f.link) + '"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') + '</td>' +
        '<td><span class="badge badge-' + (f.tipo === 'interno' ? 'primary' : 'secondary') + '">' + esc(f.tipo || 'interno') + '</span></td>' +
        '</tr>';
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
      '<div class="form-group"><label>Ícone</label><div class="icon-input-wrap"><input class="form-control" id="fm-icone" value="' + esc(f.icone) + '" placeholder="fa-solid fa-file-lines" autocomplete="off"><span class="icon-preview" id="icon-preview-fm-icone" style="display:none"></span></div></div>';
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
    var f = allForms.find(function(x) { return String(x.id) === String(formId); });
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
    var f = allForms.find(function(x) { return String(x.id) === String(formId); });
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

    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-chair"></i> Mesas <span class="count-badge">' + allDesks.length + '</span></h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddDesk()"><i class="fa-solid fa-plus mr-1"></i>Nova Mesa</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Nº</th><th>Nome</th><th>Linha</th><th>Col</th><th>RowSpan</th><th>ColSpan</th><th>Reserva Fixa</th><th>Ativo</th>' +
      '</tr></thead><tbody>';

    allDesks.forEach(function(d) {
      var fixedUser = '';
      if (d.fixed_reserve) {
        var fu = allUsers.find(function(u) { return u.user_name === d.fixed_reserve; });
        fixedUser = fu ? (fu.apelido || fu.nome) : d.fixed_reserve;
      }

      html += '<tr' + (d.is_active === false ? ' style="opacity:0.5;"' : '') + '>' +
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary" title="Editar" onclick="window._adminEditDesk(' + d.id + ')"><i class="fa-solid fa-pen"></i></button>' +
        '</td>' +
        '<td><strong>' + (d.number || '') + '</strong></td>' +
        '<td>' + esc(d.desk_name) + '</td>' +
        '<td>' + (d.grid_row || '') + '</td>' +
        '<td>' + (d.grid_col || '') + '</td>' +
        '<td>' + (d.row_span || 1) + '</td>' +
        '<td>' + (d.col_span || 1) + '</td>' +
        '<td>' + esc(fixedUser) + '</td>' +
        '<td>' + (d.is_active !== false ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-secondary">Não</span>') + '</td>' +
        '</tr>';
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

    var linkCount = allQuickLinks.filter(function(l) { return l.is_active !== false; }).length;
    var html = '<div class="admin-panel-header">' +
      '<h5 class="admin-panel-title"><i class="fa-solid fa-link"></i> Links Rápidos <span class="count-badge">' + linkCount + '</span></h5>' +
      '<button class="btn btn-sm btn-primary" onclick="window._adminAddLink()"><i class="fa-solid fa-plus mr-1"></i>Novo Link</button>' +
      '</div>';

    html += '<div class="hub-table-wrapper"><table class="hub-table table table-sm"><thead><tr>' +
      '<th>Ações</th><th>Título</th><th>Ícone</th><th>Seção</th><th>Ord.</th><th>Link</th>' +
      '</tr></thead><tbody>';

    allQuickLinks.forEach(function(l) {
      if (l.is_active === false) return;
      html += '<tr>' +
        '<td class="td-acoes">' +
          '<button class="btn btn-icon-sm btn-secondary mr-1" title="Editar" onclick="window._adminEditLink(\'' + l.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-icon-sm btn-outline-danger" title="Desativar" onclick="window._adminDeactivateLink(\'' + l.id + '\')"><i class="fa-solid fa-ban"></i></button>' +
        '</td>' +
        '<td><strong>' + esc(l.titulo) + '</strong></td>' +
        '<td><i class="' + hub.utils.normalizeIcon(l.icone, 'fa-solid fa-link') + ' mr-1"></i><code style="font-size:0.75rem;">' + esc(l.icone) + '</code></td>' +
        '<td>' + esc(l.secao) + '</td>' +
        '<td>' + (l.ordem || 0) + '</td>' +
        '<td><a href="' + esc(l.url) + '" target="_blank" title="' + esc(l.url) + '"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  function linkFormHtml(l) {
    l = l || {};
    // Seções únicas já existentes para o datalist
    var secoes = [];
    (allQuickLinks || []).forEach(function(lk) {
      if (lk.secao && lk.is_active !== false && secoes.indexOf(lk.secao) === -1) {
        secoes.push(lk.secao);
      }
    });
    secoes.sort();
    var datalistHtml = '<datalist id="lk-secao-list">' +
      secoes.map(function(s) { return '<option value="' + esc(s) + '">'; }).join('') +
      '</datalist>';
    return '' +
      '<div class="form-group"><label>Titulo</label><input class="form-control" id="lk-titulo" value="' + esc(l.titulo) + '"></div>' +
      '<div class="form-group"><label>URL</label><input class="form-control" id="lk-url" value="' + esc(l.url) + '" placeholder="https://..."></div>' +
      '<div class="form-group"><label>Ícone</label><div class="icon-input-wrap"><input class="form-control" id="lk-icone" value="' + esc(l.icone) + '" placeholder="fa-solid fa-link" autocomplete="off"><span class="icon-preview" id="icon-preview-lk-icone" style="display:none"></span></div></div>' +
      '<div class="form-group"><label>Seção</label>' + datalistHtml + '<input class="form-control" id="lk-secao" value="' + esc(l.secao) + '" list="lk-secao-list" placeholder="Ex: ferramentas, comunicacao" autocomplete="off"></div>' +
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
    var l = allQuickLinks.find(function(x) { return String(x.id) === String(linkId); });
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
    var l = allQuickLinks.find(function(x) { return String(x.id) === String(linkId); });
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
  // MODAL DE ÍCONES — consulta flutuante
  // ====================================================================
  var ICON_LIST = (function() {
    var solid = [
      'fa-address-book','fa-address-card','fa-align-center','fa-align-justify','fa-align-left',
      'fa-align-right','fa-anchor','fa-angle-down','fa-angle-left','fa-angle-right','fa-angle-up',
      'fa-angles-down','fa-angles-left','fa-angles-right','fa-angles-up',
      'fa-arrow-down','fa-arrow-left','fa-arrow-right','fa-arrow-up',
      'fa-arrow-down-long','fa-arrow-up-long','fa-arrow-rotate-left','fa-arrow-rotate-right',
      'fa-arrows-rotate','fa-asterisk','fa-at','fa-award',
      'fa-ban','fa-bars','fa-bell','fa-bell-slash','fa-bolt','fa-book','fa-book-open',
      'fa-bookmark','fa-box','fa-box-open','fa-boxes-stacked','fa-briefcase','fa-bug',
      'fa-building','fa-bullhorn','fa-bullseye',
      'fa-cake-candles','fa-calculator','fa-calendar','fa-calendar-check','fa-calendar-days',
      'fa-calendar-minus','fa-calendar-plus','fa-calendar-xmark',
      'fa-camera','fa-chart-bar','fa-chart-line','fa-chart-pie','fa-check','fa-check-circle',
      'fa-check-double','fa-check-square','fa-chevron-down','fa-chevron-left','fa-chevron-right',
      'fa-chevron-up','fa-circle','fa-circle-check','fa-circle-dot','fa-circle-exclamation',
      'fa-circle-info','fa-circle-minus','fa-circle-plus','fa-circle-question','fa-circle-user',
      'fa-circle-xmark','fa-clipboard','fa-clipboard-check','fa-clipboard-list','fa-clock',
      'fa-cloud','fa-cloud-arrow-down','fa-cloud-arrow-up','fa-code','fa-code-branch',
      'fa-comment','fa-comment-dots','fa-comments','fa-compass','fa-copy','fa-crown',
      'fa-cube','fa-cubes',
      'fa-database','fa-diagram-project','fa-diamond','fa-display',
      'fa-download','fa-droplet',
      'fa-earth-americas','fa-edit','fa-ellipsis','fa-ellipsis-vertical','fa-envelope',
      'fa-envelope-open','fa-eraser','fa-exclamation','fa-expand','fa-eye','fa-eye-slash',
      'fa-file','fa-file-arrow-down','fa-file-arrow-up','fa-file-code','fa-file-csv',
      'fa-file-excel','fa-file-image','fa-file-lines','fa-file-pdf','fa-file-powerpoint',
      'fa-file-word','fa-film','fa-filter','fa-fingerprint','fa-flag','fa-floppy-disk',
      'fa-folder','fa-folder-open','fa-font','fa-forward','fa-futbol',
      'fa-gamepad','fa-gauge','fa-gear','fa-gears','fa-gift','fa-globe','fa-graduation-cap',
      'fa-grip','fa-grip-vertical',
      'fa-hand','fa-hand-pointer','fa-handshake','fa-hashtag','fa-headphones','fa-heart',
      'fa-home','fa-house','fa-hourglass',
      'fa-icons','fa-id-badge','fa-id-card','fa-image','fa-images','fa-inbox','fa-info',
      'fa-key','fa-keyboard',
      'fa-laptop','fa-layer-group','fa-leaf','fa-link','fa-list','fa-list-check',
      'fa-list-ol','fa-list-ul','fa-location-dot','fa-lock','fa-lock-open',
      'fa-magnifying-glass','fa-map','fa-map-location-dot','fa-map-pin','fa-medal',
      'fa-microphone','fa-minus','fa-mobile','fa-money-bill','fa-moon','fa-music',
      'fa-network-wired','fa-newspaper',
      'fa-palette','fa-paper-plane','fa-paperclip','fa-pen','fa-pen-to-square',
      'fa-pencil','fa-people-group','fa-percent','fa-phone','fa-phone-slash',
      'fa-photo-film','fa-play','fa-plug','fa-plus','fa-power-off','fa-print',
      'fa-puzzle-piece',
      'fa-question','fa-quote-left',
      'fa-rectangle-list','fa-reply','fa-robot','fa-rocket','fa-rotate',
      'fa-save','fa-scale-balanced','fa-screwdriver-wrench','fa-search','fa-server',
      'fa-share','fa-share-nodes','fa-shield','fa-shield-halved','fa-shuffle',
      'fa-sitemap','fa-sliders','fa-sort','fa-sort-down','fa-sort-up','fa-spinner',
      'fa-square','fa-square-check','fa-square-minus','fa-square-plus','fa-star',
      'fa-star-half','fa-sun','fa-swatchbook',
      'fa-table','fa-table-cells','fa-table-list','fa-tablet','fa-tag','fa-tags',
      'fa-thumbs-down','fa-thumbs-up','fa-ticket','fa-timeline','fa-toggle-off',
      'fa-toggle-on','fa-toolbox','fa-trash','fa-trash-arrow-up','fa-trophy',
      'fa-truck','fa-tv',
      'fa-upload','fa-user','fa-user-check','fa-user-clock','fa-user-gear',
      'fa-user-group','fa-user-minus','fa-user-pen','fa-user-plus','fa-user-shield',
      'fa-user-slash','fa-user-tag','fa-user-tie','fa-users','fa-users-gear',
      'fa-users-line','fa-utensils',
      'fa-video','fa-volume-high','fa-volume-low','fa-volume-xmark',
      'fa-wallet','fa-wifi','fa-wrench','fa-xmark'
    ];
    var brands = [
      'fa-behance','fa-discord','fa-dribbble','fa-facebook','fa-figma',
      'fa-github','fa-gitlab','fa-google','fa-google-drive','fa-instagram',
      'fa-jira','fa-linkedin','fa-microsoft','fa-notion','fa-slack',
      'fa-spotify','fa-telegram','fa-tiktok','fa-trello','fa-twitch',
      'fa-twitter','fa-whatsapp','fa-x-twitter','fa-youtube'
    ];
    return {
      'fa-solid':  solid.map(function(n)  { return { prefix: 'fa-solid',  name: n }; }),
      'fa-brands': brands.map(function(n) { return { prefix: 'fa-brands', name: n }; })
    };
  })();

  // ====================================================================
  // AUTOCOMPLETE DE ÍCONES nos inputs de admin
  // ====================================================================
  var ICON_INPUT_IDS = ['sq-icone', 'cat-icone', 'fm-icone', 'lk-icone'];
  var _autocompleteOpen = null; // id do input com dropdown aberto

  function initIconAutocomplete() {
    // Usa event delegation no edit-modal-body (gerado dinamicamente)
    var modalBody = document.getElementById('edit-modal-body');
    if (!modalBody) return;

    modalBody.addEventListener('input', function(e) {
      var id = e.target && e.target.id;
      if (ICON_INPUT_IDS.indexOf(id) === -1) return;
      renderIconAutocomplete(e.target);
    });

    modalBody.addEventListener('focusout', function(e) {
      var id = e.target && e.target.id;
      if (ICON_INPUT_IDS.indexOf(id) === -1) return;
      // Pequeno delay para permitir clique no dropdown antes de fechar
      setTimeout(function() { closeIconDropdown(id); }, 200);
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
      if (!_autocompleteOpen) return;
      var dropdown = document.getElementById('icon-ac-' + _autocompleteOpen);
      var input    = document.getElementById(_autocompleteOpen);
      if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
        closeIconDropdown(_autocompleteOpen);
      }
    });
  }

  function renderIconAutocomplete(input) {
    var id  = input.id;
    var val = (input.value || '').toLowerCase().trim();

    // Remove dropdown anterior
    closeIconDropdown(id);

    if (val.length < 2) {
      updateIconPreview(id, input.value.trim());
      return;
    }

    // Busca em solid + brands (com suporte PT)
    var allIcons = ICON_LIST['fa-solid'].concat(ICON_LIST['fa-brands']);
    var matches  = filterIcons(allIcons, val).slice(0, 24);

    if (matches.length === 0) {
      updateIconPreview(id, input.value.trim());
      return;
    }

    var dropdown = document.createElement('div');
    dropdown.id        = 'icon-ac-' + id;
    dropdown.className = 'icon-ac-dropdown';

    matches.forEach(function(ic) {
      var fullClass = ic.prefix + ' ' + ic.name;
      var item = document.createElement('div');
      item.className = 'icon-ac-item';
      item.innerHTML = '<i class="' + fullClass + '"></i><span>' + ic.name.replace('fa-', '') + '</span>';
      item.addEventListener('mousedown', function(e) {
        e.preventDefault(); // evita blur no input
        input.value = fullClass;
        updateIconPreview(id, fullClass);
        closeIconDropdown(id);
      });
      dropdown.appendChild(item);
    });

    // Posicionar relativo ao wrapper do input
    var wrapper = input.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);
    _autocompleteOpen = id;

    updateIconPreview(id, input.value.trim());
  }

  function closeIconDropdown(id) {
    var existing = document.getElementById('icon-ac-' + id);
    if (existing) existing.parentNode.removeChild(existing);
    if (_autocompleteOpen === id) _autocompleteOpen = null;
  }

  function updateIconPreview(inputId, value) {
    var previewId = 'icon-preview-' + inputId;
    var preview   = document.getElementById(previewId);
    if (!preview) return;
    if (value && value.indexOf('fa-') !== -1) {
      preview.innerHTML = '<i class="' + value + '"></i>';
      preview.style.display = 'inline-flex';
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
  }

  // Dicionário PT → termos de busca nos nomes dos ícones
  // Cada chave é um termo em português; o valor é array de fragmentos que batem com nomes FA
  var ICON_PT_DICT = {
    // Pessoas e usuários
    'pessoa':       ['user','people','person'],
    'pessoas':      ['users','people','group'],
    'usuario':      ['user'],
    'usuarios':     ['users','user-group'],
    'grupo':        ['group','users','people'],
    'equipe':       ['users','people','group','team'],
    'time':         ['users','people','group'],
    'gestor':       ['user-tie','user-gear'],
    'lider':        ['user-tie','crown'],
    'coordenador':  ['sitemap','user-tie'],
    'gerente':      ['user-tie','briefcase'],
    'perfil':       ['circle-user','id-card','id-badge','user'],
    // Comunicação
    'mensagem':     ['comment','envelope','paper-plane'],
    'email':        ['envelope','at'],
    'telefone':     ['phone','mobile'],
    'celular':      ['mobile','phone'],
    'notificacao':  ['bell'],
    'alerta':       ['bell','exclamation','circle-exclamation'],
    'chat':         ['comments','comment-dots','comment'],
    'reuniao':      ['calendar','people-group','video'],
    'anuncio':      ['bullhorn','megaphone'],
    // Navegação e ações
    'seta':         ['arrow','chevron','angle'],
    'voltar':       ['arrow-left','arrow-rotate-left','chevron-left'],
    'avancar':      ['arrow-right','chevron-right','forward'],
    'cima':         ['arrow-up','chevron-up','angle-up'],
    'baixo':        ['arrow-down','chevron-down','angle-down'],
    'buscar':       ['magnifying-glass','search'],
    'pesquisa':     ['magnifying-glass','search'],
    'procurar':     ['magnifying-glass','search'],
    'filtro':       ['filter','sliders'],
    'ordenar':      ['sort','sliders'],
    'atualizar':    ['arrows-rotate','rotate'],
    'recarregar':   ['arrows-rotate','rotate'],
    'fechar':       ['xmark','circle-xmark'],
    'apagar':       ['trash','eraser','xmark'],
    'deletar':      ['trash'],
    'editar':       ['pen-to-square','pencil','pen','edit'],
    'salvar':       ['floppy-disk','save'],
    'copiar':       ['copy','clipboard'],
    'colar':        ['clipboard'],
    'compartilhar': ['share','share-nodes'],
    'expandir':     ['expand','maximize'],
    'adicionar':    ['plus','circle-plus','square-plus'],
    'remover':      ['minus','circle-minus','square-minus'],
    'confirmar':    ['check','circle-check','check-double'],
    'cancelar':     ['xmark','ban'],
    'bloquear':     ['ban','lock','shield'],
    'desbloquear':  ['lock-open'],
    // Arquivos e documentos
    'arquivo':      ['file','folder'],
    'documento':    ['file-lines','file','clipboard'],
    'pasta':        ['folder','folder-open'],
    'pdf':          ['file-pdf'],
    'planilha':     ['file-excel','table'],
    'apresentacao': ['file-powerpoint','display'],
    'imagem':       ['image','photo-film','file-image'],
    'foto':         ['camera','image','photo-film'],
    'video':        ['video','film','photo-film'],
    'relatorio':    ['chart-bar','chart-line','file-lines','clipboard-list'],
    'formulario':   ['file-lines','clipboard','rectangle-list'],
    'lista':        ['list','list-ul','list-ol','clipboard-list'],
    'tabela':       ['table','table-cells','table-list'],
    // Gráficos e dados
    'grafico':      ['chart-bar','chart-line','chart-pie'],
    'pizza':        ['chart-pie'],
    'dados':        ['database','server'],
    'banco':        ['database','server','building'],
    'servidor':     ['server','database'],
    // Configurações e ferramentas
    'configuracao': ['gear','gears','sliders','screwdriver-wrench'],
    'ferramenta':   ['wrench','screwdriver-wrench','toolbox'],
    'chave':        ['key','wrench'],
    'engrenagem':   ['gear','gears'],
    'ajuste':       ['sliders','gear'],
    'painel':       ['gauge','sliders','display'],
    // Organização
    'estrutura':    ['sitemap','diagram-project','network-wired'],
    'hierarquia':   ['sitemap','diagram-project'],
    'mapa':         ['map','map-location-dot','sitemap'],
    'tag':          ['tag','tags'],
    'categoria':    ['tag','tags'],
    'marcador':     ['bookmark','tag','flag'],
    'bandeira':     ['flag'],
    // Localização
    'localizacao':  ['location-dot','map-pin','map'],
    'endereco':     ['location-dot','map','house'],
    'casa':         ['house','home'],
    'predio':       ['building'],
    'escritorio':   ['building','briefcase'],
    // Tempo e calendário
    'calendario':   ['calendar','calendar-days','calendar-check'],
    'relogio':      ['clock','hourglass'],
    'hora':         ['clock'],
    'data':         ['calendar','calendar-days'],
    'prazo':        ['calendar','clock','hourglass'],
    'aniversario':  ['cake-candles','gift'],
    // Dinheiro e negócios
    'dinheiro':     ['money-bill','wallet','coin'],
    'financeiro':   ['money-bill','wallet','chart-line'],
    'pagamento':    ['money-bill','wallet','credit-card'],
    'contrato':     ['file-lines','handshake','briefcase'],
    'parceria':     ['handshake'],
    // Redes e tecnologia
    'internet':     ['globe','wifi','network-wired'],
    'rede':         ['network-wired','globe','wifi'],
    'nuvem':        ['cloud','cloud-arrow-up','cloud-arrow-down'],
    'codigo':       ['code','code-branch'],
    'programacao':  ['code','laptop','display'],
    'computador':   ['laptop','display','desktop'],
    'celulares':    ['mobile','tablet'],
    'impressora':   ['print'],
    'impressao':    ['print'],
    // Status e feedback
    'sucesso':      ['check','circle-check','trophy'],
    'erro':         ['xmark','circle-xmark','exclamation'],
    'aviso':        ['exclamation','circle-exclamation','triangle-exclamation'],
    'informacao':   ['info','circle-info'],
    'ajuda':        ['question','circle-question'],
    'novo':         ['plus','star','bolt'],
    'favorito':     ['star','heart','bookmark'],
    'curtir':       ['heart','thumbs-up'],
    'nao-curtir':   ['thumbs-down'],
    // Conteúdo e mídia
    'livro':        ['book','book-open'],
    'leitura':      ['book-open','book'],
    'musica':       ['music','headphones'],
    'som':          ['volume-high','music','headphones'],
    'mudo':         ['volume-xmark'],
    'jogar':        ['play','gamepad'],
    'jogo':         ['gamepad','puzzle-piece'],
    'futebol':      ['futbol','trophy'],
    'trofeu':       ['trophy','medal','award'],
    'medalha':      ['medal','award'],
    'premio':       ['trophy','medal','award','gift'],
    // Social e marcas
    'social':       ['share-nodes','hashtag','at'],
    'link':         ['link','share','globe'],
    'site':         ['globe','link','earth-americas'],
    'mundo':        ['globe','earth-americas'],
    // Segurança
    'seguranca':    ['shield','lock','key','fingerprint'],
    'privacidade':  ['lock','shield','eye-slash'],
    'senha':        ['lock','key','fingerprint'],
    'protegido':    ['shield','shield-halved','lock'],
    // Outros comuns
    'sol':          ['sun'],
    'lua':          ['moon'],
    'noticias':     ['newspaper'],
    'jornal':       ['newspaper'],
    'foguete':      ['rocket'],
    'ideia':        ['lightbulb'],
    'lampada':      ['lightbulb'],
    'coracoes':     ['heart'],
    'coracao':      ['heart'],
    'diploma':      ['graduation-cap','award'],
    'formatura':    ['graduation-cap'],
    'caminhao':     ['truck'],
    'entrega':      ['truck','box'],
    'caixa':        ['box','box-open'],
    'presente':     ['gift'],
    'mesa':         ['chair','table'],
    'cadeira':      ['chair'],
    'quadro':       ['display','tv'],
    'televisao':    ['tv','display']
  };

  // Remove acentos e normaliza para comparação
  function normalizeStr(s) {
    return (s || '').toLowerCase()
      .replace(/[áàãâä]/g,'a').replace(/[éèêë]/g,'e')
      .replace(/[íìîï]/g,'i').replace(/[óòõôö]/g,'o')
      .replace(/[úùûü]/g,'u').replace(/[ç]/g,'c')
      .replace(/[ñ]/g,'n').replace(/[-_\s]/g,'');
  }

  // Expande termo de busca usando o dicionário PT (com normalização e correspondência parcial)
  function expandSearchTerms(val) {
    var normVal = normalizeStr(val);
    var terms   = [val]; // sempre inclui o original

    Object.keys(ICON_PT_DICT).forEach(function(ptWord) {
      var normKey = normalizeStr(ptWord);
      // Corresponde se: o termo bate com a chave (ou vice-versa), ou um é prefixo do outro
      var match = normKey.indexOf(normVal) !== -1 ||
                  normVal.indexOf(normKey) !== -1 ||
                  (normVal.length >= 3 && normKey.startsWith(normVal.slice(0,3)));
      if (match) {
        ICON_PT_DICT[ptWord].forEach(function(t) {
          if (terms.indexOf(t) === -1) terms.push(t);
        });
      }
    });
    return terms;
  }

  // Filtra lista de ícones por múltiplos termos (OR), com normalização
  function filterIcons(list, val) {
    if (!val || val.length < 2) return list;
    var normVal = normalizeStr(val);
    var terms   = expandSearchTerms(normVal);
    return list.filter(function(ic) {
      var haystack = normalizeStr(ic.prefix + ' ' + ic.name);
      return terms.some(function(t) { return haystack.indexOf(normalizeStr(t)) !== -1; });
    });
  }

  var _iconesActivePrefix = 'fa-solid';
  var _iconesSearchTerm   = '';

  function initIconesModal() {
    var btnOpen  = document.getElementById('btn-open-icones');
    var btnClose = document.getElementById('btn-close-icones');
    var overlay  = document.getElementById('icones-modal-overlay');
    var search   = document.getElementById('icones-search');
    var filterBtns = document.querySelectorAll('#icones-modal-overlay [data-prefix]');

    if (!btnOpen) return;

    btnOpen.addEventListener('click', function() {
      overlay.classList.add('show');
      search.focus();
      renderIconesGrid();
    });

    btnClose.addEventListener('click', function() {
      overlay.classList.remove('show');
    });

    // Fechar ao clicar fora do modal (sem fechar modais subjacentes)
    overlay.addEventListener('mousedown', function(e) {
      if (e.target === overlay) overlay.classList.remove('show');
    });

    // Busca
    search.addEventListener('input', function() {
      _iconesSearchTerm = this.value.toLowerCase().trim();
      renderIconesGrid();
    });

    // Filtro solid/brands
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        filterBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _iconesActivePrefix = btn.dataset.prefix;
        renderIconesGrid();
      });
    });
  }

  function renderIconesGrid() {
    var grid = document.getElementById('icones-grid');
    if (!grid) return;

    var list = ICON_LIST[_iconesActivePrefix] || [];
    if (_iconesSearchTerm) {
      list = filterIcons(list, _iconesSearchTerm);
    }

    if (list.length === 0) {
      grid.innerHTML = '<p class="icones-empty">Nenhum ícone encontrado.</p>';
      return;
    }

    var html = '';
    list.forEach(function(ic) {
      var fullClass = ic.prefix + ' ' + ic.name;
      var label     = ic.name.replace('fa-', '');
      html += '<div class="icone-card" onclick="window._copyIconName(\'' + fullClass + '\')" title="' + fullClass + '">' +
        '<i class="' + fullClass + '"></i>' +
        '<span>' + label + '</span>' +
      '</div>';
    });
    grid.innerHTML = html;
  }

  window._copyIconName = function(fullClass) {
    navigator.clipboard.writeText(fullClass).then(function() {
      hub.utils.showToast('Copiado: ' + fullClass, 'success');
    }).catch(function() {
      // Fallback
      var ta = document.createElement('textarea');
      ta.value = fullClass;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      hub.utils.showToast('Copiado: ' + fullClass, 'success');
    });
  };

  // ====================================================================
  // SCROLL DOS TABS COM SETAS
  // ====================================================================
  function initTabsScroll() {
    var wrapper   = document.getElementById('admin-tabs-wrapper');
    var container = wrapper && wrapper.parentElement;
    var btnLeft   = document.getElementById('tabs-scroll-left');
    var btnRight  = document.getElementById('tabs-scroll-right');

    if (!wrapper || !btnLeft || !btnRight) return;

    var STEP = 160; // px por clique

    function updateArrows() {
      var sl  = wrapper.scrollLeft;
      var max = wrapper.scrollWidth - wrapper.clientWidth;

      var canLeft  = sl > 2;
      var canRight = sl < max - 2;

      btnLeft.classList.toggle('visible', canLeft);
      btnRight.classList.toggle('visible', canRight);
      container.classList.toggle('can-scroll-left',  canLeft);
      container.classList.toggle('can-scroll-right', canRight);
    }

    btnLeft.addEventListener('click', function() {
      wrapper.scrollBy({ left: -STEP, behavior: 'smooth' });
    });
    btnRight.addEventListener('click', function() {
      wrapper.scrollBy({ left: STEP, behavior: 'smooth' });
    });

    wrapper.addEventListener('scroll', updateArrows, { passive: true });

    // Observa redimensionamento para recalcular
    if (window.ResizeObserver) {
      new ResizeObserver(updateArrows).observe(wrapper);
    } else {
      window.addEventListener('resize', updateArrows);
    }

    // Estado inicial (tabs podem já estar overflowing)
    updateArrows();
  }

  // ====================================================================
  // INIT
  // ====================================================================
  document.addEventListener('hub:ready', function(e) {
    if (!hub.auth.isAdminOrCoord()) {
      hub.utils.showToast('Acesso restrito a administradores', 'error');
      setTimeout(function() { window.location.href = hub.config.basePath + '/'; }, 2000);
      return;
    }
    document.getElementById('app-view').style.display = 'block';
    initTabsScroll();
    initIconesModal();
    initIconAutocomplete();

    // Pre-load org_structure for reuse across tabs
    hub.sb.from('org_structure').select('*').order('tipo').order('nome').then(function(result) {
      if (result.data) orgStructure = result.data;
      initRouter();
    });
  });

})();
