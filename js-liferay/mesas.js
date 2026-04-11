/* ==============================================================
 * Hub Marketing — mesas.js (build Liferay)
 * Gerado em: 2026-04-10 17:37:49
 * Contém: config + main.js + mesas.js
 * ============================================================== */

// ─── Configuração desta página (ANTES de main.js) ───
window.HUB_PAGE = 'mesas';
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
  var _p1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  var _p2 = '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjcWl0b2NvcGpkaWx4Z3Vwcmls';
  var _p3 = 'Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzODM5MTEsImV4cCI6MjA3MTk1OTkxMX0';
  var _p4 = '.GTqh--djGKQfCgCnlpRNNx75KMEXNImSPcs8OQ7K5gc';

  var HUB_CONFIG = {
    URL: 'https://gcqitocopjdilxgupril.supabase.co',
    KEY: _p1 + _p2 + _p3 + _p4
  };

  // Cache keys (new keys to break old cache)
  var CACHE_KEYS = {
    USER: 'hub_cached_user',
    ROLE: 'hub_cached_role',
    SOURCE: 'hub_cached_source'
  };

  // Versão do schema do cache — incrementar força refresh em todos os navegadores
  var CACHE_VERSION = '2';
  var CACHE_VERSION_KEY = 'hub_cache_version';

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
  var sbClient = null;
  function getSb() {
    if (!sbClient) {
      sbClient = window.supabase.createClient(HUB_CONFIG.URL, HUB_CONFIG.KEY);
    }
    return sbClient;
  }

  // ====================================================================
  // AUTH MODULE
  // ====================================================================
  var auth = {
    _user: null,
    _role: null,
    _source: null, // 'liferay', 'secret', 'view'

    async check() {
      // 1. Try localStorage cache
      var cachedUser = localStorage.getItem(CACHE_KEYS.USER);
      var cachedRole = localStorage.getItem(CACHE_KEYS.ROLE);
      var cachedSource = localStorage.getItem(CACHE_KEYS.SOURCE);

      if (cachedUser && cachedRole) {
        try {
          this._user = JSON.parse(cachedUser);
          this._role = JSON.parse(cachedRole);
        } catch(e) {
          // Cache corrompido — limpa e segue para auth normal
          localStorage.removeItem(CACHE_KEYS.USER);
          localStorage.removeItem(CACHE_KEYS.ROLE);
          localStorage.removeItem(CACHE_KEYS.SOURCE);
          this._user = null;
          this._role = null;
          cachedUser = null;
        }
      }

      if (cachedUser && this._user) {
        this._source = cachedSource || 'cache';

        // Verifica se o usuario do Liferay mudou (ex: outro colaborador no mesmo browser)
        var liferayUser = null;
        if (window.localPart) {
          liferayUser = String(window.localPart).toLowerCase().trim();
        } else if (typeof Liferay !== 'undefined' && Liferay.ThemeDisplay) {
          try {
            var tdEmail = Liferay.ThemeDisplay.getUserEmailAddress().toLowerCase();
            if (tdEmail && tdEmail.indexOf('default') === -1) {
              liferayUser = tdEmail.split('@')[0];
            }
          } catch(e) { /* silencioso */ }
        }

        if (liferayUser && liferayUser !== 'guest' && this._user.user_name !== liferayUser) {
          // Usuario do Liferay diferente do cache — invalida cache
          localStorage.removeItem(CACHE_KEYS.USER);
          localStorage.removeItem(CACHE_KEYS.ROLE);
          localStorage.removeItem(CACHE_KEYS.SOURCE);
          this._user = null;
          this._role = null;
          this._source = null;
          // Segue para o passo 2 (Liferay SSO) abaixo
        } else {
          // Se cache veio do Supabase Auth, verificar se sessao ainda existe
          if (this._source === 'supabase') {
            try {
              var sessCheck = await getSb().auth.getSession();
              if (!sessCheck.data || !sessCheck.data.session) {
                // Sessao Supabase expirou — invalidar cache
                localStorage.removeItem(CACHE_KEYS.USER);
                localStorage.removeItem(CACHE_KEYS.ROLE);
                localStorage.removeItem(CACHE_KEYS.SOURCE);
                this._user = null;
                this._role = null;
                this._source = null;
                // Segue para os passos abaixo
              } else {
                // Sessao valida — atualiza dados do banco
                if (this._user.user_name && !this._user.isExternal) {
                  try { await this._lookupUser(this._user.user_name); this._saveCache(); } catch(e) {}
                }
                return true;
              }
            } catch(e) {
              return true; // em caso de erro, confia no cache
            }
          } else {
            // Cache nao-supabase — atualiza silenciosamente se necessario
            if (this._user.user_name && !this._user.isExternal) {
              try {
                await this._lookupUser(this._user.user_name);
                this._saveCache();
              } catch(e) {
                // silencioso — mantém cache atual
              }
            }
            return true;
          }
        }
      }

      // 2. Supabase Auth session (sem cache, mas sessao pode existir)
      try {
        var sessionResp = await getSb().auth.getSession();
        if (sessionResp.data && sessionResp.data.session) {
          var sessionEmail = sessionResp.data.session.user.email;
          var sessionUser = sessionEmail.split('@')[0].toLowerCase();
          var foundSession = await this._lookupUser(sessionUser);
          if (foundSession) {
            this._source = 'supabase';
            this._saveCache();
            return true;
          }
        }
      } catch(e) { /* silencioso */ }

      // 3. window.localPart (injetado pelo template FreeMarker do Liferay)
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
          if (email && email !== '' && email.indexOf('default') === -1) {
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
      if (userName.indexOf('@') !== -1) {
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

    async loginWithEmail(email, password) {
      var result = await getSb().auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        return { success: false, error: result.error.message || 'Email ou senha incorretos.' };
      }
      var userName = email.split('@')[0].toLowerCase();
      var found = await this._lookupUser(userName);
      if (!found) {
        await getSb().auth.signOut();
        return { success: false, error: 'Conta desativada. Contacte o administrador.' };
      }
      this._source = 'supabase';
      this._saveCache();
      return { success: true, user: this._user };
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

    logout: async function() {
      // Sign out from Supabase Auth (clears session tokens)
      try { await getSb().auth.signOut(); } catch(e) { /* silencioso */ }

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
      var icon = document.createElement('i');
      icon.className = 'fa-solid ' + (icons[type] || icons.info);
      var span = document.createElement('span');
      span.textContent = msg;
      toast.appendChild(icon);
      toast.appendChild(span);
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

    throttle: function(key, ms) {
      var storageKey = 'hub_throttle_' + key;
      var last = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
      var now = Date.now();
      if (now - last < ms) return false;
      sessionStorage.setItem(storageKey, String(now));
      return true;
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
  // LOGIN MODAL
  //
  // Step "choice":  2 buttons — Sisbr · Entrar com Email
  //                 + link "Nao tem conta? Criar conta"
  // Step "login-email": email + password → Entrar
  // Step "signup-email": email + password + confirmar → Criar conta
  // Step "secret":  username → login (hidden, triple-click on icon)
  // ====================================================================
  var _modalState = {
    currentStep: 'choice'
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
            '<button class="login-choice-btn email" id="btn-email-login">' +
              '<span class="icon"><i class="fa-solid fa-envelope"></i></span>' +
              '<span>Entrar com Email</span>' +
            '</button>' +
          '</div>' +
          '<p class="login-link-row"><a href="#" id="btn-signup-link">Nao tem conta? <strong>Criar conta</strong></a></p>' +
          '<button id="cancel-choice-btn" class="btn btn-secondary btn-action" style="width:100%;margin-top:0.75rem;">Cancelar</button>' +
        '</div>' +

        // ── login-email step ──
        '<div id="login-email-step" style="display:none;">' +
          '<input type="email" id="login-email-input" placeholder="Seu email corporativo" autocomplete="email">' +
          '<input type="password" id="login-password-input" placeholder="Senha" autocomplete="current-password">' +
          '<div class="btn-group">' +
            '<button id="back-from-login-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="submit-login-btn" class="btn btn-primary btn-action">Entrar</button>' +
          '</div>' +
          '<p class="login-link-row"><a href="#" id="btn-forgot-password">Esqueceu a senha?</a></p>' +
        '</div>' +

        // ── signup-email step ──
        '<div id="signup-email-step" style="display:none;">' +
          '<input type="email" id="signup-email-input" placeholder="Seu email corporativo" autocomplete="email">' +
          '<input type="password" id="signup-password-input" placeholder="Criar senha (min. 6 caracteres)" autocomplete="new-password">' +
          '<input type="password" id="signup-password-confirm" placeholder="Confirmar senha" autocomplete="new-password">' +
          '<div class="btn-group">' +
            '<button id="back-from-signup-btn" class="btn btn-secondary btn-action">Voltar</button>' +
            '<button id="submit-signup-btn" class="btn btn-primary btn-action">Criar conta</button>' +
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
    _modalState = { currentStep: 'choice' };
    var allSteps = ['choice-step','login-email-step','signup-email-step','secret-input-step'];
    allSteps.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var choice = document.getElementById('choice-step');
    if (choice) choice.style.display = 'block';
    ['login-email-input','login-password-input','signup-email-input','signup-password-input','signup-password-confirm','secret-username-input'].forEach(function(id) {
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
    if (e) { e.textContent = msg; e.style.display = 'block'; }
    if (s) s.style.display = 'none';
  }

  function _showModalSuccess(msg) {
    var e = document.getElementById('login-error');
    var s = document.getElementById('login-success');
    if (s) { s.textContent = msg; s.style.display = 'block'; }
    if (e) e.style.display = 'none';
  }

  function _hideModalAlerts() {
    var e = document.getElementById('login-error');
    var s = document.getElementById('login-success');
    if (e) e.style.display = 'none';
    if (s) s.style.display = 'none';
  }

  function _showStep(stepId) {
    var allSteps = ['choice-step','login-email-step','signup-email-step','secret-input-step'];
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

  // ── step handlers ──
  function _handleSisbrChoice() {
    window.location.href = 'https://www.sicoob.com.br/group/acessos/mesasmkt';
  }

  // ── Supabase Auth signup helper ──
  async function _signupWithEmail(email, password) {
    var check = await getSb().from('users').select('id').eq('email', email).single();
    if (check.error || !check.data) {
      return { success: false, error: 'Email nao encontrado. Contacte o administrador.' };
    }
    var result = await getSb().auth.signUp({ email: email, password: password });
    if (result.error) {
      if (result.error.message && result.error.message.indexOf('already registered') !== -1) {
        return { success: false, error: 'Este email ja possui conta. Faca login.' };
      }
      return { success: false, error: result.error.message || 'Erro ao criar conta.' };
    }
    return { success: true };
  }

  function _handleEmailLoginChoice() {
    _showStep('login-email-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Entrar com Email';
    if (s) s.textContent = 'Use seu email corporativo e senha';
  }

  function _handleSignupChoice() {
    _showStep('signup-email-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Criar Conta';
    if (s) s.textContent = 'Use o email cadastrado na sua conta do Hub';
  }

  async function _handleEmailLoginSubmit() {
    if (!hub.utils.throttle('login', 2000)) { _showModalError('Aguarde antes de tentar novamente.'); return; }
    var emailInput = document.getElementById('login-email-input');
    var passInput  = document.getElementById('login-password-input');
    var email    = (emailInput ? emailInput.value : '').trim().toLowerCase();
    var password = passInput ? passInput.value : '';

    if (!email || !password) { _showModalError('Preencha email e senha.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showModalError('Email invalido.'); return; }

    _showModalSuccess('Autenticando...');
    var result = await auth.loginWithEmail(email, password);
    if (result.success) {
      _showModalSuccess('Login realizado! Redirecionando...');
      setTimeout(function() { location.reload(); }, 1000);
    } else {
      _showModalError(result.error || 'Email ou senha incorretos.');
    }
  }

  async function _handleSignupSubmit() {
    if (!hub.utils.throttle('signup', 2000)) { _showModalError('Aguarde antes de tentar novamente.'); return; }
    var emailInput   = document.getElementById('signup-email-input');
    var passInput    = document.getElementById('signup-password-input');
    var confirmInput = document.getElementById('signup-password-confirm');
    var email    = (emailInput ? emailInput.value : '').trim().toLowerCase();
    var password = passInput ? passInput.value : '';
    var confirm  = confirmInput ? confirmInput.value : '';

    if (!email || !password || !confirm) { _showModalError('Preencha todos os campos.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showModalError('Email invalido.'); return; }
    if (password.length < 6) { _showModalError('A senha deve ter no minimo 6 caracteres.'); return; }
    if (password !== confirm) { _showModalError('As senhas nao conferem.'); return; }

    _showModalSuccess('Criando conta...');
    var result = await _signupWithEmail(email, password);
    if (result.success) {
      _showModalSuccess('Conta criada com sucesso! Faca login.');
      setTimeout(function() {
        _handleEmailLoginChoice();
        var loginEmailInput = document.getElementById('login-email-input');
        if (loginEmailInput) loginEmailInput.value = email;
      }, 1500);
    } else {
      _showModalError(result.error || 'Erro ao criar conta.');
    }
  }

  async function _handleForgotPassword() {
    var emailInput = document.getElementById('login-email-input');
    var email = (emailInput ? emailInput.value : '').trim().toLowerCase();
    if (!email) { _showModalError('Digite seu email para recuperar a senha.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showModalError('Email invalido.'); return; }

    _showModalSuccess('Enviando email de recuperacao...');
    try {
      var result = await getSb().auth.resetPasswordForEmail(email);
      if (result.error) {
        _showModalError(result.error.message || 'Erro ao enviar email.');
      } else {
        _showModalSuccess('Email de recuperacao enviado! Verifique sua caixa de entrada.');
      }
    } catch(e) {
      _showModalError('Erro ao enviar email de recuperacao.');
    }
  }

  function _handleSecretChoice() {
    _showStep('secret-input-step');
    var t = document.getElementById('modal-title');
    var s = document.getElementById('modal-subtitle');
    if (t) t.textContent = 'Login';
    if (s) s.textContent = 'Digite seu usuario completo';
  }

  function _handleSecretLogin() {
    if (!hub.utils.throttle('login', 2000)) {
      _showModalError('Aguarde antes de tentar novamente.');
      return;
    }
    var input = document.getElementById('secret-username-input');
    var username = (input ? input.value : '').trim().toLowerCase();
    if (!username) { _showModalError('Por favor, digite um nome de usuario.'); return; }

    if (username.indexOf('@') !== -1) username = username.split('@')[0];

    auth.login(username).then(function(result) {
      if (result.success) {
        _showModalSuccess('Login realizado! Redirecionando...');
        setTimeout(function() { location.reload(); }, 1000);
      } else {
        _showModalError(result.error || 'Usuario nao encontrado.');
      }
    });
  }

  // ── event bindings ──
  function _bindModalEvents() {
    // Choice buttons
    var btnSisbr = document.getElementById('btn-sisbr');
    var btnEmailLogin = document.getElementById('btn-email-login');
    var btnSignupLink = document.getElementById('btn-signup-link');
    var cancelBtn = document.getElementById('cancel-choice-btn');

    if (btnSisbr) btnSisbr.addEventListener('click', _handleSisbrChoice);
    if (btnEmailLogin) btnEmailLogin.addEventListener('click', _handleEmailLoginChoice);
    if (btnSignupLink) btnSignupLink.addEventListener('click', function(e) { e.preventDefault(); _handleSignupChoice(); });
    if (cancelBtn) cancelBtn.addEventListener('click', function() { auth.hideLoginModal(); _resetModal(); });

    // Back buttons
    var backLogin = document.getElementById('back-from-login-btn');
    var backSignup = document.getElementById('back-from-signup-btn');
    var backSecret = document.getElementById('back-from-secret-btn');

    if (backLogin) backLogin.addEventListener('click', _resetModal);
    if (backSignup) backSignup.addEventListener('click', _resetModal);
    if (backSecret) backSecret.addEventListener('click', _resetModal);

    // Submit buttons
    var submitLogin = document.getElementById('submit-login-btn');
    var submitSignup = document.getElementById('submit-signup-btn');
    var secretLogin = document.getElementById('secret-login-btn');
    var forgotPassword = document.getElementById('btn-forgot-password');

    if (submitLogin) submitLogin.addEventListener('click', _handleEmailLoginSubmit);
    if (submitSignup) submitSignup.addEventListener('click', _handleSignupSubmit);
    if (secretLogin) secretLogin.addEventListener('click', _handleSecretLogin);
    if (forgotPassword) forgotPassword.addEventListener('click', function(e) { e.preventDefault(); _handleForgotPassword(); });

    // Enter key on inputs
    var loginEmailInput = document.getElementById('login-email-input');
    var loginPassInput = document.getElementById('login-password-input');
    var signupEmailInput = document.getElementById('signup-email-input');
    var signupPassInput = document.getElementById('signup-password-input');
    var signupConfirmInput = document.getElementById('signup-password-confirm');
    var secretInput = document.getElementById('secret-username-input');

    if (loginEmailInput) loginEmailInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleEmailLoginSubmit(); });
    if (loginPassInput) loginPassInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleEmailLoginSubmit(); });
    if (signupEmailInput) signupEmailInput.addEventListener('keypress', function(e) { if (e.which === 13) { var next = document.getElementById('signup-password-input'); if (next) next.focus(); } });
    if (signupPassInput) signupPassInput.addEventListener('keypress', function(e) { if (e.which === 13) { var next = document.getElementById('signup-password-confirm'); if (next) next.focus(); } });
    if (signupConfirmInput) signupConfirmInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleSignupSubmit(); });
    if (secretInput) secretInput.addEventListener('keypress', function(e) { if (e.which === 13) _handleSecretLogin(); });

    // Triple-click on lock icon → secret login (apenas em dev/localhost)
    var _isDevEnv = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.indexOf('github.io') !== -1);
    if (_isDevEnv) {
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

/* --- mesas.js --- */
/**
 * HUB MARKETING - Pagina de Mesas (Desk Booking)
 * Migrado de agendamento-complete-v4.2
 *
 * Depends on: main.js (hub.sb, hub.auth, hub.utils)
 */
(function($) {
  'use strict';

  // ====================================================================
  // STATE
  // ====================================================================
  var state = {
    selectedDate: '',
    desks: [],
    reservations: [],
    availableDates: [],
    viewMode: false,
    isBooking: false  // guard contra duplos cliques / chamadas simultâneas
  };

  // ====================================================================
  // INIT - wait for hub:ready
  // ====================================================================
  document.addEventListener('hub:ready', function() {
    // Guard: only run on mesas page
    if (!document.getElementById('desk-grid')) return;

    // Mesas page allows view mode (no login required)
    state.viewMode = hub.auth._source === 'view';

    setupUI();
    init();
  });

  // ====================================================================
  // SETUP UI (login button)
  // ====================================================================
  function setupUI() {
    if (state.viewMode) {
      $('#open-login-btn').show().on('click', function() {
        hub._loginFlow.open ? hub._loginFlow.open() : hub.auth.showLoginModal();
      });
    }
  }

  // ====================================================================
  // INIT
  // ====================================================================
  async function init() {
    try {
      await loadDesks();
      generateAvailableDates();
      await loadReservations();

      renderDateSelector();
      renderDesks();
      updateFreeCount();
      await updateSuggestion();
      await checkCheckinParam();

      $('#app-view').fadeIn(300);
      hub.utils.hideLoader();
    } catch (err) {
      console.error('Mesas: init error', err);
      hub.utils.showToast('Falha ao iniciar. Verifique sua conexao.', 'error');
      hub.utils.hideLoader();
    }
  }

  // ====================================================================
  // DATA LOADING
  // ====================================================================
  async function loadDesks() {
    var resp = await hub.sb
      .from('desks')
      .select('*')
      .eq('is_active', true)
      .order('number');

    if (resp.error) throw resp.error;
    state.desks = resp.data || [];
  }

  async function loadReservations() {
    var resp = await hub.sb
      .from('reservations')
      .select('*')
      .eq('date', state.selectedDate);

    if (resp.error) throw resp.error;
    state.reservations = resp.data || [];
  }

  async function refreshData() {
    await loadReservations();
  }

  // ====================================================================
  // AVAILABLE DATES (next 6 business days)
  // ====================================================================
  function generateAvailableDates() {
    var dates = [];
    var today = new Date();
    var daysAdded = 0;
    var i = 0;

    while (daysAdded < 6 && i < 14) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() >= 1 && d.getDay() <= 5) {
        dates.push(d.toISOString().split('T')[0]);
        daysAdded++;
      }
      i++;
    }

    state.availableDates = dates;
    if (!state.selectedDate && dates.length > 0) {
      state.selectedDate = dates[0];
    }
  }

  // ====================================================================
  // DATE SELECTOR (modernized: big day number + weekday abbr)
  // ====================================================================
  function renderDateSelector() {
    var html = state.availableDates.map(function(date) {
      var active = state.selectedDate === date ? 'active' : '';
      var parts = date.split('-');
      var dayNum = parseInt(parts[2], 10);
      var weekday = isToday(date) ? 'HOJE' : getWeekdayLabel(date).toUpperCase();

      return '' +
        '<button class="btn btn-secondary date-selector-btn ' + active + '" data-date="' + date + '">' +
          '<div class="d-flex flex-column align-items-center lh-1">' +
            '<span style="font-size:1.4rem;font-weight:700;line-height:1;">' + dayNum + '</span>' +
            '<small class="' + (active ? 'text-white' : 'text-muted') + '" style="font-size:0.7rem;text-transform:uppercase;">' + weekday + '</small>' +
          '</div>' +
        '</button>';
    }).join('');

    $('#date-selector').html(html);
    $('#selected-date-display').text(formatDate(state.selectedDate));

    $('.date-selector-btn').off('click').on('click', function() {
      state.selectedDate = $(this).data('date');
      hub.utils.showLoader();
      refreshData().then(function() {
        renderDateSelector();
        renderDesks();
        updateFreeCount();
        updateSuggestion();
        hub.utils.hideLoader();
      });
    });
  }

  // ====================================================================
  // DESK GRID
  // ====================================================================
  function renderDesks() {
    var $grid = $('#desk-grid');

    if (state.desks.length === 0) {
      $grid.html('<p class="text-center text-muted py-4">Nenhuma mesa ativa encontrada.</p>');
      return;
    }

    var user = hub.auth.getUser();
    var userName = user ? user.user_name : null;
    var isAdmin = user ? user.isAdmin : false;

    // Check if the current user already has a reservation today (non-canceled)
    var myResToday = null;
    state.reservations.forEach(function(r) {
      if (r.created_by === userName && !r.canceled_at) myResToday = r;
    });
    var hasResToday = !!myResToday;

    // Profile complete check — cadastro incompleto bloqueia reserva
    var profileComplete = user ? user.profileComplete : true;

    var html = state.desks.map(function(desk) {
      // Active (non-canceled) reservation for this desk
      var realRes = null;
      for (var i = 0; i < state.reservations.length; i++) {
        var r = state.reservations[i];
        if (r.desk_name === desk.desk_name && !r.canceled_at) {
          realRes = r;
          break;
        }
      }

      // Check if fixed desk was freed (canceled mesa_fixa record)
      var wasFreed = false;
      for (var j = 0; j < state.reservations.length; j++) {
        var rv = state.reservations[j];
        if (rv.desk_name === desk.desk_name && rv.canceled_at && rv.created_by === 'mesa_fixa') {
          wasFreed = true;
          break;
        }
      }

      var displayRes = null;
      var isOccupied = false;

      if (realRes) {
        displayRes = realRes;
        isOccupied = true;
      } else if (desk.fixed_reserve && !wasFreed) {
        // Fixed desk not freed - show as virtual reservation
        displayRes = {
          created_by: desk.fixed_reserve,
          display_name: desk.fixed_reserve,
          is_virtual: true
        };
        isOccupied = true;
      }

      var isMyRes = displayRes && displayRes.created_by === userName;
      var canBook = !isOccupied && !state.viewMode && profileComplete && (isAdmin || !hasResToday);

      var cardClass = isOccupied ? (isMyRes ? 'my-reservation' : 'occupied') : 'available';
      var statusText = isOccupied ? (displayRes.display_name || displayRes.created_by || 'Reservado') : 'Livre';
      var btnHtml = '';

      if (!state.viewMode) {
        if (isOccupied) {
          if (isAdmin || isMyRes) {
            btnHtml = '<button class="btn btn-sm btn-danger cancel-btn" data-num="' + desk.number + '" data-res-id="' + (displayRes.id || '') + '">Liberar</button>';
          }
        } else if (canBook) {
          btnHtml = '<button class="btn btn-sm btn-primary book-btn" data-num="' + desk.number + '">Reservar</button>';
        }
      }

      // Adjust grid_row for corridor gaps
      var actualGridRow = desk.grid_row;
      if (desk.grid_row >= 3 && desk.grid_row <= 4) {
        actualGridRow = desk.grid_row + 1;
      } else if (desk.grid_row >= 5 && desk.grid_row <= 6) {
        actualGridRow = desk.grid_row + 2;
      } else if (desk.grid_row >= 7) {
        actualGridRow = desk.grid_row + 3;
      }

      var style = 'grid-row:' + actualGridRow + ';grid-column:' + desk.grid_col +
        ';grid-row-end:span ' + (desk.row_span || 1) +
        ';grid-column-end:span ' + (desk.col_span || 1) + ';';

      return '' +
        '<div class="card desk-card ' + cardClass + '" style="' + style + '">' +
          '<div class="card-body p-3 d-flex flex-column justify-content-between text-center">' +
            '<h6 class="card-title mb-1">' + desk.desk_name + '</h6>' +
            '<span class="reserved-name small text-truncate">' + statusText + '</span>' +
            btnHtml +
          '</div>' +
        '</div>';
    }).join('');

    $grid.html(html);

    if (!state.viewMode) {
      $('.book-btn').off('click').on('click', function() {
        makeReservation($(this).data('num'));
      });
      $('.cancel-btn').off('click').on('click', function() {
        cancelReservation($(this).data('num'), $(this).data('res-id'));
      });
    }

    initDragScroll();
  }

  // ====================================================================
  // FREE DESKS COUNTER
  // ====================================================================
  function updateFreeCount() {
    var activeReservations = state.reservations.filter(function(r) { return !r.canceled_at; });
    var occupiedDesks = {};

    activeReservations.forEach(function(r) {
      occupiedDesks[r.desk_name] = true;
    });

    state.desks.forEach(function(desk) {
      if (desk.fixed_reserve) {
        var wasFreed = false;
        for (var i = 0; i < state.reservations.length; i++) {
          var r = state.reservations[i];
          if (r.desk_name === desk.desk_name && r.canceled_at && r.created_by === 'mesa_fixa') {
            wasFreed = true;
            break;
          }
        }
        if (!wasFreed) {
          occupiedDesks[desk.desk_name] = true;
        }
      }
    });

    var occupiedCount = Object.keys(occupiedDesks).length;
    var freeCount = state.desks.length - occupiedCount;
    $('#free-count-badge').text(freeCount + ' Livres');
  }

  // ====================================================================
  // SMART DESK SUGGESTION
  // ====================================================================
  async function updateSuggestion() {
    var $el = $('#suggestion-content');

    if (state.viewMode) {
      $el.html('<span class="text-muted">Faca login para receber sugestoes personalizadas.</span>');
      return;
    }

    var user = hub.auth.getUser();
    if (!user) {
      $el.html('<span class="text-muted">Nenhuma sugestao disponivel.</span>');
      return;
    }

    // Build set of available desks for selected date
    var occupiedDesks = getOccupiedDeskNames();
    var availableDesks = state.desks.filter(function(d) {
      return !occupiedDesks[d.desk_name];
    });

    // Verifica se o usuário tem mesa fixa (não liberada para o dia)
    var myFixedDesk = null;
    state.desks.forEach(function(desk) {
      if (desk.fixed_reserve === user.user_name) {
        var wasFreed = state.reservations.some(function(r) {
          return r.desk_name === desk.desk_name && r.canceled_at && r.created_by === 'mesa_fixa';
        });
        if (!wasFreed) myFixedDesk = desk;
      }
    });

    // Verifica se o usuário tem reserva DB para a data selecionada
    var myRes = null;
    state.reservations.forEach(function(r) {
      if (r.created_by === user.user_name && !r.canceled_at) {
        if (!myRes) myRes = r; // usa o mais antigo encontrado
      }
    });

    // Mesa atribuída: fixa tem prioridade sobre reserva DB
    var myAssignedDesk = null;
    var myResId = null;
    var isFixedDesk = false;

    if (myFixedDesk) {
      myAssignedDesk = myFixedDesk;
      isFixedDesk = true;
    } else if (myRes) {
      myAssignedDesk = state.desks.find(function(d) { return d.desk_name === myRes.desk_name; });
      myResId = myRes.id;
    }

    // Mostrar "Mesa Agendada" para qualquer usuário com mesa atribuída (admin inclusive)
    if (myAssignedDesk) {
      var deskLabel = myAssignedDesk.desk_name || 'Mesa';
      var subLabel = isFixedDesk ? 'Mesa fixa' : 'Reservado';
      var cancelBtn = isFixedDesk ? '' :
        '<button class="btn btn-sm btn-outline-danger ml-2 cancel-suggestion-btn"' +
          ' data-res-id="' + (myResId || '') + '" data-num="' + (myAssignedDesk.number || '') + '">' +
          '<i class="fa-solid fa-xmark"></i> Liberar' +
        '</button>';

      $el.html(
        '<div class="suggestion-my-reservation">' +
          '<div>' +
            '<div class="suggestion-my-res-label"><i class="fa-solid fa-circle-check"></i> ' + subLabel + '</div>' +
            '<strong style="font-size:1.2rem;">' + hub.utils.escapeHtml(deskLabel) + '</strong>' +
          '</div>' +
          cancelBtn +
        '</div>'
      );

      if (!isFixedDesk) {
        $('.cancel-suggestion-btn').off('click').on('click', function() {
          cancelReservation($(this).data('num'), $(this).data('res-id'));
        });
      }

      // Atualiza título do card
      var $card = $('#suggestion-card h6');
      if ($card.length) $card.html('<i class="fa-solid fa-calendar-check"></i> Mesa Agendada');
      return;
    }

    if (availableDesks.length === 0) {
      $el.html('<span class="text-muted">Nenhuma mesa disponivel nesta data.</span>');
      return;
    }

    // Restaura título padrão
    var $card = $('#suggestion-card h6');
    if ($card.length) $card.html('<i class="fa-solid fa-lightbulb"></i> Mesa Sugerida');

    try {
      var scores = {};
      availableDesks.forEach(function(d) { scores[d.desk_name] = 0; });

      // 1. Personal history: most reserved desk in last 30 days
      var thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      var historyDate = thirtyDaysAgo.toISOString().split('T')[0];

      var histResp = await hub.sb
        .from('reservations')
        .select('desk_name')
        .eq('created_by', user.user_name)
        // .gte('date', historyDate)
        .is('canceled_at', null);

      var historyCounts = {};
      var topHistoryDesk = null;
      var topHistoryCount = 0;
      var historyProximityActive = false; // true quando mesa habitual não disponível

      if (histResp.data && histResp.data.length > 0) {
        histResp.data.forEach(function(r) {
          historyCounts[r.desk_name] = (historyCounts[r.desk_name] || 0) + 1;
        });
        Object.keys(historyCounts).forEach(function(dn) {
          if (historyCounts[dn] > topHistoryCount) {
            topHistoryCount = historyCounts[dn];
            topHistoryDesk = dn;
          }
        });
        // Aplica score ao top desk histórico; se indisponível, pontua mesas próximas
        if (topHistoryDesk && scores.hasOwnProperty(topHistoryDesk)) {
          // Mesa habitual disponível → boost direto
          scores[topHistoryDesk] += 3;
        } else if (topHistoryDesk) {
          // Mesa habitual ocupada → pontuar mesas vizinhas
          // Formato desk_name: letra(row) + número(col), ex: "A1", "B3"
          historyProximityActive = true;
          var parseDeskName = function(name) {
            return { row: name.charAt(0), num: parseInt(name.slice(1), 10) || 0 };
          };
          var target = parseDeskName(topHistoryDesk);
          Object.keys(scores).forEach(function(dn) {
            var d = parseDeskName(dn);
            var rowDist = Math.abs(d.row.charCodeAt(0) - target.row.charCodeAt(0));
            var numDist = Math.abs(d.num - target.num);
            if (rowDist === 0) {
              if (numDist === 1)     scores[dn] += 2; // mesma linha, número adjacente
              else if (numDist <= 3) scores[dn] += 1; // mesma linha, número próximo
            } else if (rowDist === 1 && numDist <= 2) {
              scores[dn] += 1;                        // linha adjacente, número próximo
            }
          });
        }
      }

      // 2. Nucleo proximity (+2pts): desks reserved by same nucleo on selected date
      // 3. Coordenacao proximity (+1pt): same for coordenacao
      if (user.nucleo_id || user.coordenacao_id) {
        // Find colleagues with same nucleo / coordenacao
        var colleagueFilters = [];
        if (user.nucleo_id) colleagueFilters.push({ field: 'nucleo_id', val: user.nucleo_id, pts: 2 });
        if (user.coordenacao_id) colleagueFilters.push({ field: 'coordenacao_id', val: user.coordenacao_id, pts: 1 });

        for (var ci = 0; ci < colleagueFilters.length; ci++) {
          var cf = colleagueFilters[ci];
          var usersResp = await hub.sb
            .from('users')
            .select('user_name')
            .eq(cf.field, cf.val)
            .neq('user_name', user.user_name)
            .eq('is_active', true);

          if (usersResp.data && usersResp.data.length > 0) {
            var colleagueNames = usersResp.data.map(function(u) { return u.user_name; });

            // Find which desks these colleagues reserved for the selected date
            var colResResp = await hub.sb
              .from('reservations')
              .select('desk_name')
              .eq('date', state.selectedDate)
              .is('canceled_at', null)
              .in('created_by', colleagueNames);

            if (colResResp.data) {
              // For each colleague desk, give proximity points to adjacent desks
              var colleagueDesks = {};
              colResResp.data.forEach(function(r) { colleagueDesks[r.desk_name] = true; });

              // Add pts to available desks that are in same grid row neighborhood
              var colleagueDeskObjs = state.desks.filter(function(d) { return colleagueDesks[d.desk_name]; });

              availableDesks.forEach(function(ad) {
                colleagueDeskObjs.forEach(function(cd) {
                  // Same row or adjacent row, within 2 columns = proximity
                  var rowDist = Math.abs(ad.grid_row - cd.grid_row);
                  var colDist = Math.abs(ad.grid_col - cd.grid_col);
                  if (rowDist <= 1 && colDist <= 2) {
                    scores[ad.desk_name] += cf.pts;
                  }
                });
              });
            }
          }
        }
      }

      // Tiebreak: lower desk number
      var bestDesk = null;
      var bestScore = -1;
      availableDesks.forEach(function(d) {
        var s = scores[d.desk_name] || 0;
        if (s > bestScore || (s === bestScore && (!bestDesk || d.number < bestDesk.number))) {
          bestScore = s;
          bestDesk = d;
        }
      });

      if (!bestDesk) {
        $el.html('<span class="text-muted">Nenhuma sugestao disponivel.</span>');
        return;
      }

      // Determine reason text
      var reason = 'Mesa disponivel';
      if (topHistoryDesk === bestDesk.desk_name && bestScore >= 3) {
        reason = 'Sua mesa mais frequente';
      } else if (historyProximityActive && bestScore > 0) {
        reason = (bestDesk.desk_name.charAt(0) === topHistoryDesk.charAt(0))
          ? 'Mesma linha que sua mesa habitual'
          : 'Proxima a sua mesa habitual';
      } else if (bestScore >= 2) {
        reason = 'Perto do seu nucleo';
      } else if (bestScore >= 1) {
        reason = 'Perto da sua coordenacao';
      }

      var suggestionHtml = '' +
        '<div class="d-flex align-items-center justify-content-between">' +
          '<div>' +
            '<strong style="font-size:1.1rem;">' + bestDesk.desk_name + '</strong>' +
            '<div class="text-muted small">' + reason + '</div>' +
          '</div>' +
          '<div class="d-flex gap-2">' +
            '<button class="btn btn-sm btn-primary mr-2 suggestion-book-btn" data-num="' + bestDesk.number + '">Reservar</button>' +
            '<button class="btn btn-sm btn-secondary suggestion-view-btn">Ver outras</button>' +
          '</div>' +
        '</div>';

      $el.html(suggestionHtml);

      $('.suggestion-book-btn').off('click').on('click', function() {
        makeReservation($(this).data('num'));
      });
      $('.suggestion-view-btn').off('click').on('click', function() {
        $('html, body').animate({ scrollTop: $('#desk-grid').offset().top - 80 }, 400);
      });

    } catch (err) {
      console.error('Mesas: suggestion error', err);
      $el.html('<span class="text-muted">Nao foi possivel gerar sugestao.</span>');
    }
  }

  /**
   * Returns an object whose keys are occupied desk_names for the current date.
   */
  function getOccupiedDeskNames() {
    var occupied = {};

    state.reservations.forEach(function(r) {
      if (!r.canceled_at) occupied[r.desk_name] = true;
    });

    state.desks.forEach(function(desk) {
      if (desk.fixed_reserve) {
        var wasFreed = false;
        for (var i = 0; i < state.reservations.length; i++) {
          var r = state.reservations[i];
          if (r.desk_name === desk.desk_name && r.canceled_at && r.created_by === 'mesa_fixa') {
            wasFreed = true;
            break;
          }
        }
        if (!wasFreed) occupied[desk.desk_name] = true;
      }
    });

    return occupied;
  }

  // ====================================================================
  // RESERVATION ACTIONS
  // ====================================================================
  async function makeReservation(deskNumber) {
    if (state.isBooking) return; // evita duplos cliques / chamadas simultâneas
    state.isBooking = true;

    try {
      var desk = state.desks.find(function(d) { return d.number == deskNumber; });
      if (!desk) {
        hub.utils.showToast('Mesa nao encontrada. Tente novamente.', 'warning');
        return;
      }

      var user = hub.auth.getUser();
      if (!user || state.viewMode) {
        hub.utils.showToast('Faca login para reservar.', 'warning');
        return;
      }
      if (!user.profileComplete) {
        hub.utils.showToast('Cadastro incompleto! Complete seu perfil para reservar mesas.', 'warning');
        return;
      }

      var payload = {
        date: state.selectedDate,
        desk_name: desk.desk_name,
        created_by: user.user_name
      };

      var resp = await hub.sb
        .from('reservations')
        .insert(payload);

      if (resp.error) {
        if (resp.error.message && resp.error.message.indexOf('date_user') !== -1) {
          hub.utils.showToast('Voce ja possui uma reserva para este dia.', 'warning');
        } else if (resp.error.message && resp.error.message.indexOf('pkey') !== -1) {
          hub.utils.showToast('Requisicao duplicada. Tente novamente.', 'warning');
        } else {
          hub.utils.showToast('Esta mesa ja foi reservada. Atualize a pagina.', 'warning');
        }
        throw resp.error;
      }

      hub.utils.showToast('Reserva confirmada na ' + desk.desk_name + '!', 'success');
      await refreshData();
      renderDateSelector();
      renderDesks();
      updateFreeCount();
      updateSuggestion();
    } catch (err) {
      console.error('Mesas: reservation error', err);
    } finally {
      state.isBooking = false;
    }
  }

  async function cancelReservation(deskNumber, resId) {
    try {
      var desk = state.desks.find(function(d) { return d.number == deskNumber; });
      if (!desk) {
        hub.utils.showToast('Mesa nao encontrada.', 'warning');
        return;
      }

      var user = hub.auth.getUser();
      if (!user) return;

      if (!resId) {
        // Free a fixed desk - insert a canceled mesa_fixa record
        await hub.sb.from('reservations').insert({
          date: state.selectedDate,
          desk_name: desk.desk_name,
          created_by: 'mesa_fixa',
          canceled_at: new Date().toISOString(),
          canceled_by: user.user_name
        });
      } else {
        // Cancel an existing reservation
        await hub.sb
          .from('reservations')
          .update({
            canceled_at: new Date().toISOString(),
            canceled_by: user.user_name
          })
          .eq('id', resId);
      }

      hub.utils.showToast('Mesa liberada com sucesso!', 'success');
      await refreshData();
      renderDateSelector();
      renderDesks();
      updateFreeCount();
      updateSuggestion();
    } catch (err) {
      console.error('Mesas: cancel error', err);
      hub.utils.showToast('Nao foi possivel liberar a mesa.', 'error');
    }
  }

  // ====================================================================
  // CHECK-IN VIA QR CODE
  // ====================================================================
  async function checkCheckinParam() {
    if (state.viewMode) return;

    var urlParams = new URLSearchParams(window.location.search);
    var deskToCheckin = urlParams.get('checkin');
    if (!deskToCheckin) return;

    var user = hub.auth.getUser();
    if (!user) return;

    var res = state.reservations.find(function(r) {
      return r.desk_name === deskToCheckin && r.created_by === user.user_name && !r.canceled_at;
    });

    if (res) {
      await hub.sb
        .from('reservations')
        .update({ checked_in_at: new Date().toISOString() })
        .eq('id', res.id);
      hub.utils.showToast('Check-in realizado com sucesso!', 'success');
    } else {
      hub.utils.showToast('Nenhum agendamento encontrado para check-in.', 'warning');
    }
  }

  // ====================================================================
  // DRAG SCROLL
  // ====================================================================
  function initDragScroll() {
    var grid = document.getElementById('desk-grid');
    if (!grid) return;

    var isDown = false;
    var startX, startY, scrollLeft, scrollTop;

    grid.addEventListener('mousedown', function(e) {
      if (e.target.closest('button')) return;
      e.preventDefault(); // impede selecao de texto ao arrastar
      isDown = true;
      grid.style.cursor = 'grabbing';
      grid.style.userSelect = 'none';
      grid.style.webkitUserSelect = 'none';
      startX = e.pageX - grid.offsetLeft;
      startY = e.pageY - grid.offsetTop;
      scrollLeft = grid.scrollLeft;
      scrollTop = grid.scrollTop;
    });

    grid.addEventListener('mouseleave', function() {
      isDown = false;
      grid.style.cursor = 'grab';
      grid.style.userSelect = '';
      grid.style.webkitUserSelect = '';
    });

    grid.addEventListener('mouseup', function() {
      isDown = false;
      grid.style.cursor = 'grab';
      grid.style.userSelect = '';
      grid.style.webkitUserSelect = '';
    });

    grid.addEventListener('mousemove', function(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - grid.offsetLeft;
      var y = e.pageY - grid.offsetTop;
      grid.scrollLeft = scrollLeft - (x - startX) * 2;
      grid.scrollTop = scrollTop - (y - startY) * 2;
    });
  }

  // ====================================================================
  // UTILITY FUNCTIONS
  // ====================================================================
  function formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  function formatDateShort(d) {
    var parts = d.split('-');
    return parts[2] + '/' + parts[1];
  }

  function getWeekdayLabel(d) {
    var days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    return days[new Date(d + 'T00:00:00').getDay()];
  }

  function isToday(d) {
    return d === new Date().toISOString().split('T')[0];
  }

})(jQuery);
