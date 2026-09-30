const SUPABASE_URL = 'https://nmwktpnsbwhgxkqmcaud.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0v9XHkOALMZlg-cQHE6mCA_d_1j6xbE';

let supabaseClient;
const supabaseClientReady = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
  .then(({ createClient }) => {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return supabaseClient;
  });


function initials(name, email) {
  const source = (name || email || '?').trim();
  return source.split(/\\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

function safe(value, fallback) {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

async function getProfile(user) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id,email,username,full_name,avatar_url,bio')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  const { data: created, error: createError } = await supabaseClient
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email || '',
      username: '',
      full_name: '',
      avatar_url: '',
      bio: ''
    }, { onConflict: 'id' })
    .select('id,email,username,full_name,avatar_url,bio')
    .single();

  if (createError) throw createError;
  return created;
}

function setAvatar(element, profile, user) {
  element.replaceChildren();

  if (profile && profile.avatar_url) {
    const img = document.createElement('img');
    img.src = profile.avatar_url;
    img.alt = 'Foto de perfil';
    img.loading = 'lazy';
    element.appendChild(img);
    return;
  }

  element.textContent = initials(profile?.full_name, user?.email);
}

function buildUserMenu(user, profile) {
  const old = document.querySelector('.user-menu-wrapper');
  if (old) old.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'user-menu-wrapper';

  const button = document.createElement('button');
  button.className = 'user user-menu-button';
  button.type = 'button';
  button.title = 'Minha conta';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'true');
  setAvatar(button, profile, user);

  const card = document.createElement('div');
  card.className = 'user-id-card';
  card.setAttribute('aria-hidden', 'true');

  const avatar = document.createElement('div');
  avatar.className = 'user-id-avatar';
  setAvatar(avatar, profile, user);

  const info = document.createElement('div');
  info.className = 'user-id-info';

  const fullName = document.createElement('strong');
  fullName.textContent = safe(profile?.full_name, 'Usuário');

  const username = document.createElement('span');
  username.textContent = profile?.username ? '@' + profile.username : 'Usuário sem nome definido';

  info.append(fullName, username);

  const rows = document.createElement('div');
  rows.className = 'user-id-details';

  const emailRow = document.createElement('div');
  emailRow.innerHTML = '<span>Email</span><b></b>';
  emailRow.querySelector('b').textContent = safe(user.email, 'Não informado');

  const idRow = document.createElement('div');
  idRow.innerHTML = '<span>ID</span><b></b>';
  idRow.querySelector('b').textContent = user.id;

  rows.append(emailRow, idRow);

  const actions = document.createElement('div');
  actions.className = 'user-id-actions';

  const edit = document.createElement('a');
  edit.href = 'perfil.html';
  edit.className = 'user-id-edit';
  edit.textContent = 'Editar perfil';

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'user-id-logout';
  logout.textContent = 'Sair da conta';

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    logout.textContent = 'Saindo...';
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Logout Supabase:', error);
      logout.disabled = false;
      logout.textContent = 'Sair da conta';
      return;
    }
    window.location.href = 'login.html';
  });

  actions.append(edit, logout);
  card.append(
    Object.assign(document.createElement('div'), { className: 'user-id-head' }),
    rows,
    actions
  );
  card.querySelector('.user-id-head').append(avatar, info);

  wrapper.append(button, card);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    const open = wrapper.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
    card.setAttribute('aria-hidden', String(!open));
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) {
      wrapper.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      card.setAttribute('aria-hidden', 'true');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      wrapper.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      card.setAttribute('aria-hidden', 'true');
    }
  });

  const anchor = document.querySelector('.topo .user');
  if (anchor) anchor.replaceWith(wrapper);
}

function buildLoginButton() {
  const oldMenu = document.querySelector('.user-menu-wrapper');
  if (oldMenu) oldMenu.remove();

  const old = document.querySelector('.topo .user');
  if (!old) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'user-menu-wrapper';

  const link = document.createElement('a');
  link.className = 'user';
  link.href = 'login.html';
  link.title = 'Entrar';
  link.textContent = '👤';

  const card = document.createElement('div');
  card.className = 'user-id-card user-login-card';

  const title = document.createElement('strong');
  title.textContent = 'Você não está conectado';

  const text = document.createElement('p');
  text.textContent = 'Entre para editar seu perfil, adicionar uma foto e acessar seus dados.';

  const actions = document.createElement('div');
  actions.className = 'user-id-actions';

  const login = document.createElement('a');
  login.className = 'user-id-edit';
  login.href = 'login.html';
  login.textContent = 'Entrar';

  const signup = document.createElement('a');
  signup.className = 'user-id-logout';
  signup.href = 'cadastro.html';
  signup.textContent = 'Cadastrar';

  actions.append(login, signup);
  card.append(title, text, actions);
  wrapper.append(link, card);

  link.addEventListener('click', () => {
    wrapper.classList.remove('open');
  });

  old.replaceWith(wrapper);
}

async function initHeader() {
  const anchor = document.querySelector('.topo .user');
  if (!anchor) return;

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      buildLoginButton();
      return;
    }

    const profile = await getProfile(user);
    buildUserMenu(user, profile);
  } catch (error) {
    console.error('Perfil/cabeçalho:', error);
    buildLoginButton();
  }
}

async function initProfilePage() {
  const form = document.getElementById('profile-form');
  if (!form) return;

  const message = document.getElementById('profile-message');
  const saveButton = document.getElementById('save-profile');
  const avatarPreview = document.getElementById('profile-avatar-preview');
  const fileInput = document.getElementById('avatar-file');

  const setMessage = (text) => { message.textContent = text; };

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.replace('login.html');
    return;
  }

  let profile;
  try {
    profile = await getProfile(user);
  } catch (error) {
    console.error('Carregamento do perfil:', error);
    setMessage('Não foi possível carregar seu perfil. Tente novamente.');
    return;
  }

  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-username').value = profile.username || '';
  document.getElementById('profile-full-name').value = profile.full_name || '';
  document.getElementById('profile-bio').value = profile.bio || '';
  setAvatar(avatarPreview, profile, user);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      fileInput.value = '';
      setMessage('Escolha uma imagem válida.');
      return;
    }
    const url = URL.createObjectURL(file);
    avatarPreview.replaceChildren();
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Prévia da foto';
    avatarPreview.appendChild(img);
    setMessage('');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    setMessage('Salvando perfil...');

    try {
      const username = document.getElementById('profile-username').value.trim().replace(/^@+/, '');
      const fullName = document.getElementById('profile-full-name').value.trim();
      const bio = document.getElementById('profile-bio').value.trim();

      if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
        throw new Error('O nome de usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto, _ ou -.');
      }

      let avatarUrl = profile.avatar_url || '';
      const file = fileInput.files[0];

      if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem válida.');
        if (file.size > 5 * 1024 * 1024) throw new Error('A foto deve ter no máximo 5 MB.');

        const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = user.id + '/' + Date.now() + '.' + (extension || 'jpg');

        const { error: uploadError } = await supabaseClient.storage
          .from('avatars')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabaseClient.storage.from('avatars').getPublicUrl(path);
        avatarUrl = publicData.publicUrl;
      }

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          username,
          full_name: fullName,
          bio,
          avatar_url: avatarUrl,
          email: user.email || ''
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      profile = { ...profile, username, full_name: fullName, bio, avatar_url: avatarUrl };
      setAvatar(avatarPreview, profile, user);
      fileInput.value = '';
      setMessage('Perfil atualizado com sucesso!');
      await initHeader();
    } catch (error) {
      console.error('Atualização do perfil:', error);
      setMessage(error.message || 'Não foi possível salvar o perfil.');
    } finally {
      saveButton.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await supabaseClientReady;
  } catch (error) {
    console.error('Inicialização do Supabase:', error);
    return;
  }
  await initHeader();
  await initProfilePage();
});