const SUPABASE_URL = 'https://nmwktpnsbwhgxkqmcaud.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0v9XHkOALMZlg-cQHE6mCA_d_1j6xbE';

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

function setMessage(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage('login-message', 'Entrando...');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMessage('login-message', 'Não foi possível entrar. Verifique o email e a senha.');
        return;
      }

      window.location.href = 'index.html';
    });
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const confirmation = document.getElementById('signup-password-confirm').value;

      if (password !== confirmation) {
        setMessage('signup-message', 'As senhas não coincidem.');
        return;
      }

      setMessage('signup-message', 'Criando sua conta...');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: new URL('login.html', window.location.href).href
        }
      });

      if (error) {
        setMessage('signup-message', 'Não foi possível criar a conta. Verifique os dados e tente novamente.');
        return;
      }

      if (data.session) {
        window.location.href = 'index.html';
      } else {
        setMessage('signup-message', 'Conta criada! Verifique seu email para confirmar o cadastro antes de entrar.');
        signupForm.reset();
      }
    });
  }

  const recoveryForm = document.getElementById('recovery-form');
  const setNewPassword = document.getElementById('set-new-password');
  const requestReset = document.getElementById('request-reset');

  if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = document.getElementById('recovery-email').value.trim();
      setMessage('recovery-message', 'Enviando link...');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('recuperar-senha.html', window.location.href).href
      });

      if (error) {
        setMessage('recovery-message', 'Não foi possível enviar o link. Tente novamente.');
        return;
      }

      setMessage('recovery-message', 'Link enviado! Verifique seu email para continuar.');
    });
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session && setNewPassword && requestReset && window.location.hash.includes('type=recovery')) {
    requestReset.hidden = true;
    setNewPassword.hidden = false;
  }

  const updateButton = document.getElementById('update-password');
  if (updateButton) {
    updateButton.addEventListener('click', async () => {
      const password = document.getElementById('new-password').value;
      const confirmation = document.getElementById('new-password-confirm').value;

      if (password.length < 6) {
        setMessage('new-password-message', 'A senha deve ter pelo menos 6 caracteres.');
        return;
      }

      if (password !== confirmation) {
        setMessage('new-password-message', 'As senhas não coincidem.');
        return;
      }

      setMessage('new-password-message', 'Atualizando senha...');

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage('new-password-message', 'Não foi possível atualizar a senha. Solicite um novo link.');
        return;
      }

      await supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }
});
