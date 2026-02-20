/**
 * HUB MARKETING - Página de Perfil
 * Exibe e permite editar o perfil de um usuário.
 * URL: /perfil/?u=user_name  (sem param = próprio usuário)
 */
(function() {
  'use strict';

  // ====================================================================
  // STATE
  // ====================================================================
  var targetUser    = null;  // dados completos do usuário exibido
  var loggedUser    = null;  // usuário autenticado
  var isOwnProfile  = false;
  var orgStructure  = [];
  var orgMap        = {};
  var pendingAvatar = null;  // File pendente de upload

  // ====================================================================
  // INIT
  // ====================================================================
  document.addEventListener('hub:ready', function() {
    if (!hub.auth.requireAuth()) return;
    if (!hub.auth.requireMarketingUser()) return;
    init();
  });

  async function init() {
    try {
      hub.utils.showLoader();
      loggedUser = hub.auth.getUser();

      var urlParams  = new URLSearchParams(window.location.search);
      var targetName = urlParams.get('u') || loggedUser.user_name;

      isOwnProfile = (targetName === loggedUser.user_name);

      // Carregar org_structure e perfil em paralelo
      var results = await Promise.all([
        hub.sb.from('org_structure').select('*').order('nome', { ascending: true }),
        hub.sb.from('users').select('*').eq('user_name', targetName).eq('is_active', true).single()
      ]);

      if (results[0].error) throw results[0].error;
      if (results[1].error || !results[1].data) {
        hub.utils.showToast('Usuário não encontrado', 'error');
        hub.utils.hideLoader();
        return;
      }

      orgStructure = results[0].data || [];
      orgMap = {};
      orgStructure.forEach(function(r) { orgMap[r.id] = r; });

      targetUser = results[1].data;

      renderProfile();
      await loadSquads(targetUser.id);

      if (isOwnProfile) {
        // Injetar botão Editar no header antes de setupEditModal (que busca o elemento)
        var headerActions = document.getElementById('perfil-header-actions');
        if (headerActions) {
          headerActions.innerHTML =
            '<button class="btn btn-secondary btn-sm" id="btn-editar-perfil-page">' +
            '<i class="fa-solid fa-pen mr-1"></i>Editar Perfil</button>';
        }
        setupEditModal();
        document.getElementById('btn-change-avatar').classList.remove('d-none');
      }

      document.getElementById('app-view').style.display = 'block';
    } catch (err) {
      console.error('Perfil init error:', err);
      hub.utils.showToast('Erro ao carregar perfil', 'error');
    } finally {
      hub.utils.hideLoader();
    }
  }

  // ====================================================================
  // HELPERS
  // ====================================================================
  function getOrgName(id) {
    if (!id || !orgMap[id]) return null;
    return orgMap[id].nome || null;
  }

  function getOrgsByType(tipo) {
    return orgStructure.filter(function(r) { return r.tipo === tipo; });
  }

  function getOrgsByTypeAndParent(tipo, parentId) {
    if (!parentId) return [];
    return orgStructure.filter(function(r) {
      return r.tipo === tipo && String(r.parent_id) === String(parentId);
    });
  }

  function calcIdade(aniversario) {
    if (!aniversario) return null;
    var parts = aniversario.split('-');
    if (parts.length < 3) return null;
    var year = parseInt(parts[0], 10);
    if (!year || year < 1920) return null;
    var hoje = new Date();
    var nasc  = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var idade = hoje.getFullYear() - nasc.getFullYear();
    var m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade >= 0 ? idade : null;
  }

  function calcSigno(aniversario) {
    if (!aniversario) return null;
    var parts = aniversario.split('-');
    if (parts.length < 3) return null;
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    var signos = [
      { nome: 'Capricórnio', emoji: '♑', ate: [1, 19] },
      { nome: 'Aquário',     emoji: '♒', ate: [2, 18] },
      { nome: 'Peixes',      emoji: '♓', ate: [3, 20] },
      { nome: 'Áries',       emoji: '♈', ate: [4, 19] },
      { nome: 'Touro',       emoji: '♉', ate: [5, 20] },
      { nome: 'Gêmeos',      emoji: '♊', ate: [6, 20] },
      { nome: 'Câncer',      emoji: '♋', ate: [7, 22] },
      { nome: 'Leão',        emoji: '♌', ate: [8, 22] },
      { nome: 'Virgem',      emoji: '♍', ate: [9, 22] },
      { nome: 'Libra',       emoji: '♎', ate: [10, 22] },
      { nome: 'Escorpião',   emoji: '♏', ate: [11, 21] },
      { nome: 'Sagitário',   emoji: '♐', ate: [12, 21] },
      { nome: 'Capricórnio', emoji: '♑', ate: [12, 31] }
    ];
    for (var i = 0; i < signos.length; i++) {
      if (m < signos[i].ate[0] || (m === signos[i].ate[0] && d <= signos[i].ate[1])) {
        return signos[i];
      }
    }
    return null;
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[2] + '/' + parts[1] + (parts[0] && parts[0] !== '0000' ? '/' + parts[0] : '');
  }

  function infoRow(icon, label, value) {
    if (!value) return '';
    return '<div class="perfil-info-row">' +
      '<i class="' + icon + ' perfil-info-icon"></i>' +
      '<div><span class="perfil-info-label">' + label + '</span>' +
      '<span class="perfil-info-value">' + hub.utils.escapeHtml(value) + '</span></div>' +
    '</div>';
  }

  function gostosTagsHtml(arr) {
    if (!arr || arr.length === 0) return '';
    return arr.map(function(item) {
      return '<span class="perfil-gosto-tag">' + hub.utils.escapeHtml(item.trim()) + '</span>';
    }).join('');
  }

  // ====================================================================
  // RENDER PROFILE
  // ====================================================================
  function renderProfile() {
    var u = targetUser;
    var esc = hub.utils.escapeHtml;

    // Título da página
    var pageTitle = document.getElementById('perfil-page-title');
    if (pageTitle) pageTitle.innerHTML = '<i class="fa-solid fa-user"></i> ' + esc(u.apelido || u.nome || 'Perfil');

    // Avatar
    var avatarEl = document.getElementById('perfil-avatar');
    if (avatarEl) {
      if (u.avatar_url) {
        avatarEl.innerHTML = '<img src="' + esc(u.avatar_url) + '" alt="Avatar" class="perfil-avatar-img">';
      } else {
        var initials = (u.apelido || u.nome || '?').charAt(0).toUpperCase();
        avatarEl.innerHTML = '<span class="perfil-avatar-initial">' + initials + '</span>';
      }
    }

    // Nome / apelido
    var nomeEl = document.getElementById('perfil-nome');
    if (nomeEl) nomeEl.textContent = u.nome || '';

    var apelidoEl = document.getElementById('perfil-apelido');
    if (apelidoEl) {
      apelidoEl.textContent = u.apelido ? '"' + u.apelido + '"' : '';
      if (!u.apelido) apelidoEl.style.display = 'none';
    }

    var usernameEl = document.getElementById('perfil-username');
    if (usernameEl) {
      usernameEl.textContent = u.user_name ? '@' + u.user_name : '';
      if (!u.user_name) usernameEl.style.display = 'none';
    }

    // Org info
    var orgEl = document.getElementById('perfil-org-info');
    if (orgEl) {
      var html = '';
      html += infoRow('fa-solid fa-building', 'Gerência', getOrgName(u.gerencia_id));
      html += infoRow('fa-solid fa-sitemap', 'Coordenação', getOrgName(u.coordenacao_id));
      html += infoRow('fa-solid fa-circle-dot', 'Núcleo', getOrgName(u.nucleo_id));
      orgEl.innerHTML = html || '<p class="text-muted" style="font-size:0.8rem;margin:0;">Sem estrutura definida.</p>';
    }

    // Aniversário + signo + idade
    var anivEl = document.getElementById('perfil-aniv-info');
    if (anivEl && u.aniversario) {
      var signo  = calcSigno(u.aniversario);
      var idade  = calcIdade(u.aniversario);
      var dataBR = formatDateBR(u.aniversario);

      var idadeStr  = idade !== null ? ' <span class="perfil-idade-badge">' + idade + ' anos</span>' : '';
      var signoHtml = signo ? '<div class="perfil-signo-row">' + signo.emoji + ' ' + esc(signo.nome) + '</div>' : '';

      anivEl.innerHTML =
        '<div class="perfil-info-row">' +
          '<i class="fa-solid fa-cake-candles perfil-info-icon"></i>' +
          '<div>' +
            '<span class="perfil-info-label">Aniversário</span>' +
            '<span class="perfil-info-value">' + dataBR + idadeStr + '</span>' +
            signoHtml +
          '</div>' +
        '</div>';
    }

    // Contato + endereço completo
    var contatoEl = document.getElementById('perfil-contato-info');
    if (contatoEl) {
      var html = '';
      // Senioridade — visível apenas para o próprio usuário ou admin/coord
      if (u.senioridade && (isOwnProfile || hub.auth.isAdminOrCoord())) {
        html += infoRow('fa-solid fa-star', 'Senioridade', u.senioridade);
      }
      html += infoRow('fa-solid fa-phone', 'Telefone', u.telefone);
      html += infoRow('fa-solid fa-location-dot', 'Bairro', u.bairro);
      // Montar endereço completo: logradouro + bairro + CEP
      var enderecoPartes = [];
      if (u.endereco) enderecoPartes.push(u.endereco);
      if (u.bairro && !u.endereco) { /* bairro já exibido acima */ }
      if (u.cep) enderecoPartes.push('CEP ' + u.cep);
      if (enderecoPartes.length) {
        html += infoRow('fa-solid fa-map-pin', 'Endereço', enderecoPartes.join(' — '));
      }
      contatoEl.innerHTML = html;
    }

    // Sobre mim
    var sobreEl = document.getElementById('perfil-sobre-mim');
    if (sobreEl) {
      if (u.sobre_mim && u.sobre_mim.trim()) {
        sobreEl.innerHTML = '<p style="white-space:pre-wrap; margin:0;">' + esc(u.sobre_mim.trim()) + '</p>';
      } else {
        sobreEl.innerHTML = '<p class="text-muted" style="font-size:0.875rem; margin:0; font-style:italic;">Nada escrito ainda.</p>';
      }
    }

    // Gostos pessoais
    var gostosEl = document.getElementById('perfil-gostos');
    if (gostosEl) {
      var g = u.gostos_pessoais || {};
      var hasAny = (g.livros && g.livros.length) ||
                   (g.filmes && g.filmes.length) ||
                   (g.comidas && g.comidas.length) ||
                   (g.hobbies && g.hobbies.length) ||
                   g.time_coracao;

      if (hasAny) {
        var html = '<div class="perfil-gostos-grid">';
        if (g.livros && g.livros.length)   html += gostoCard('fa-solid fa-book',    'Livros',   gostosTagsHtml(g.livros));
        if (g.filmes && g.filmes.length)   html += gostoCard('fa-solid fa-film',    'Filmes / Séries', gostosTagsHtml(g.filmes));
        if (g.comidas && g.comidas.length) html += gostoCard('fa-solid fa-utensils','Comidas',  gostosTagsHtml(g.comidas));
        if (g.hobbies && g.hobbies.length) html += gostoCard('fa-solid fa-gamepad', 'Hobbies',  gostosTagsHtml(g.hobbies));
        if (g.time_coracao) html += gostoCard('fa-solid fa-futbol', 'Time', '<span class="perfil-gosto-tag">' + esc(g.time_coracao) + '</span>');
        html += '</div>';
        gostosEl.innerHTML = html;
      } else {
        gostosEl.innerHTML = '<p class="text-muted" style="font-size:0.875rem; margin:0; font-style:italic;">Nada preenchido ainda.</p>';
      }
    }
  }

  function gostoCard(icon, label, tagsHtml) {
    return '<div class="perfil-gosto-card">' +
      '<div class="perfil-gosto-card-title"><i class="' + icon + '"></i> ' + label + '</div>' +
      '<div class="perfil-gosto-tags">' + tagsHtml + '</div>' +
    '</div>';
  }

  // ====================================================================
  // SQUADS
  // ====================================================================
  async function loadSquads(userId) {
    var listEl = document.getElementById('perfil-squads-list');
    if (!listEl) return;

    try {
      var resp = await hub.sb
        .from('squad_members')
        .select('squad_id, squads(id, nome, icone)')
        .eq('user_id', userId);

      if (resp.error) throw resp.error;

      var rows = (resp.data || []).filter(function(r) { return r.squads; });

      if (rows.length === 0) {
        listEl.innerHTML = '<p class="text-muted" style="font-size:0.875rem; margin:0;">Nenhum squad.</p>';
        return;
      }

      var html = '<div class="perfil-squads-chips">';
      rows.forEach(function(r) {
        var s    = r.squads;
        var icon = hub.utils.normalizeIcon(s.icone, 'fa-solid fa-layer-group');
        html += '<span class="perfil-squad-chip">' +
          '<i class="' + icon + '"></i> ' +
          hub.utils.escapeHtml(s.nome) +
        '</span>';
      });
      html += '</div>';
      listEl.innerHTML = html;
    } catch (err) {
      console.error('Squads load error:', err);
      listEl.innerHTML = '<p class="text-muted" style="font-size:0.875rem; margin:0;">Erro ao carregar.</p>';
    }
  }

  // ====================================================================
  // MODAL DE EDIÇÃO
  // ====================================================================
  function setupEditModal() {
    var u = targetUser;

    // Botão editar → abre modal
    var btnEdit = document.getElementById('btn-editar-perfil-page');
    if (btnEdit) btnEdit.addEventListener('click', openEditModal);

    // Botão alterar avatar na página
    var btnAvatar = document.getElementById('btn-change-avatar');
    if (btnAvatar) btnAvatar.addEventListener('click', function() { openEditModal(); });

    // Fechar modal
    document.getElementById('btn-close-perfil-edit').addEventListener('click', closeEditModal);
    document.getElementById('btn-cancel-perfil-edit').addEventListener('click', closeEditModal);

    // Avatar picker dentro do modal
    var btnAvatarPick = document.getElementById('btn-edit-avatar-pick');
    var avatarInput   = document.getElementById('edit-avatar-input');
    if (btnAvatarPick) btnAvatarPick.addEventListener('click', function() { avatarInput.click(); });
    if (avatarInput)   avatarInput.addEventListener('change', onAvatarFileChange);

    // Cascata org
    document.getElementById('edit-gerencia').addEventListener('change', updateEditCoord);
    document.getElementById('edit-coordenacao').addEventListener('change', updateEditNucleo);

    // Salvar
    document.getElementById('btn-save-perfil-edit').addEventListener('click', savePerfilEdit);
  }

  function openEditModal() {
    var u = targetUser;

    // Preencher campos
    document.getElementById('edit-nome').value        = u.nome || '';
    document.getElementById('edit-apelido').value     = u.apelido || '';
    document.getElementById('edit-telefone').value    = u.telefone || '';
    document.getElementById('edit-aniversario').value = u.aniversario || '';
    document.getElementById('edit-endereco').value    = u.endereco || '';
    document.getElementById('edit-bairro').value      = u.bairro || '';
    document.getElementById('edit-cep').value         = u.cep || '';
    document.getElementById('edit-sobre-mim').value   = u.sobre_mim || '';

    var g = u.gostos_pessoais || {};
    document.getElementById('edit-gostos-livros').value  = (g.livros  || []).join(', ');
    document.getElementById('edit-gostos-filmes').value  = (g.filmes  || []).join(', ');
    document.getElementById('edit-gostos-comidas').value = (g.comidas || []).join(', ');
    document.getElementById('edit-gostos-hobbies').value = (g.hobbies || []).join(', ');
    document.getElementById('edit-gostos-time').value    = g.time_coracao || '';

    // Avatar preview
    var previewEl = document.getElementById('edit-avatar-preview');
    if (previewEl) {
      if (u.avatar_url) {
        previewEl.innerHTML = '<img src="' + hub.utils.escapeHtml(u.avatar_url) + '" alt="Avatar">';
      } else {
        previewEl.innerHTML = '<i class="fa-solid fa-user"></i>';
      }
    }

    // Reset pending
    pendingAvatar = null;
    document.getElementById('avatar-error').classList.add('d-none');

    // Org dropdowns
    populateEditOrgDropdowns();

    document.getElementById('perfil-edit-overlay').classList.add('show');
  }

  function closeEditModal() {
    document.getElementById('perfil-edit-overlay').classList.remove('show');
    pendingAvatar = null;
  }

  function onAvatarFileChange(e) {
    var file     = e.target.files[0];
    var errEl    = document.getElementById('avatar-error');
    var previewEl = document.getElementById('edit-avatar-preview');

    errEl.classList.add('d-none');
    errEl.textContent = '';

    if (!file) return;

    // Validações
    var allowed = ['image/jpeg', 'image/png'];
    if (allowed.indexOf(file.type) === -1) {
      errEl.textContent = 'Apenas JPG ou PNG são aceitos.';
      errEl.classList.remove('d-none');
      e.target.value = '';
      return;
    }
    if (file.size > 150 * 1024) {
      errEl.textContent = 'A imagem deve ter no máximo 150 KB (atual: ' + Math.round(file.size / 1024) + ' KB).';
      errEl.classList.remove('d-none');
      e.target.value = '';
      return;
    }

    pendingAvatar = file;

    // Preview local
    var reader = new FileReader();
    reader.onload = function(ev) {
      previewEl.innerHTML = '<img src="' + ev.target.result + '" alt="Preview">';
    };
    reader.readAsDataURL(file);
  }

  function populateEditOrgDropdowns() {
    var u = targetUser;
    var gerencias = getOrgsByType('gerencia');

    var selGer = document.getElementById('edit-gerencia');
    selGer.innerHTML = '<option value="">Selecione...</option>';
    gerencias.forEach(function(g) {
      var sel = (u && String(u.gerencia_id) === String(g.id)) ? ' selected' : '';
      selGer.innerHTML += '<option value="' + g.id + '"' + sel + '>' + hub.utils.escapeHtml(g.nome) + '</option>';
    });

    updateEditCoord();
  }

  function updateEditCoord() {
    var gerenciaId = document.getElementById('edit-gerencia').value;
    var selCoord   = document.getElementById('edit-coordenacao');
    var u = targetUser;

    if (!gerenciaId) {
      selCoord.innerHTML = '<option value="">Selecione a gerência primeiro</option>';
      updateEditNucleo();
      return;
    }

    var coords = getOrgsByTypeAndParent('coordenacao', gerenciaId);
    selCoord.innerHTML = '<option value="">Selecione...</option>';
    coords.forEach(function(c) {
      var sel = (u && String(u.coordenacao_id) === String(c.id)) ? ' selected' : '';
      selCoord.innerHTML += '<option value="' + c.id + '"' + sel + '>' + hub.utils.escapeHtml(c.nome) + '</option>';
    });
    updateEditNucleo();
  }

  function updateEditNucleo() {
    var coordId    = document.getElementById('edit-coordenacao').value;
    var selNucleo  = document.getElementById('edit-nucleo');
    var u = targetUser;

    if (!coordId) {
      selNucleo.innerHTML = '<option value="">Nenhum (ainda não definido)</option>';
      return;
    }

    var nucleos = getOrgsByTypeAndParent('nucleo', coordId);
    selNucleo.innerHTML = '<option value="">Nenhum (ainda não definido)</option>';
    nucleos.forEach(function(n) {
      var sel = (u && String(u.nucleo_id) === String(n.id)) ? ' selected' : '';
      selNucleo.innerHTML += '<option value="' + n.id + '"' + sel + '>' + hub.utils.escapeHtml(n.nome) + '</option>';
    });
  }

  // ====================================================================
  // SALVAR PERFIL
  // ====================================================================
  async function savePerfilEdit() {
    var btnSave = document.getElementById('btn-save-perfil-edit');
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Salvando...'; }

    try {
      var gerenciaId = document.getElementById('edit-gerencia').value || null;
      var coordId    = document.getElementById('edit-coordenacao').value || null;
      var nucleoId   = document.getElementById('edit-nucleo').value || null;

      if (!gerenciaId || !coordId) {
        hub.utils.showToast('Selecione pelo menos a gerência e a coordenação', 'warning');
        return;
      }

      // Gostos pessoais
      var splitTrim = function(str) {
        return str ? str.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
      };
      var gostos = {
        livros:       splitTrim(document.getElementById('edit-gostos-livros').value),
        filmes:       splitTrim(document.getElementById('edit-gostos-filmes').value),
        comidas:      splitTrim(document.getElementById('edit-gostos-comidas').value),
        hobbies:      splitTrim(document.getElementById('edit-gostos-hobbies').value),
        time_coracao: (document.getElementById('edit-gostos-time').value || '').trim() || null
      };

      var updates = {
        gerencia_id:     gerenciaId,
        coordenacao_id:  coordId,
        nucleo_id:       nucleoId,
        apelido:         (document.getElementById('edit-apelido').value || '').trim() || null,
        telefone:        (document.getElementById('edit-telefone').value || '').trim() || null,
        aniversario:     document.getElementById('edit-aniversario').value || null,
        endereco:        (document.getElementById('edit-endereco').value || '').trim() || null,
        bairro:          (document.getElementById('edit-bairro').value || '').trim() || null,
        cep:             (document.getElementById('edit-cep').value || '').trim() || null,
        sobre_mim:       (document.getElementById('edit-sobre-mim').value || '').trim() || null,
        gostos_pessoais: gostos,
        profile_complete: true
      };

      // Upload do avatar se houver pendente
      if (pendingAvatar) {
        var ext      = pendingAvatar.name.split('.').pop().toLowerCase();
        var fileName = targetUser.user_name + '.' + ext;

        var uploadResp = await hub.sb.storage
          .from('Avatars')
          .upload(fileName, pendingAvatar, { upsert: true, contentType: pendingAvatar.type });

        if (uploadResp.error) {
          hub.utils.showToast('Erro ao enviar foto: ' + uploadResp.error.message, 'error');
          return;
        }

        var urlData = hub.sb.storage.from('Avatars').getPublicUrl(fileName);
        updates.avatar_url = urlData.data.publicUrl;
      }

      var resp = await hub.sb.from('users').update(updates).eq('id', targetUser.id);
      if (resp.error) {
        hub.utils.showToast('Erro ao salvar: ' + resp.error.message, 'error');
        return;
      }

      hub.utils.showToast('Perfil atualizado!', 'success');
      closeEditModal();

      // Invalida cache e recarrega
      try {
        localStorage.removeItem('hub_cached_user');
        localStorage.removeItem('hub_cached_role');
        localStorage.removeItem('hub_cached_source');
      } catch(e) {}

      setTimeout(function() { window.location.reload(); }, 600);

    } catch (err) {
      console.error('savePerfilEdit error:', err);
      hub.utils.showToast('Erro inesperado ao salvar', 'error');
    } finally {
      if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i>Salvar'; }
    }
  }

})();
