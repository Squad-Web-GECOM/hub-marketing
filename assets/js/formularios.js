(function() {
  'use strict';

  let allForms = [];

  document.addEventListener('hub:ready', async function() {
    // Guard: only run on formularios page
    if (!document.getElementById('forms-grid')) return;

    // Requer autenticação (externos autenticados podem acessar)
    if (!hub.auth.requireAuth()) return;

    const user = hub.auth.getUser();

    // Fetch forms
    const { data, error } = await hub.sb
      .from('forms')
      .select('*')
      .eq('is_active', true)
      .order('nome');

    if (error) {
      hub.utils.showToast('Erro ao carregar formulários', 'error');
      return;
    }

    allForms = data || [];

    // Filter for external users
    if (!user || user.isExternal) {
      allForms = allForms.filter(f => f.tipo === 'externo');
    }

    renderForms(allForms);
    document.getElementById('app-view').style.display = 'block';

    // Search handler
    var searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.addEventListener('input',
      hub.utils.debounce(function() {
        const q = this.value.toLowerCase();
        const filtered = allForms.filter(f =>
          f.nome.toLowerCase().includes(q) ||
          (f.descricao_breve || '').toLowerCase().includes(q)
        );
        renderForms(filtered);
      }, 200)
    );

    // Modal close: click outside + Escape
    var detailOverlay = document.getElementById('detail-modal-overlay');
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
    const grid = document.getElementById('forms-grid');
    const empty = document.getElementById('empty-state');
    if (!grid) return;

    if (forms.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('d-none');
      return;
    }

    if (empty) empty.classList.add('d-none');
    grid.innerHTML = forms.map((form, i) => `
      <div class="col-md-6 col-lg-4 mb-4 animate-fadeIn" style="animation-delay: ${i * 0.05}s">
        <div class="hub-card h-100">
          <div class="hub-card-body d-flex flex-column">
            <div class="mb-3">
              <i class="${hub.utils.normalizeIcon(form.icone, 'fa-solid fa-file-lines')} text-turq" style="font-size:2rem;"></i>
            </div>
            <h5 class="mb-2">${hub.utils.escapeHtml(form.nome)}</h5>
            <p class="text-muted flex-grow-1" style="font-size:0.9rem;">${hub.utils.escapeHtml(form.descricao_breve || '')}</p>
            <div class="d-flex gap-2 mt-3">
              ${form.descricao_completa ? `<button class="btn btn-sm btn-outline-primary" onclick="showFormDetail(${form.id})">Saiba mais</button>` : ''}
              <a href="${hub.utils.escapeHtml(form.link)}" target="_blank" class="btn btn-sm btn-primary">
                <i class="fa-solid fa-external-link"></i> Abrir
              </a>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Expose for onclick
  window.showFormDetail = function(formId) {
    const form = allForms.find(f => f.id === formId);
    if (!form) return;

    var titleEl = document.getElementById('detail-modal-title');
    var bodyEl = document.getElementById('detail-modal-body');
    var linkEl = document.getElementById('detail-modal-link');
    var overlayEl = document.getElementById('detail-modal-overlay');
    if (!titleEl || !bodyEl || !overlayEl) return;

    titleEl.textContent = form.nome;
    bodyEl.innerHTML =
      '<p>' + hub.utils.escapeHtml(form.descricao_completa || form.descricao_breve || '') + '</p>';
    if (linkEl) linkEl.href = form.link;
    overlayEl.classList.add('show');
  };

})();
