/* ==============================================================
 * Hub Marketing — usuarios.js (build Liferay)
 * Gerado em: 2026-03-06 10:09:12
 * Contém: config + main.js + usuarios.js
 * ============================================================== */

// ─── Configuração desta página (ANTES de main.js) ───
window.HUB_PAGE = 'usuarios';
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

/* --- usuarios.js --- */
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
    // Guard: only run on usuarios page
    if (!document.getElementById('users-tbody')) return;

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
    if (!selGerencia) return;
    selGerencia.innerHTML = '<option value="">Todas</option>';
    gerencias.forEach(function(g) {
      selGerencia.innerHTML += '<option value="' + g.id + '">' + hub.utils.escapeHtml(g.nome) + '</option>';
    });
    resetFilterCoord();
    resetFilterNucleo();
    populateBairroFilter();
  }

  function updateFilterCoord() {
    var gerEl = document.getElementById('filter-gerencia');
    var gerenciaId = gerEl ? gerEl.value : '';
    var selCoord = document.getElementById('filter-coordenacao');
    if (!selCoord) return;
    if (!gerenciaId) { resetFilterCoord(); resetFilterNucleo(); return; }
    var coords = getOrgsByTypeAndParent('coordenacao', gerenciaId);
    selCoord.innerHTML = '<option value="">Todas</option>';
    coords.forEach(function(c) {
      selCoord.innerHTML += '<option value="' + c.id + '">' + hub.utils.escapeHtml(c.nome) + '</option>';
    });
    resetFilterNucleo();
  }

  function updateFilterNucleo() {
    var coordEl = document.getElementById('filter-coordenacao');
    var coordId = coordEl ? coordEl.value : '';
    var selNucleo = document.getElementById('filter-nucleo');
    if (!selNucleo) return;
    if (!coordId) { resetFilterNucleo(); return; }
    var nucleos = getOrgsByTypeAndParent('nucleo', coordId);
    selNucleo.innerHTML = '<option value="">Todos</option>';
    nucleos.forEach(function(n) {
      selNucleo.innerHTML += '<option value="' + n.id + '">' + hub.utils.escapeHtml(n.nome) + '</option>';
    });
  }

  function resetFilterCoord() {
    var sel = document.getElementById('filter-coordenacao');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas</option>';
    sel.value = '';
  }

  function resetFilterNucleo() {
    var sel = document.getElementById('filter-nucleo');
    if (!sel) return;
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
    var searchEl = document.getElementById('filter-search');
    var search = (searchEl ? searchEl.value : '').toLowerCase().trim();
    var gerEl = document.getElementById('filter-gerencia');
    var gerenciaId = gerEl ? gerEl.value : '';
    var coordEl = document.getElementById('filter-coordenacao');
    var coordId = coordEl ? coordEl.value : '';
    var nucleoEl = document.getElementById('filter-nucleo');
    var nucleoId = nucleoEl ? nucleoEl.value : '';
    var bairroEl = document.getElementById('filter-bairro');
    var bairroFilter = (bairroEl ? bairroEl.value : '').toLowerCase();

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

    // fullUser inclui colunas não presentes no cache de auth (sobre_mim, gostos_pessoais, etc.)
    var fullUser = allUsers.find(function(u) { return u.id === user.id; }) || {};

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

    // Preencher dropdowns org
    populateProfileDropdowns();

    // Preencher endereço
    var endEl = document.getElementById('profile-endereco');
    if (endEl) endEl.value = fullUser.endereco || '';

    var bairroEl = document.getElementById('profile-bairro');
    if (bairroEl) bairroEl.value = fullUser.bairro || '';

    var cepEl = document.getElementById('profile-cep');
    if (cepEl) cepEl.value = fullUser.cep || '';

    // Preencher sobre mim
    var sobreEl = document.getElementById('profile-sobre-mim');
    if (sobreEl) sobreEl.value = fullUser.sobre_mim || '';

    // Preencher gostos pessoais
    var gp = fullUser.gostos_pessoais || {};
    var livrosEl = document.getElementById('profile-livros');
    if (livrosEl) livrosEl.value = (gp.livros || []).join(', ');
    var filmesEl = document.getElementById('profile-filmes');
    if (filmesEl) filmesEl.value = (gp.filmes || []).join(', ');
    var comidasEl = document.getElementById('profile-comidas');
    if (comidasEl) comidasEl.value = (gp.comidas || []).join(', ');
    var hobbiesEl = document.getElementById('profile-hobbies');
    if (hobbiesEl) hobbiesEl.value = (gp.hobbies || []).join(', ');
    var timeEl = document.getElementById('profile-time-coracao');
    if (timeEl) timeEl.value = gp.time_coracao || '';

    var overlay = document.getElementById('profile-modal-overlay');
    if (overlay) overlay.classList.add('show');
  }

  function populateProfileDropdowns() {
    var user = hub.auth.getUser();
    var gerencias = getOrgsByType('gerencia');

    var selGer = document.getElementById('profile-gerencia');
    if (!selGer) return;
    selGer.innerHTML = '<option value="">Selecione...</option>';
    gerencias.forEach(function(g) {
      var sel = (user && String(user.gerencia_id) === String(g.id)) ? ' selected' : '';
      selGer.innerHTML += '<option value="' + g.id + '"' + sel + '>' + hub.utils.escapeHtml(g.nome) + '</option>';
    });

    updateProfileCoord();
  }

  function updateProfileCoord() {
    var gerEl = document.getElementById('profile-gerencia');
    var gerenciaId = gerEl ? gerEl.value : '';
    var selCoord = document.getElementById('profile-coordenacao');
    if (!selCoord) return;
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
    var coordEl = document.getElementById('profile-coordenacao');
    var coordId = coordEl ? coordEl.value : '';
    var selNucleo = document.getElementById('profile-nucleo');
    if (!selNucleo) return;
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

    // Campos obrigatórios
    var apelido    = (document.getElementById('profile-apelido').value || '').trim();
    var telefone   = (document.getElementById('profile-telefone').value || '').trim();
    var aniversario = document.getElementById('profile-aniversario').value || null;
    var gerenciaId  = document.getElementById('profile-gerencia').value || null;
    var coordId     = document.getElementById('profile-coordenacao').value || null;
    var nucleoId    = document.getElementById('profile-nucleo').value || null;

    // Validação dos campos obrigatórios
    var missing = [];
    if (!apelido)     missing.push('Apelido');
    if (!telefone)    missing.push('Telefone');
    if (!aniversario) missing.push('Aniversário');
    if (!gerenciaId)  missing.push('Gerência');
    if (!coordId)     missing.push('Coordenação');
    if (missing.length > 0) {
      hub.utils.showToast('Preencha: ' + missing.join(', '), 'warning');
      return;
    }

    // Campos opcionais — endereço
    var endereco = (document.getElementById('profile-endereco').value || '').trim();
    var bairro   = (document.getElementById('profile-bairro').value || '').trim();
    var cep      = (document.getElementById('profile-cep').value || '').trim();

    // Sobre mim
    var sobreMim = (document.getElementById('profile-sobre-mim').value || '').trim();

    // Gostos pessoais (arrays separados por vírgula)
    var parseList = function(id) {
      var v = (document.getElementById(id) ? document.getElementById(id).value : '').trim();
      return v ? v.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
    };
    var gostosPessoais = {
      livros:       parseList('profile-livros'),
      filmes:       parseList('profile-filmes'),
      comidas:      parseList('profile-comidas'),
      hobbies:      parseList('profile-hobbies'),
      time_coracao: (document.getElementById('profile-time-coracao') ? document.getElementById('profile-time-coracao').value.trim() : '')
    };

    // profile_complete: obrigatórios preenchidos; núcleo obrigatório exceto para gestores
    var isGestor = user.isCoordenador;
    var profileComplete = !!(apelido && telefone && aniversario && gerenciaId && coordId && (isGestor || nucleoId));

    var updates = {
      apelido:          apelido,
      telefone:         telefone,
      aniversario:      aniversario,
      gerencia_id:      gerenciaId,
      coordenacao_id:   coordId,
      nucleo_id:        nucleoId,
      endereco:         endereco || null,
      bairro:           bairro || null,
      cep:              cep || null,
      sobre_mim:        sobreMim || null,
      gostos_pessoais:  gostosPessoais,
      profile_complete: profileComplete
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

    // Fechar ao clicar fora + Escape
    var profileOverlay = document.getElementById('profile-modal-overlay');
    if (profileOverlay) {
      profileOverlay.addEventListener('click', function(e) {
        if (e.target === profileOverlay) profileOverlay.classList.remove('show');
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var ov = document.getElementById('profile-modal-overlay');
        if (ov && ov.classList.contains('show')) ov.classList.remove('show');
      }
    });

    // Botao "Editar Perfil" no sidebar (injetado pelo main.js se existir)
    // Delegado via hub para uso global
    window._openProfileModal = openProfileModal;
  }

})();
