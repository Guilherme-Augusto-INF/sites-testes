const SUPABASE_URL = 'https://nmwktpnsbwhgxkqmcaud.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0v9XHkOALMZlg-cQHE6mCA_d_1j6xbE';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('auth-actions');
  if (!container || !window.supabase) return;

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  function render(session) {
    if (session) {
      container.innerHTML = '<a class="auth-btn auth-profile" href="perfil.html">Perfil</a>';
    } else {
      container.innerHTML = '<a class="auth-btn" href="login.html">Entrar</a><a class="auth-btn auth-register" href="cadastro.html">Registrar</a>';
    }
  }

  const { data: { session } } = await client.auth.getSession();
  render(session);
  client.auth.onAuthStateChange((_event, nextSession) => render(nextSession));
});