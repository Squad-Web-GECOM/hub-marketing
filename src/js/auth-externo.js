// Este arquivo contém a lógica de autenticação via modal de login.
// Inclua este arquivo APÓS o 'agendamento-core.js' na página de acesso restrito.

(function($) {
  'use strict';

  const CACHED_USER_KEY = 'agendamento_cached_user';
  const allowedUsers = ['guilherme.duarte', 'lara.pacheco', 'jonathan.araujo', 'fabiola.souza', 'joao.vidal'];

  // Adiciona o modal de login à página dinamicamente
  function addLoginModal() {
    const modalStyles = `
      <style>
        #login-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        #login-modal { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center; width: 90%; max-width: 400px; }
        #login-modal h3 { margin-bottom: 1rem; }
        #login-modal p { margin-bottom: 1.5rem; color: #6c757d; }
        #login-modal input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        #login-modal button { width: 100%; padding: 0.75rem; border: none; background-color: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        #login-modal button:hover { background-color: #0056b3; }
        #login-error { color: #dc3545; margin-top: 1rem; display: none; font-size: 0.9rem; }
      </style>
    `;
    const modalHtml = `
      <div id="login-overlay">
        <div id="login-modal">
          <h3>Acesso Restrito</h3>
          <p>Por favor, insira seu nome de usuário para continuar.</p>
          <input type="text" id="username-input" class="form-control" placeholder="usuário" autocomplete="off">
          <button id="login-btn" class="btn btn-primary">Entrar</button>
          <p id="login-error"></p>
        </div>
      </div>
    `;
    $('head').append(modalStyles);
    $('body').append(modalHtml);
  }

  // Adiciona o botão de logout na interface principal, após o nome do usuário
  function addLogoutButton() {
    const logoutBtnHtml = `<button id="logout-btn-app" class="btn btn-sm btn-outline-danger ml-2" style="padding: .1rem .4rem; font-size: .8rem; vertical-align: middle;">Sair</button>`;
    $('#user-name').after(logoutBtnHtml);
    $('#logout-btn-app').on('click', handleLogout);
  }
  
  // Limpa o usuário do cache e recarrega a página
  function handleLogout() {
    localStorage.removeItem(CACHED_USER_KEY);
    location.reload();
  }

  // Centraliza a lógica de login: define usuário, salva no cache, inicia a app e adiciona botão de sair
  function loginUser(username) {
    localStorage.setItem(CACHED_USER_KEY, username);
    const user = {
      id: `${username}@sicoob.com.br`,
      name: username,
      email: `${username}@sicoob.com.br`
    };
    
    AppAgendamento.setCurrentUser(user);
    
    // A função init() é assíncrona, então usamos .then() para garantir que o DOM foi renderizado antes de adicionar o botão
    AppAgendamento.init().then(() => {
      addLogoutButton();
    });
  }

  // Valida o usuário inserido no formulário do modal
  function handleManualLogin() {
    const username = $('#username-input').val().trim().toLowerCase();
    const errorEl = $('#login-error');

    if (allowedUsers.includes(username)) {
      errorEl.hide();
      $('#login-overlay').fadeOut(300, function() { 
        $(this).remove(); 
        loginUser(username);
      });
    } else {
      errorEl.text('Usuário inválido ou não autorizado.').show();
    }
  }

  // Inicialização
  $(document).ready(() => {
    $('#app-view').hide();
    const cachedUser = localStorage.getItem(CACHED_USER_KEY);

    // Verifica se existe um usuário válido no cache
    if (cachedUser && allowedUsers.includes(cachedUser)) {
      // Se encontrou, faz o login direto
      loginUser(cachedUser);
    } else {
      // Senão, mostra o modal de login
      addLoginModal();
      $('#login-btn').on('click', handleManualLogin);
      $('#username-input').on('keypress', function(e) {
        if (e.which === 13) { handleManualLogin(); }
      }).focus();
    }
  });

})(jQuery);

