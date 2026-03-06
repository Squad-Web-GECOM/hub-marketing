/* ==============================================================
 * Hub Marketing — perfil.js (build Liferay)
 * Gerado em: 2026-03-06 10:09:12
 * Contém: config + main.js + perfil.js
 * ============================================================== */

// ─── Configuração desta página (ANTES de main.js) ───
window.HUB_PAGE = 'perfil';
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

/* --- perfil.js --- */
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
    // Guard: only run on perfil page
    if (!document.getElementById('perfil-header-actions')) return;

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

        // Se vier com ?edit=1 na URL (ex: ao clicar "Completar Cadastro"), abre o modal automaticamente
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('edit') === '1') {
          openEditModal();
          // Limpa o param da URL sem recarregar
          try {
            var cleanUrl = window.location.pathname + (urlParams.get('u') ? '?u=' + urlParams.get('u') : '');
            window.history.replaceState({}, '', cleanUrl);
          } catch(e) {}
        }
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

    // Nome
    var nomeEl = document.getElementById('perfil-nome');
    if (nomeEl) nomeEl.textContent = u.nome || '';

    // Usuário (sem @) + e-mail formatado + botões copiar
    var usernameEl = document.getElementById('perfil-username');
    if (usernameEl) usernameEl.textContent = u.user_name || '';

    var emailDisplayEl = document.getElementById('perfil-email-display');
    if (emailDisplayEl) {
      // Determina domínio pelo e-mail real, fallback @sicoob.com.br
      var emailDomain = '@sicoob.com.br';
      if (u.email && u.email.indexOf('@fornecedores.sicoob') !== -1) {
        emailDomain = '@fornecedores.sicoob.com.br';
      }
      var fullEmail = u.user_name ? (u.user_name + emailDomain) : (u.email || '');
      emailDisplayEl.textContent = fullEmail;
    }

    var btnCopyUser = document.getElementById('btn-copy-username');
    if (btnCopyUser && u.user_name) {
      btnCopyUser.addEventListener('click', function() {
        hub.utils.copyToClipboard(u.user_name);
      });
    } else if (btnCopyUser) {
      btnCopyUser.style.display = 'none';
    }

    var btnCopyEmail = document.getElementById('btn-copy-email');
    if (btnCopyEmail) {
      var emailDomainForCopy = '@sicoob.com.br';
      if (u.email && u.email.indexOf('@fornecedores.sicoob') !== -1) {
        emailDomainForCopy = '@fornecedores.sicoob.com.br';
      }
      var fullEmailForCopy = u.user_name ? (u.user_name + emailDomainForCopy) : (u.email || '');
      if (fullEmailForCopy) {
        btnCopyEmail.addEventListener('click', function() {
          hub.utils.copyToClipboard(fullEmailForCopy);
        });
      } else {
        btnCopyEmail.style.display = 'none';
      }
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

    // Contato + endereço
    var contatoEl = document.getElementById('perfil-contato-info');
    if (contatoEl) {
      var html = '';
      // Senioridade — visível apenas para o próprio usuário ou admin/coord
      if (u.senioridade && (isOwnProfile || hub.auth.isAdminOrCoord())) {
        html += infoRow('fa-solid fa-star', 'Senioridade', u.senioridade);
      }
      html += infoRow('fa-solid fa-phone', 'Telefone', u.telefone);
      // Endereço: linha 1 = Logradouro — CEP; linha 2 = Bairro (em um único infoRow)
      var linhaEndereco = '';
      if (u.endereco && u.cep) {
        linhaEndereco = hub.utils.escapeHtml(u.endereco) + ' <span class="text-muted">— CEP ' + hub.utils.escapeHtml(u.cep) + '</span>';
      } else if (u.endereco) {
        linhaEndereco = hub.utils.escapeHtml(u.endereco);
      } else if (u.cep) {
        linhaEndereco = 'CEP ' + hub.utils.escapeHtml(u.cep);
      }
      if (u.bairro) {
        linhaEndereco += (linhaEndereco ? '<br>' : '') + hub.utils.escapeHtml(u.bairro);
      }
      if (linhaEndereco) {
        html += '<div class="perfil-info-row">' +
          '<i class="fa-solid fa-map-pin perfil-info-icon"></i>' +
          '<div><span class="perfil-info-label">Endereço</span>' +
          '<span class="perfil-info-value">' + linhaEndereco + '</span></div>' +
        '</div>';
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

    // Fechar ao clicar fora + Escape
    var perfilOverlay = document.getElementById('perfil-edit-overlay');
    if (perfilOverlay) {
      perfilOverlay.addEventListener('click', function(e) {
        if (e.target === perfilOverlay) closeEditModal();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var ov = document.getElementById('perfil-edit-overlay');
        if (ov && ov.classList.contains('show')) closeEditModal();
      }
    });

    // Avatar picker dentro do modal
    var btnAvatarPick = document.getElementById('btn-edit-avatar-pick');
    var avatarInput   = document.getElementById('edit-avatar-input');
    if (btnAvatarPick) btnAvatarPick.addEventListener('click', function() { avatarInput.click(); });
    if (avatarInput)   avatarInput.addEventListener('change', onAvatarFileChange);

    // Contador de caracteres — Sobre mim
    var sobreMimInput = document.getElementById('edit-sobre-mim');
    var sobreMimCount = document.getElementById('sobre-mim-count');
    if (sobreMimInput && sobreMimCount) {
      sobreMimInput.addEventListener('input', function() {
        var len = sobreMimInput.value.length;
        sobreMimCount.textContent = len + ' / 500';
        sobreMimCount.style.color = len >= 480 ? '#e74c3c' : '';
      });
    }

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
    var sobreMimVal = u.sobre_mim || '';
    document.getElementById('edit-sobre-mim').value   = sobreMimVal;
    var sobreCount = document.getElementById('sobre-mim-count');
    if (sobreCount) sobreCount.textContent = sobreMimVal.length + ' / 500';

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

    // Senioridade e terceirizado
    var selSen = document.getElementById('edit-senioridade');
    if (selSen) selSen.value = u.senioridade || '';
    var chkTerc = document.getElementById('edit-terceirizado');
    if (chkTerc) chkTerc.checked = !!u.terceirizado;

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
      var apelido    = (document.getElementById('edit-apelido').value || '').trim() || null;
      var telefone   = (document.getElementById('edit-telefone').value || '').trim() || null;
      var aniversario = document.getElementById('edit-aniversario').value || null;
      var gerenciaId = document.getElementById('edit-gerencia').value || null;
      var coordId    = document.getElementById('edit-coordenacao').value || null;
      var nucleoId   = document.getElementById('edit-nucleo').value || null;
      var senioridade = (document.getElementById('edit-senioridade').value || '').trim() || null;
      var terceirizado = document.getElementById('edit-terceirizado').checked;
      var endereco   = (document.getElementById('edit-endereco').value || '').trim() || null;
      var bairro     = (document.getElementById('edit-bairro').value || '').trim() || null;
      var cep        = (document.getElementById('edit-cep').value || '').trim() || null;

      // Regras de obrigatoriedade por senioridade
      // - Gerente: sem gerencia, coordenacao e nucleo obrigatórios
      // - Coordenador (flag is_gestor OU senioridade): sem nucleo obrigatório
      // - Demais: gerencia + coordenacao + nucleo obrigatórios
      var isGerente    = senioridade === 'Gerente';
      var isCoordenador = (loggedUser && loggedUser.isCoordenador) || senioridade === 'Coordenador';

      var missing = [];
      if (!apelido)                                       missing.push('Apelido');
      if (!telefone)                                      missing.push('Telefone');
      if (!aniversario)                                   missing.push('Aniversário');
      if (!senioridade)                                   missing.push('Senioridade');
      if (!isGerente && !gerenciaId)                      missing.push('Gerência');
      if (!isGerente && !isCoordenador && !coordId)       missing.push('Coordenação');
      if (!isGerente && !isCoordenador && !nucleoId)      missing.push('Núcleo');
      if (missing.length > 0) {
        hub.utils.showToast('Preencha: ' + missing.join(', '), 'warning');
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

      // profile_complete = TRUE se todos os campos obrigatórios conforme papel
      // Gerente:     nome + apelido + telefone + aniversario + senioridade
      // Coordenador: + gerencia_id + coordenacao_id
      // Demais:      + gerencia_id + coordenacao_id + nucleo_id
      // Não obrigatórios: endereco, bairro, cep, avatar_url, sobre_mim, gostos_pessoais
      var profileComplete = !!(
        targetUser.nome &&
        apelido &&
        telefone &&
        aniversario &&
        senioridade &&
        (isGerente || gerenciaId) &&
        (isGerente || isCoordenador || coordId) &&
        (isGerente || isCoordenador || nucleoId)
      );

      var updates = {
        gerencia_id:     gerenciaId,
        coordenacao_id:  (isGerente || isCoordenador) ? (coordId || null) : coordId,
        nucleo_id:       nucleoId,
        apelido:         apelido,
        telefone:        telefone,
        aniversario:     aniversario,
        endereco:        endereco,
        bairro:          bairro,
        cep:             cep,
        senioridade:     senioridade,
        terceirizado:    terceirizado,
        sobre_mim:       (document.getElementById('edit-sobre-mim').value || '').trim() || null,
        gostos_pessoais: gostos,
        profile_complete: profileComplete
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

      // Re-carrega dados do usuário do banco e atualiza o cache (mantendo _source para não deslogar)
      try {
        await hub.auth._lookupUser(targetUser.user_name);
        hub.auth._saveCache();
      } catch(e) {
        // Se falhar o lookup, não apaga o cache — só recarrega
      }

      setTimeout(function() { window.location.reload(); }, 600);

    } catch (err) {
      console.error('savePerfilEdit error:', err);
      hub.utils.showToast('Erro inesperado ao salvar', 'error');
    } finally {
      if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i>Salvar'; }
    }
  }

})();
