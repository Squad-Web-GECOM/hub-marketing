(function() {
  'use strict';

  var allForms = [];

  document.addEventListener('hub:ready', async function() {
    // Guard: only run on formularios page
    if (!document.getElementById('forms-grid')) return;

    // Requer autenticação (externos autenticados podem acessar)
    if (!hub.auth.requireAuth()) return;

    var user = hub.auth.getUser();
    var response = await hub.sb
      .from('forms')
      .select('*')
      .eq('is_active', true)
      .order('nome');

    if (response.error) {
      hub.utils.showToast('Erro ao carregar formulários', 'error');
      return;
    }

    allForms = response.data || [];

    // Filter for external users
    if (!user || user.isExternal) {
      allForms = allForms.filter(function(form) {
        return form.tipo === 'externo';
      });
    }

    renderForms(allForms);
    document.getElementById('app-view').style.display = 'block';

    // Search handler
    var searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener(
        'input',
        hub.utils.debounce(function() {
          var query = (this.value || '').toLowerCase();
          var filtered = allForms.filter(function(form) {
            var nome = (form.nome || '').toLowerCase();
            var descricao = (form.descricao_breve || '').toLowerCase();
            return nome.indexOf(query) !== -1 || descricao.indexOf(query) !== -1;
          });
          renderForms(filtered);
        }, 200)
      );
    }

    // Modal close: button + click outside + Escape
    var detailOverlay = document.getElementById('detail-modal-overlay');
    var btnCloseDetail = document.getElementById('btn-close-detail-modal');
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', function() { detailOverlay.classList.remove('show'); });
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function(e) {
        if (e.target === detailOverlay) detailOverlay.classList.remove('show');
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('detail-modal-overlay');
        if (overlay) overlay.classList.remove('show');
      }
    });
  });

  function renderForms(forms) {
    var grid = document.getElementById('forms-grid');
    var empty = document.getElementById('empty-state');
    if (!grid) return;

    if (!forms || forms.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('d-none');
      return;
    }

    if (empty) empty.classList.add('d-none');

    var html = '';
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      var iconClass = hub.utils.normalizeIcon(form.icone, 'fa-solid fa-file-lines');
      var formId = String(form.id || '');
      var detailBtn = '';

      if (form.descricao_completa) {
        detailBtn =
          '<button class="btn btn-sm btn-outline-primary js-form-detail" data-form-id="' + hub.utils.escapeHtml(formId) + '">' +
            'Saiba mais' +
          '</button>';
      }

      html +=
        '<div class="col-md-6 col-lg-4 mb-4 animate-fadeIn">' +
          '<div class="hub-card h-100">' +
            '<div class="hub-card-body d-flex flex-column">' +
              '<div class="mb-3">' +
                '<i class="' + hub.utils.escapeHtml(iconClass) + ' text-turq hub-form-card-icon"></i>' +
              '</div>' +
              '<h5 class="mb-2">' + hub.utils.escapeHtml(form.nome || '') + '</h5>' +
              '<p class="text-muted flex-grow-1 hub-form-card-desc">' + hub.utils.escapeHtml(form.descricao_breve || '') + '</p>' +
              '<div class="d-flex gap-2 mt-3">' +
                detailBtn +
                '<a href="' + hub.utils.escapeHtml(form.link || '#') + '" target="_blank" class="btn btn-sm btn-primary">' +
                  '<i class="fa-solid fa-external-link"></i> Abrir' +
                '</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    grid.innerHTML = html;

    var detailButtons = grid.querySelectorAll('.js-form-detail');
    for (var b = 0; b < detailButtons.length; b++) {
      detailButtons[b].addEventListener('click', function() {
        showFormDetail(this.getAttribute('data-form-id'));
      });
    }
  }

  function showFormDetail(formId) {
    var form = null;
    for (var i = 0; i < allForms.length; i++) {
      if (String(allForms[i].id) === String(formId)) {
        form = allForms[i];
        break;
      }
    }
    if (!form) return;

    var titleEl = document.getElementById('detail-modal-title');
    var bodyEl = document.getElementById('detail-modal-body');
    var linkEl = document.getElementById('detail-modal-link');
    var overlayEl = document.getElementById('detail-modal-overlay');
    if (!titleEl || !bodyEl || !overlayEl) return;

    titleEl.textContent = form.nome || 'Detalhes';
    bodyEl.innerHTML =
      '<p>' + hub.utils.escapeHtml(form.descricao_completa || form.descricao_breve || '') + '</p>';
    if (linkEl) linkEl.href = form.link || '#';
    overlayEl.classList.add('show');
  }

  // Backward-compatible global hook for existing markup conventions
  window.showFormDetail = showFormDetail;
})();
