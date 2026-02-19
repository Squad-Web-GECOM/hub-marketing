(function() {
  'use strict';

  let allForms = [];

  document.addEventListener('hub:ready', async function() {
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
    document.getElementById('filter-search').addEventListener('input',
      hub.utils.debounce(function() {
        const q = this.value.toLowerCase();
        const filtered = allForms.filter(f =>
          f.nome.toLowerCase().includes(q) ||
          (f.descricao_breve || '').toLowerCase().includes(q)
        );
        renderForms(filtered);
      }, 200)
    );
  });

  function renderForms(forms) {
    const grid = document.getElementById('forms-grid');
    const empty = document.getElementById('empty-state');

    if (forms.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('d-none');
      return;
    }

    empty.classList.add('d-none');
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

    document.getElementById('detail-modal-title').textContent = form.nome;
    document.getElementById('detail-modal-body').innerHTML =
      '<p>' + hub.utils.escapeHtml(form.descricao_completa || form.descricao_breve || '') + '</p>';
    document.getElementById('detail-modal-link').href = form.link;
    document.getElementById('detail-modal-overlay').classList.add('show');
  };

})();
