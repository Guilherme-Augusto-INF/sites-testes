const SUPABASE_URL = 'https://nmwktpnsbwhgxkqmcaud.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0v9XHkOALMZlg-cQHE6mCA_d_1j6xbE';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function showProfileMessage(message, type = '') {
  const el = document.getElementById('profile-message');
  if (!el) return;
  el.textContent = message;
  el.className = 'profile-message ' + type;
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('profile-form');
  const logout = document.getElementById('logout-button');

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace('login.html');
    return;
  }

  const user = session.user;
  document.getElementById('profile-email').value = user.email || '';

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('username,full_name,bio')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    showProfileMessage('Não foi possível carregar o perfil.', 'error');
  } else if (profile) {
    document.getElementById('profile-username').value = profile.username || '';
    document.getElementById('profile-full-name').value = profile.full_name || '';
    document.getElementById('profile-bio').value = profile.bio || '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showProfileMessage('Salvando...');

    const username = document.getElementById('profile-username').value.trim();
    const fullName = document.getElementById('profile-full-name').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        username: username || null,
        full_name: fullName || null,
        bio: bio || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(updateError);
      showProfileMessage(updateError.code === '23505' ? 'Esse nome de usuário já está em uso.' : 'Não foi possível salvar o perfil.', 'error');
      return;
    }

    showProfileMessage('Perfil salvo com sucesso.', 'success');
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    logout.textContent = 'Saindo...';
    await supabaseClient.auth.signOut();
    window.location.replace('index.html');
  });
});