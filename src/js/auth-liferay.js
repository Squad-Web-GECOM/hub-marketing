// Este arquivo contém a lógica de autenticação via Liferay ThemeDisplay.
// Inclua este arquivo APÓS o 'agendamento-core.js' na página integrada ao Liferay.

(function($) {
  'use strict';

  // Identificação via Liferay
  function identifyUserFromLiferay() {
    let user = null;
    try {
      const isSignedIn = Liferay?.ThemeDisplay?.isSignedIn?.();
      if (!isSignedIn) {
        // Fallback caso não esteja logado no Liferay (ajuste conforme necessário)
        // user = { id: 'anonimo@sicoob.com.br', name: 'anonimo', email: 'anonimo@sicoob.com.br' };
        throw new Error('Usuário não está logado no Liferay.');
      }
      
      const email = Liferay?.ThemeDisplay?.getUserEmailAddress?.() || '';
      const localPart = email && email.includes('@') ? email.split('@')[0] : '';
      
      if (!email || !localPart) {
         throw new Error('Não foi possível obter o e-mail do usuário no Liferay.');
      }
      user = { id: email, name: localPart, email };
    } catch (e) {
      console.error('Falha ao identificar usuário no Liferay:', e);
      // Aqui você pode definir um comportamento de erro, como mostrar uma mensagem.
      $('#app-view').html('<p class="text-center text-danger">Não foi possível identificar o usuário no Liferay.</p>').show();
      $('#loader').hide();
    }
    return user;
  }

  // Inicialização
  $(document).ready(() => {
    $('#app-view').hide();
    $('#loader').show();

    const currentUser = identifyUserFromLiferay();
    
    if (currentUser) {
        AppAgendamento.setCurrentUser(currentUser);
        AppAgendamento.init();
    }
  });

})(jQuery);
