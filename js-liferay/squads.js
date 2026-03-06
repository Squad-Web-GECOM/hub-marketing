/* ==============================================================
 * Hub Marketing — squads.js (build Liferay)
 * Gerado em: 2026-03-06 17:45:20
 * Contém: config + main.js + squads.js
 * ============================================================== */

// ─── Configuração desta página (ANTES de main.js) ───
window.HUB_PAGE = 'squads';
window.HUB_PAGES = {
  home:        '/web/mkt/home',
  mesas:       '/web/mkt/mesas',
  squads:      '/web/mkt/squads',
  formularios: '/web/mkt/formularios',
  usuarios:    '/web/mkt/usuarios',
  admin:       '/web/mkt/admin',
  perfil:      '/web/mkt/perfil'
};

/**
 * HUB MARKETING - Modulo Compartilhado
 * Supabase, Auth, Nav, Dark Mode, Utils
 */
(function() {
  'use strict';

  // ====================================================================
  // CONFIG (Supabase key obfuscated)
  // ====================================================================
  const _p1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const _p2 = '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWl0b2NvcGpkaWx4Z3Vwcmls';
  const _p3 = 'Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODM5MTEsImV4cCI6MjA3MTk1OTkxMX0';
  const _p4 = '.GTqh--djGKQfCgCnlpRNNx75KMEXNImSPcs8OQ7K5gc';

  const HUB_CONFIG = {
    URL: 'https://gcqitocopjdilxgupril.supabase.co',
    KEY: _p1 + _p2 + _p3 + _p4
  };

  // Cache keys (new keys to break old cache)
  const CACHE_KEYS = {
    USER: 'hub_cached_user',
    ROLE: 'hub_cached_role',
    SOURCE: 'hub_cached_source'
  };

  // Versão do schema do cache — incrementar força refresh em todos os navegadores
  const CACHE_VERSION = '2';
  const CACHE_VERSION_KEY = 'hub_cache_version';

  // Invalida cache se versão mudou
  (function() {
    if (localStorage.getItem(CACHE_VERSION_KEY) !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEYS.USER);
      localStorage.removeItem(CACHE_KEYS.ROLE);
      localStorage.removeItem(CACHE_KEYS.SOURCE);
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
    }
  })();

  // ====================================================================
  // SUPABASE INIT
  // ====================================================================
  let sbClient = null;
  function getSb() {
    if (!sbClient) {
      sbClient = window.supabase.createClient(HUB_CONFIG.URL, HUB_CONFIG.KEY);
    }
    return sbClient;
  }

  // ====================================================================
  // AUTH MODULE
  // ====================================================================
  const auth = {
    _user: null,
    _role: null,
    _source: null, // 'liferay', 'secret', 'view'

    async check() {
      // 1. Try localStorage cache
      const cachedUser = localStorage.getItem(CACHE_KEYS.USER);
      const cachedRole = localStorage.getItem(CACHE_KEYS.ROLE);
      const cachedSource = localStorage.getItem(CACHE_KEYS.SOURCE);

      if (cachedUser && cachedRole) {
        this._user = JSON.parse(cachedUser);
        this._role = JSON.parse(cachedRole);
        this._source = cachedSource || 'cache';

        // Se apelido estiver ausente no cache (sessão antiga), atualiza silenciosamente do banco
        if (!this._user.apelido && this._user.user_name && !this._user.isExternal) {
          try {
            await this._lookupUser(this._user.user_name);
            this._saveCache();
          } catch(e) {
            // silencioso — mantém cache atual
          }
        }

        return true;
      }

      // 2. window.localPart (injetado pelo template FreeMarker do Liferay)
      if (window.localPart) {
        try {
          var localPartUser = String(window.localPart).toLowerCase().trim();
          if (localPartUser && localPartUser !== 'guest') {
            var foundLp = await this._lookupUser(localPartUser);
            if (foundLp) {
              this._source = 'liferay';
              this._saveCache();
              return true;
            } else {
              var lpEmail = window.email || (localPartUser + '@sicoob.com.br');
              this._user = { user_name: localPartUser, email: lpEmail, nome: localPartUser, isExternal: true };
              this._role = { isAdmin: false, isCoordenador: false };
              this._source = 'liferay_external';
              this._saveCache();
              return true;
            }
          }
        } catch(e) { /* silencioso */ }
      }

      // 3. Try Liferay ThemeDisplay
      try {
        if (typeof Liferay !== 'undefined' && Liferay.ThemeDisplay) {
          var email = Liferay.ThemeDisplay.getUserEmailAddress().toLowerCase();
          if (email && email !== '' && !email.includes('default')) {
            var userName = email.split('@')[0];
            var found = await this._lookupUser(userName);
            if (found) {
              this._source = 'liferay';
              this._saveCache();
              return true;
            } else {
              // User logged in Liferay but not in marketing users table = external
              this._user = { user_name: userName, email: email, nome: userName, isExternal: true };
              this._role = { isAdmin: false, isCoordenador: false };
              this._source = 'liferay_external';
              this._saveCache();
              return true;
            }
          }
        }
      } catch(e) {
        console.info('Hub: Liferay not available');
      }

      // 4. No auth - view mode
      this._source = 'view';
      return false;
    },

    async login(input) {
      // Secret login: extract user_name, lowercase, no @domain
      var userName = input.toLowerCase().trim();
      if (userName.includes('@')) {
        userName = userName.split('@')[0];
      }

      var found = await this._lookupUser(userName);
      if (found) {
        this._source = 'secret';
        this._saveCache();
        return { success: true, user: this._user };
      }
      return { success: false, error: 'Usuario nao encontrado' };
    },

    async _lookupUser(userName) {
      // Step 1: fetch user row with select('*')
      var resp = await getSb()
        .from('users')
        .select('*')
        .eq('user_name', userName)
        .eq('is_active', true)
        .single();

      if (resp.error || !resp.data) return false;

      var data = resp.data;

      // Step 2: resolve org_structure names if IDs are present
      var gerenciaNome = null;
      var coordenacaoNome = null;
      var nucleoNome = null;

      var orgIds = [data.gerencia_id, data.coordenacao_id, data.nucleo_id].filter(Boolean);
      if (orgIds.length > 0) {
        var orgResp = await getSb()
          .from('org_structure')
          .select('id, nome')
          .in('id', orgIds);

        if (orgResp.data && orgResp.data.length > 0) {
          var orgMap = {};
          orgResp.data.forEach(function(row) { orgMap[row.id] = row.nome; });
          gerenciaNome = data.gerencia_id ? (orgMap[data.gerencia_id] || null) : null;
          coordenacaoNome = data.coordenacao_id ? (orgMap[data.coordenacao_id] || null) : null;
          nucleoNome = data.nucleo_id ? (orgMap[data.nucleo_id] || null) : null;
        }
      }

      this._user = {
        id: data.id,
        user_name: data.user_name,
        nome: data.nome,
        apelido: data.apelido || null,
        email: data.email,
        gerencia_id: data.gerencia_id,
        coordenacao_id: data.coordenacao_id,
        nucleo_id: data.nucleo_id,
        gerencia_nome: gerenciaNome,
        coordenacao_nome: coordenacaoNome,
        nucleo_nome: nucleoNome,
        terceirizado: data.terceirizado,
        profileComplete: data.profile_complete,
        aniversario: data.aniversario,
        telefone: data.telefone,
        isExternal: false
      };

      this._role = {
        isAdmin: data.is_admin,
        isCoordenador: data.is_gestor  // coluna renomeada de is_coordenador para is_gestor
      };

      return true;
    },

    _saveCache: function() {
      localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(this._user));
      localStorage.setItem(CACHE_KEYS.ROLE, JSON.stringify(this._role));
      localStorage.setItem(CACHE_KEYS.SOURCE, this._source);
    },

    logout: function() {
      localStorage.removeItem(CACHE_KEYS.USER);
      localStorage.removeItem(CACHE_KEYS.ROLE);
      localStorage.removeItem(CACHE_KEYS.SOURCE);
      this._user = null;
      this._role = null;
      this._source = null;
      // Em Liferay o reload relogaria via SSO — redirecionar ao logout do portal
      if (window.localPart || typeof Liferay !== 'undefined') {
        window.location.href = '/c/portal/logout';
      } else {
        window.location.reload();
      }
    },

    getUser: function() {
      if (!this._user) return null;
      var u = Object.assign({}, this._user, {
        isAdmin: this._role ? this._role.isAdmin : false,
        isCoordenador: this._role ? this._role.isCoordenador : false
      });
      return u;
    },

    isAuthenticated: function() {
      return this._user !== null && this._source !== 'view';
    },

    isAdmin: function() {
      return this._role && this._role.isAdmin;
    },

    isCoordenador: function() {
      return this._role && this._role.isCoordenador;
    },

    isAdminOrCoord: function() {
      return this.isAdmin() || this.isCoordenador();
    },

    requireAuth: function(redirectUrl) {
      if (!this.isAuthenticated()) {
        var page = _getCurrentPage();
        if (page === 'mesas') return false;
        this.showLoginModal();
        return false;
      }
      return true;
    },

    requireMarketingUser: function() {
      if (!this._user || this._user.isExternal) {
        window.location.href = _getPageHref('formularios', '/formularios/');
        return false;
      }
      return true;
    },

    showLoginModal: function() {
      var overlay = document.getElementById('login-overlay');
      if (overlay) overlay.classList.add('show');
    },

    hideLoginModal: function() {
      var overlay = document.getElementById('login-overlay');
      if (overlay) overlay.classList.remove('show');
    }
  };

  // ====================================================================
  // BASE PATH — suporta GitHub Pages (/hub-marketing/) e Liferay (/)
  // Detecta o prefixo pelo src do próprio script main.js
  // ====================================================================
  var BASE_PATH = (function() {
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      // Procura por "assets/js/main.js" no src (relativo ou absoluto)
      var match = src.match(/^(.*?)(?:\.\.\/)*assets\/js\/main\.js/);
      if (match) {
        // src relativo: pegar o pathname atual menos segmentos de subpasta
        var depth = (src.match(/\.\.\//g) || []).length;
        var parts = window.location.pathname.replace(/\/$/, '').split('/');
        parts = parts.slice(0, parts.length - depth);
        return parts.join('/');
      }
    }
    return '';
  })();

  // ====================================================================
  // PAGE HELPERS — suporta window.HUB_PAGE / window.HUB_PAGES (Liferay)
  // window.HUB_PAGE  = 'home'          → define a página atual
  // window.HUB_PAGES = { home: '/url', squads: '/url', ... } → URLs do nav
  // ====================================================================
  function _getCurrentPage() {
    if (window.HUB_PAGE) return window.HUB_PAGE;
    if (document.documentElement.dataset.page) return document.documentElement.dataset.page;
    var el = document.querySelector('[data-page]');
    return el ? el.dataset.page : 'home';
  }

  function _getPageHref(pageId, defaultPath) {
    if (window.HUB_PAGES && window.HUB_PAGES[pageId]) return window.HUB_PAGES[pageId];
    return BASE_PATH + defaultPath;
  }

  // ====================================================================
  // NAV MODULE
  // ====================================================================
  var nav = {
    items: [
      { id: 'home', label: 'Home', icon: 'fa-house', href: BASE_PATH + '/' },
      { id: 'mesas', label: 'Mesas', icon: 'fa-chair', href: BASE_PATH + '/mesas/' },
      { id: 'squads', label: 'Squads', icon: 'fa-users-gear', href: BASE_PATH + '/squads/' },
      { id: 'formularios', label: 'Formularios', icon: 'fa-file-lines', href: BASE_PATH + '/formularios/' },
      { id: 'usuarios', label: 'Usuarios', icon: 'fa-user-group', href: BASE_PATH + '/usuarios/' }
    ],
    adminItems: [
      { id: 'admin', label: 'Admin', icon: 'fa-gear', href: BASE_PATH + '/admin/' }
    ],

    render: function() {
      var container = document.getElementById('hub-nav');
      if (!container) return;

      var currentPage = _getCurrentPage();
      var user = auth.getUser();
      var isAdminOrCoord = auth.isAdminOrCoord();

      // Externos e deslogados: sem menu (só página de mesas acessível sem login)
      var isExternal = user && user.isExternal;
      var isLoggedOut = !auth.isAuthenticated();
      var hideNav = isExternal || isLoggedOut;

      // Build nav items HTML (apenas para usuários internos logados)
      var navItemsHTML = '';
      if (!hideNav) {
        navItemsHTML = this.items.map(function(item) {
          var href = (window.HUB_PAGES && window.HUB_PAGES[item.id]) ? window.HUB_PAGES[item.id] : item.href;
          return '<li><a href="' + href + '" class="' + (item.id === currentPage ? 'active' : '') + '" data-nav="' + item.id + '">' +
            '<i class="fa-solid ' + item.icon + '"></i>' +
            '<span>' + item.label + '</span>' +
            '</a></li>';
        }).join('');

        if (isAdminOrCoord) {
          navItemsHTML += '<li class="nav-divider"></li>';
          navItemsHTML += this.adminItems.map(function(item) {
            var href = (window.HUB_PAGES && window.HUB_PAGES[item.id]) ? window.HUB_PAGES[item.id] : item.href;
            return '<li><a href="' + href + '" class="' + (item.id === currentPage ? 'active' : '') + '" data-nav="' + item.id + '">' +
              '<i class="fa-solid ' + item.icon + '"></i>' +
              '<span>' + item.label + '</span>' +
              '</a></li>';
          }).join('');
        }
      }

      // User info for footer
      var userHTML;
      if (user && !isExternal) {
        var roleLabel = user.isAdmin ? 'Admin' : (user.isCoordenador ? 'Coordenador' : 'Marketing');
        var editarPerfilBtn = '<button onclick="hub.nav.goToPerfil()" title="Meu perfil" class="btn-editar-perfil">' +
              '<i class="fa-solid fa-user-pen"></i>' +
            '</button>';
        userHTML = '' +
          '<div class="hub-sidebar-user">' +
            '<div>' +
              '<div class="user-name">' + hub.utils.escapeHtml(user.apelido || user.nome || user.user_name) + '</div>' +
              '<div class="user-username">@' + user.user_name + '</div>' +
              '<div class="user-role">' + roleLabel + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hub-sidebar-actions">' +
            editarPerfilBtn +
            '<button onclick="hub.darkMode.toggle()" title="Alternar tema" class="btn-theme-toggle">' +
              '<i class="fa-solid fa-circle-half-stroke"></i>' +
            '</button>' +
            '<button onclick="window.open(\'https://forms.gle/oorKXGhJhrFQUnhu8\', \'_blank\')" title="Ajuda">' +
              '<i class="fa-solid fa-circle-question"></i>' +
            '</button>' +
            '<button onclick="hub.auth.logout()" title="Sair">' +
              '<i class="fa-solid fa-right-from-bracket"></i>' +
            '</button>' +
          '</div>';
      } else {
        // Deslogado ou externo: apenas botão de login
        userHTML = '' +
          '<button class="btn btn-sm btn-outline-light w-100" onclick="hub.auth.showLoginModal()">' +
            '<i class="fa-solid fa-right-to-bracket"></i> Entrar' +
          '</button>';
      }

      // Sidebar só renderiza para usuários logados internos
      var shouldRenderSidebar = !hideNav;

      if (shouldRenderSidebar) {
        container.innerHTML = '' +
          '<button class="hub-hamburger" onclick="hub.nav.toggleMobile()">' +
            '<i class="fa-solid fa-bars"></i>' +
          '</button>' +
          '<div class="hub-sidebar-overlay" onclick="hub.nav.toggleMobile()"></div>' +
          '<nav class="hub-sidebar" id="hub-sidebar">' +
            '<div class="hub-sidebar-header" style="display:flex;align-items:center;justify-content:space-between;">' +
              '<h2><i class="fa-solid fa-bullhorn"></i> <span>Hub <span class="script">MKT</span></span></h2>' +
              '<button class="hub-sidebar-collapse" onclick="hub.nav.toggleCollapse()" title="Fechar menu">' +
                '<i class="fa-solid fa-chevron-left" id="sidebar-collapse-icon"></i>' +
              '</button>' +
            '</div>' +
            '<ul class="hub-sidebar-nav">' +
              navItemsHTML +
            '</ul>' +
            '<div class="hub-sidebar-footer">' +
              userHTML +
            '</div>' +
          '</nav>';
      } else {
        // Sem sidebar (deslogado / externo): remove margem lateral do conteúdo
        document.body.classList.add('hub-no-sidebar');
      }
    },

    toggleMobile: function() {
      var sidebar = document.getElementById('hub-sidebar');
      var overlay = document.querySelector('.hub-sidebar-overlay');
      if (sidebar) sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    },

    toggleCollapse: function() {
      var sidebar = document.getElementById('hub-sidebar');
      var content = document.querySelector('.hub-content');
      var icon = document.getElementById('sidebar-collapse-icon');
      if (!sidebar) return;

      var isCollapsed = sidebar.classList.toggle('collapsed');
      if (content) content.classList.toggle('sidebar-collapsed', isCollapsed);
      if (icon) {
        icon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
      }
      // Persist preference
      try { localStorage.setItem('hub_sidebar_collapsed', isCollapsed ? '1' : '0'); } catch(e) {}
    },

    restoreCollapse: function() {
      try {
        if (localStorage.getItem('hub_sidebar_collapsed') === '1') {
          var sidebar = document.getElementById('hub-sidebar');
          var content = document.querySelector('.hub-content');
          var icon = document.getElementById('sidebar-collapse-icon');
          if (sidebar) sidebar.classList.add('collapsed');
          if (content) content.classList.add('sidebar-collapsed');
          if (icon) icon.className = 'fa-solid fa-chevron-right';
        }
      } catch(e) {}
    },

    goToPerfil: function() {
      window.location.href = _getPageHref('perfil', '/perfil/');
    },

    openEditarPerfil: function() {
      window.location.href = _getPageHref('perfil', '/perfil/') + '?edit=1';
    }
  };

  // ====================================================================
  // DARK MODE MODULE
  // ====================================================================
  var darkMode = {
    KEY: 'hub_dark_mode',

    init: function() {
      var saved = localStorage.getItem(this.KEY);
      if (saved === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      this._updateIcon();
    },

    toggle: function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(this.KEY, 'false');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(this.KEY, 'true');
      }
      this._updateIcon();
    },

    isDark: function() {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    },

    _updateIcon: function() {
      var btn = document.querySelector('.btn-theme-toggle i');
      if (btn) {
        btn.className = this.isDark() ? 'fa-solid fa-sun' : 'fa-solid fa-circle-half-stroke';
      }
    }
  };

  // ====================================================================
  // UTILS MODULE
  // ====================================================================
  var utils = {
    showToast: function(msg, type, duration) {
      type = type || 'info';
      duration = duration || 4000;

      var stack = document.getElementById('toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        document.body.appendChild(stack);
      }

      var icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
      };

      var toast = document.createElement('div');
      toast.className = 'hub-toast hub-toast-' + type;
      toast.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + msg + '</span>';
      stack.appendChild(toast);

      setTimeout(function() {
        toast.classList.add('hub-toast-exit');
        setTimeout(function() { toast.remove(); }, 300);
      }, duration);
    },

    formatDate: function(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('pt-BR');
    },

    formatDateTime: function(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    debounce: function(fn, ms) {
      ms = ms || 300;
      var timer;
      return function() {
        var args = arguments;
        var ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
      };
    },

    copyToClipboard: function(text) {
      var self = this;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          self.showToast('Copiado!', 'success', 2000);
        }).catch(function() {
          self._fallbackCopy(text);
        });
      } else {
        self._fallbackCopy(text);
      }
    },

    _fallbackCopy: function(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.showToast('Copiado!', 'success', 2000);
    },

    escapeHtml: function(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    showLoader: function() {
      var loader = document.getElementById('loader');
      if (loader) loader.style.display = 'flex';
    },

    hideLoader: function() {
      var loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    },

    /**
     * Normaliza classe de icone FontAwesome.
     * - Garante prefixo de estilo correto (fa-solid / fa-brands / fa-regular).
     * - Icones de marcas conhecidos recebem 'fa-brands' automaticamente.
     * - Mapeia icones Pro inexistentes no Free para substitutos Free.
     * Ex: "fa-linkedin"      → "fa-brands fa-linkedin"
     *     "fa-calendar-star" → "fa-solid fa-calendar-days"  (Pro → Free fallback)
     *     "fa-globe"         → "fa-solid fa-globe"
     *     "fa-brands fa-github" → "fa-brands fa-github"  (mantém)
     */
    normalizeIcon: function(icon, fallback) {
      fallback = fallback || 'fa-solid fa-circle';
      if (!icon || !icon.trim()) return fallback;
      icon = icon.trim();

      // Mapa de icones Pro → substituto Free equivalente
      var proToFree = {
        'fa-calendar-star':    'fa-calendar-days',
        'fa-calendar-plus':    'fa-calendar-plus',  // free
        'fa-calendar-clock':   'fa-calendar',
        'fa-ballot':           'fa-list-check',
        'fa-books':            'fa-book',
        'fa-memo':             'fa-file-lines',
        'fa-sidebar':          'fa-table-columns',
        'fa-badge-check':      'fa-circle-check',
        'fa-star-sharp':       'fa-star',
        'fa-bell-ring':        'fa-bell',
        'fa-pen-circle':       'fa-pen',
        'fa-chart-pie-simple': 'fa-chart-pie',
        'fa-phone-rotary':     'fa-phone'
      };

      // Icones de marcas que precisam de 'fa-brands'
      var brandIcons = [
        'fa-linkedin','fa-linkedin-in','fa-github','fa-github-alt','fa-twitter',
        'fa-instagram','fa-facebook','fa-facebook-f','fa-youtube','fa-tiktok',
        'fa-whatsapp','fa-discord','fa-slack','fa-google','fa-microsoft',
        'fa-apple','fa-android','fa-windows','fa-figma','fa-trello',
        'fa-jira','fa-confluence','fa-notion','fa-aws','fa-docker',
        'fa-node','fa-node-js','fa-npm','fa-react','fa-vuejs','fa-angular',
        'fa-python','fa-java','fa-php','fa-js','fa-css3','fa-html5'
      ];

      var stylePrefixes = ['fa-solid','fa-brands','fa-regular','fa-light','fa-thin','fa-duotone','fas','far','fab'];

      // Ja tem prefixo — apenas checar Pro→Free
      var hasPrefix = false;
      for (var p = 0; p < stylePrefixes.length; p++) {
        if (icon.indexOf(stylePrefixes[p]) !== -1) { hasPrefix = true; break; }
      }

      if (hasPrefix) {
        // Substitui icone Pro dentro da string
        for (var proKey in proToFree) {
          if (icon.indexOf(proKey) !== -1) {
            icon = icon.replace(proKey, proToFree[proKey]);
          }
        }
        return icon;
      }

      // Sem prefixo — aplicar Pro→Free primeiro
      var iconName = icon;
      if (proToFree[iconName]) {
        iconName = proToFree[iconName];
      }

      // Checar se e icone de marca
      for (var b = 0; b < brandIcons.length; b++) {
        if (iconName === brandIcons[b]) return 'fa-brands ' + iconName;
      }

      // Default: fa-solid
      return 'fa-solid ' + iconName;
    }
  };

  // ====================================================================
  // ACCESS CODES (same as agendamento-complete-v4.js)
  // ====================================================================
  var ACCESS_CODES = {
    ADMIN: 'MKTadmin',
    EXTERNAL: 'MKTexterno'
  };

  // ====================================================================
  // LOGIN MODAL  (replicates exactly the v4.2 flow)
  //
  // Step "choice":  3 buttons  – Sisbr · Administrador · Externo
  //                 + Cancel
  // Step "admin-input":  username  → next
  // Step "external-input": username → next
  // Step "code":  access-code input  → login
  // Step "secret":  username → login (hidden, triple-click on icon)
  // ====================================================================
  var _modalState = {
    currentStep: 'choice',
    currentUsername: '',
    currentType: ''        // 'admin' | 'external'
  };

  function renderLoginModal() {
    if (document.getElementById('login-overlay')) return;

    var html = '' +
    '<div id="login-overlay">' +
      '<div id="login-modal">' +
        '<div class="modal-icon" id="login-icon">&#128274;</div>' +
        '<h3 id="modal-title">Fazer Login</h3>' +
        '<p class="subtitle" id="modal-subtitle">Escolha como deseja acessar o sistema</p>' +

        // ── choice step ──
        '<div id="choice-step">' +
          '<div class="login-choice-buttons">' +
            '<button class="login-choice-btn sisbr" id="btn-sisbr">' +
              '<span class="icon">&#127970;</span>' +
              '<span>Acesso via Sisbr</span>' +
            '</button>' +
            '<button class="login-choice-btn admin" id="btn-admin">' +
              '<span class="icon">&#128104;&#8205;&#128188;</span>' +
              '<span>Administrador</span>' +
            '</button>' +
            '<button class="login-choice-btn external" id="btn-external">' +
              '<span class="icon">&#128100;</span>' +
              '<span>Usuario Externo</span>' +
            '</button>' +
          '</div>' +
          '<button id="cancel-choice-btn" class="btn btn-secondary btn-action" style="width:100%;margin-top:1rem;">Cancelar</button>' +
        '</div>' +

        // ── admin-input step ──
        '<div id="admin-input-step" style="display:none;">' +
          '<input type="text" id="admin-username-input" placeholder="Digite seu usuario admin" autocomplete="username">' +
          '<div class="btn-group">' +
            '<button id="back-from-admin-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="next-admin-btn" class="btn btn-primary btn-action">Continuar</button>' +
          '</div>' +
        '</div>' +

        // ── external-input step ──
        '<div id="external-input-step" style="display:none;">' +
          '<input type="text" id="external-username-input" placeholder="Digite seu usuario" autocomplete="username">' +
          '<div class="btn-group">' +
            '<button id="back-from-external-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="next-external-btn" class="btn btn-primary btn-action">Continuar</button>' +
          '</div>' +
        '</div>' +

        // ── code step (admin or external) ──
        '<div id="code-step" style="display:none;">' +
          '<input type="password" id="code-input" placeholder="Digite o codigo de acesso" autocomplete="off">' +
          '<div class="btn-group">' +
            '<button id="back-from-code-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="login-final-btn" class="btn btn-primary btn-action">Entrar</button>' +
          '</div>' +
        '</div>' +

        // ── secret step (hidden, activated by triple-click on icon) ──
        '<div id="secret-input-step" style="display:none;">' +
          '<input type="text" id="secret-username-input" placeholder="Digite seu usuario" autocomplete="username">' +
          '<div class="btn-group">' +
            '<button id="back-from-secret-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="secret-login-btn" class="btn btn-primary btn-action">Entrar</button>' +
          '</div>' +
        '</div>' +

        '<div id="login-error" class="alert-box alert-error"></div>' +
        '<div id="login-success" class="alert-box alert-success"></div>' +
      '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    _bindModalEvents();
  }

  // ── helpers ──
  function _resetModal() {
    _modalState = { currentStep: 'choice', currentUsername: '', currentType: '' };
    var allSteps = ['choice-step','admin-input-step','external-input-step','code-step','secret-input-step'];
    allSteps.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var choice = document.getElementById('choice-step');
    if (choice) choice.style.display = 'block';
    ['admin-username-input','external-username-input','code-input','secret-username-input'].forEach(function(id) {
      var inp = document.getElementById(id);
      if (inp) inp.value = '';
    });
    _hideModalAlerts();
    var title = document.getElementById('modal-title');
    var sub   = document.getElementById('modal-subtitle');
    if (title) title.textContent = 'Fazer Login';
    if (sub)   sub.textContent   = 'Escolha como deseja acessar o sistema';
  }

  function _showModalError(msg) {
    var e = document.getElementById('login-error');
    var s = document.getElementById('login-success');
    if (e) { e.innerHTML = '<strong>⚠️ ' + msg + '</strong>'; e.style.display = 'block'; }
    if (s) s.style.display = 'none';
  }

  function _showModalSuccess(msg) {
    var e = document.getElementById('login-error');
    var s = document.getElementById('login-success');
    if (s) { s.innerHTML = '<strong>✅ ' + msg + '</strong>'; s.style.display = 'block'; }
    if (e) e.style.display = 'none';
  }

  function _hideModalAlerts() {
    var e = document.getElementById('login-error');
    var s = document.getElementById('login-success');
    if (e) e.style.display = 'none';
    if (s) s.style.display = 'none';
  }

  function _showStep(stepId) {
    var allSteps = ['choice-step','admin-input-step','external-input-step','code-step','secret-input-step'];
    allSteps.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var target = document.getElementById(stepId);
    if (target) {
      target.style.display = 'block';
      var input = target.querySelector('input');
      if (input) setTimeout(function() { input.focus(); }, 100);
    }
    _hideModalAlerts();
  }

  // ── step handlers (mirror v4.2) ──
  function _handleSisbrChoice() {
    window.location.href = 'https://www.sicoob.com.br/group/acessos/mesasmkt';
  }

  function _handleAdminChoice() {
    _showStep('admin-input-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Acesso Administrador';
    if (s) s.textContent = 'Digite seu nome de usuario administrativo';
  }

  function _handleExternalChoice() {
    _showStep('external-input-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Acesso Externo';
    if (s) s.textContent = 'Digite seu nome de usuario';
  }

  function _handleSecretChoice() {
    _showStep('secret-input-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = '🔒 Login';
    if (s) s.textContent = 'Digite seu usuario completo';
  }

  function _handleAdminUsernameSubmit() {
    var input = document.getElementById('admin-username-input');
    var username = (input ? input.value : '').trim().toLowerCase();
    if (!username) { _showModalError('Por favor, digite um nome de usuario.'); return; }

    // Validate against users table (lookup)
    auth.login(username).then(function(result) {
      if (!result.success) {
        _showModalError('Usuario nao encontrado.');
        return;
      }
      // Check if user is actually admin
      var u = auth.getUser();
      if (!u || !u.isAdmin) {
        _showModalError('Usuario nao encontrado na lista de administradores.');
        // Reset auth state since we don't want to keep non-admin login
        auth._user = null; auth._role = null; auth._source = null;
        localStorage.removeItem(CACHE_KEYS.USER);
        localStorage.removeItem(CACHE_KEYS.ROLE);
        localStorage.removeItem(CACHE_KEYS.SOURCE);
        return;
      }
      _modalState.currentUsername = username;
      _modalState.currentType = 'admin';
      _showCodeStep();
    });
  }

  function _handleExternalUsernameSubmit() {
    var input = document.getElementById('external-username-input');
    var username = (input ? input.value : '').trim().toLowerCase();
    if (!username) { _showModalError('Por favor, digite um nome de usuario.'); return; }

    // For external flow, just store the username and go to code step
    _modalState.currentUsername = username;
    _modalState.currentType = 'external';
    _showCodeStep();
  }

  function _showCodeStep() {
    _showStep('code-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Codigo de Acesso';
    if (s) s.textContent = 'Digite o codigo fornecido';
  }

  function _handleCodeSubmit() {
    var input = document.getElementById('code-input');
    var code = (input ? input.value : '').trim();
    if (!code) { _showModalError('Por favor, digite o codigo de acesso.'); return; }

    var expectedCode = _modalState.currentType === 'admin' ? ACCESS_CODES.ADMIN : ACCESS_CODES.EXTERNAL;

    if (code !== expectedCode) {
      _showModalError('Codigo incorreto. Tente novamente.');
      return;
    }

    // Code is correct – complete the login
    if (_modalState.currentType === 'admin') {
      // Admin was already validated via auth.login in the username step
      // Re-login to restore the cached state
      auth.login(_modalState.currentUsername).then(function(result) {
        if (result.success) {
          _showModalSuccess('Login realizado! Redirecionando...');
          setTimeout(function() { location.reload(); }, 1000);
        } else {
          _showModalError('Erro ao finalizar login.');
        }
      });
    } else {
      // External user – login via auth.login (looks up in users table)
      auth.login(_modalState.currentUsername).then(function(result) {
        if (result.success) {
          _showModalSuccess('Login realizado! Redirecionando...');
          setTimeout(function() { location.reload(); }, 1000);
        } else {
          // User not found in table – store minimal external session
          auth._user = {
            user_name: _modalState.currentUsername,
            nome: _modalState.currentUsername,
            apelido: _modalState.currentUsername,
            email: _modalState.currentUsername + '@sicoob.com.br',
            isExternal: true
          };
          auth._role = { isAdmin: false, isCoordenador: false };
          auth._source = 'code';
          auth._saveCache();
          _showModalSuccess('Login realizado! Redirecionando...');
          setTimeout(function() { location.reload(); }, 1000);
        }
      });
    }
  }

  function _handleSecretLogin() {
    var input = document.getElementById('secret-username-input');
    var username = (input ? input.value : '').trim().toLowerCase();
    if (!username) { _showModalError('Por favor, digite um nome de usuario.'); return; }

    // Extract user_name (remove @domain if present)
    if (username.includes('@')) username = username.split('@')[0];

    auth.login(username).then(function(result) {
      if (result.success) {
        _showModalSuccess('Login realizado! Redirecionando...');
        setTimeout(function() { location.reload(); }, 1000);
      } else {
        _showModalError(result.error || 'Usuario nao encontrado.');
      }
    });
  }

  // ── event bindings (mirrors v4.2 bindModalEvents) ──
  function _bindModalEvents() {
    // Choice buttons
    var btnSisbr = document.getElementById('btn-sisbr');
    var btnAdmin = document.getElementById('btn-admin');
    var btnExternal = document.getElementById('btn-external');
    var cancelBtn = document.getElementById('cancel-choice-btn');

    if (btnSisbr) btnSisbr.addEventListener('click', _handleSisbrChoice);
    if (btnAdmin) btnAdmin.addEventListener('click', _handleAdminChoice);
    if (btnExternal) btnExternal.addEventListener('click', _handleExternalChoice);
    if (cancelBtn) cancelBtn.addEventListener('click', function() { auth.hideLoginModal(); _resetModal(); });

    // Back buttons
    var backAdmin = document.getElementById('back-from-admin-btn');
    var backExternal = document.getElementById('back-from-external-btn');
    var backCode = document.getElementById('back-from-code-btn');
    var backSecret = document.getElementById('back-from-secret-btn');

    if (backAdmin) backAdmin.addEventListener('click', _resetModal);
    if (backExternal) backExternal.addEventListener('click', _resetModal);
    if (backCode) backCode.addEventListener('click', function() {
      if (_modalState.currentType === 'admin') _handleAdminChoice();
      else _handleExternalChoice();
    });
    if (backSecret) backSecret.addEventListener('click', _resetModal);

    // Submit buttons
    var nextAdmin = document.getElementById('next-admin-btn');
    var nextExternal = document.getElementById('next-external-btn');
    var loginFinal = document.getElementById('login-final-btn');
    var secretLogin = document.getElementById('secret-login-btn');

    if (nextAdmin) nextAdmin.addEventListener('click', _handleAdminUsernameSubmit);
    if (nextExternal) nextExternal.addEventListener('click', _handleExternalUsernameSubmit);
    if (loginFinal) loginFinal.addEventListener('click', _handleCodeSubmit);
    if (secretLogin) secretLogin.addEventListener('click', _handleSecretLogin);

    // Enter key on inputs
    var adminInput = document.getElementById('admin-username-input');
    var externalInput = document.getElementById('external-username-input');
    var codeInput = document.getElementById('code-input');
    var secretInput = document.getElementById('secret-username-input');

    if (adminInput) adminInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleAdminUsernameSubmit(); });
    if (externalInput) externalInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleExternalUsernameSubmit(); });
    if (codeInput) codeInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleCodeSubmit(); });
    if (secretInput) secretInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleSecretLogin(); });

    // Triple-click on lock icon → secret login
    var clickCount = 0;
    var clickTimer = null;
    var icon = document.getElementById('login-icon');
    if (icon) {
      icon.addEventListener('click', function() {
        clickCount++;
        clearTimeout(clickTimer);
        if (clickCount >= 3) {
          clickCount = 0;
          _handleSecretChoice();
        }
        clickTimer = setTimeout(function() { clickCount = 0; }, 500);
      });
    }

    // Close overlay on background click
    var overlay = document.getElementById('login-overlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target.id === 'login-overlay') {
          auth.hideLoginModal();
          _resetModal();
        }
      });
    }
  }

  // ── public loginFlow API (for mesas.js open-login-btn) ──
  var _loginFlow = {
    open: function() {
      _resetModal();
      auth.showLoginModal();
    },
    close: function() {
      auth.hideLoginModal();
      _resetModal();
    }
  };

  // ====================================================================
  // INIT
  // ====================================================================
  async function hubInit() {
    // Garantir Supabase disponível (em Liferay o CDN não é carregado via tag)
    if (!window.supabase) {
      await new Promise(function(resolve) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload = resolve;
        s.onerror = resolve; // prosseguir mesmo em erro de rede
        document.head.appendChild(s);
      });
    }

    // Garantir FontAwesome disponível (depende do tema Liferay)
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
      var faLink = document.createElement('link');
      faLink.rel = 'stylesheet';
      faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(faLink);
    }

    // Init Supabase
    getSb();

    // Check auth
    await auth.check();

    // Render login modal
    renderLoginModal();

    // Render nav
    nav.render();

    // Adiciona classe page-* ao body para seletores CSS funcionarem em Liferay
    // (em Liferay o <html> é substituído e [data-page] fica inacessível ao CSS)
    document.body.classList.add('page-' + _getCurrentPage());

    // Restore sidebar collapse state
    nav.restoreCollapse();

    // Init dark mode
    darkMode.init();

    // Hide loader
    utils.hideLoader();

    // Dispatch ready event
    document.dispatchEvent(new CustomEvent('hub:ready', { detail: { user: auth.getUser() } }));

    // Check profile complete - show gate or toast
    var user = auth.getUser();
    var currentPage = _getCurrentPage();
    // admin, formularios, perfil e usuarios não bloqueiam com gate global
    var gateExcludedPages = ['admin', 'formularios', 'perfil', 'usuarios'];
    if (user && !user.isExternal && !user.profileComplete) {
      if (gateExcludedPages.indexOf(currentPage) === -1) {
        _renderProfileGate();
      }
    }

    // If not authenticated and page requires auth
    var publicPages = ['mesas'];
    if (!auth.isAuthenticated() && publicPages.indexOf(currentPage) === -1) {
      auth.showLoginModal();
    }
  }

  // ====================================================================
  // PROFILE GATE — bloqueia conteudo ate cadastro completo
  // ====================================================================
  function _renderProfileGate() {
    // Injeta o banner de gate acima do #app-view
    var appView = document.getElementById('app-view');
    if (!appView) return;

    // Evita duplicar
    if (document.getElementById('profile-gate-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'profile-gate-banner';
    banner.className = 'hub-profile-gate-banner';
    banner.innerHTML =
      '<div class="hub-profile-gate-inner">' +
        '<i class="fa-solid fa-circle-exclamation"></i>' +
        '<div>' +
          '<strong>Cadastro incompleto!</strong>' +
          '<span> Preencha tudo para acessar todas as funcionalidades.</span>' +
        '</div>' +
        '<button class="btn btn-sm btn-warning" onclick="hub.nav.openEditarPerfil()">' +
          '<i class="fa-solid fa-user-pen"></i> Completar Cadastro' +
        '</button>' +
      '</div>';

    appView.parentNode.insertBefore(banner, appView);

    // Adiciona classe de gate ao app-view para efeito visual (overlay suave)
    appView.classList.add('hub-profile-gate-active');
  }

  // ====================================================================
  // EXPOSE ON WINDOW
  // ====================================================================
  window.hub = {
    auth: auth,
    nav: nav,
    darkMode: darkMode,
    utils: utils,
    _loginFlow: _loginFlow,
    config: Object.assign({}, HUB_CONFIG, { basePath: BASE_PATH })
  };

  // Define supabase and sb as getters for lazy init
  Object.defineProperty(window.hub, 'supabase', {
    get: function() { return getSb(); },
    configurable: true
  });

  Object.defineProperty(window.hub, 'sb', {
    get: function() { return getSb(); },
    configurable: true
  });

  // ====================================================================
  // DOM READY
  // ====================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubInit);
  } else {
    hubInit();
  }

})();

/* --- squads.js --- */
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
    // Guard: only run on squads page
    if (!document.getElementById('squads-grid')) return;

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
    var searchEl = document.getElementById('filter-search');
    var search = (searchEl ? searchEl.value : '').toLowerCase().trim();
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
            ? '<a href="' + hub.config.basePath + '/web/mkt/perfil/?u=' + hub.utils.escapeHtml(user.user_name) + '" class="squad-member-link">' + displayName + '</a>'
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
