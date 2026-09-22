import { auth, onAuthStateChanged } from './firebase.js';

const searchIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="11" cy="11" r="6.5"></circle>
  <path d="M16 16l5 5"></path>
</svg>`;

const cartIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20.2 8H6.1"></path>
  <circle cx="10" cy="20" r="1"></circle>
  <circle cx="17" cy="20" r="1"></circle>
</svg>`;

export function header(active = '') {
  const element = document.querySelector('[data-header]');
  if (!element) return;

  element.innerHTML = `
    <header class="site-header figma-header">
      <div class="figma-container figma-nav">
        <a class="figma-brand" href="index.html" aria-label="Zytrix - Início">
          <span class="figma-brand-mark">Z</span>
          <span class="figma-brand-name">Zytrix</span>
        </a>

        <nav class="figma-nav-links" aria-label="Navegação principal">
          <a class="${active === 'inicio' ? 'active' : ''}" href="index.html">Início</a>
          <a class="${active === 'categorias' ? 'active' : ''}" href="categorias.html">Categorias</a>
          <a class="${active === 'ao-vivo' ? 'active' : ''}" href="ao-vivo.html">Ao Vivo</a>
          <a class="${active === 'sobre' ? 'active' : ''}" href="sobre.html">Sobre</a>
        </nav>

        <div class="nav-actions figma-nav-actions">
          <a class="figma-icon-button" href="ao-vivo.html" title="Pesquisar" aria-label="Pesquisar na Zytrix">
            ${searchIcon}
          </a>

          <a id="store-nav" class="figma-icon-button figma-cart hidden" href="loja.html" title="Loja" aria-label="Abrir loja">
            ${cartIcon}
          </a>

          <div id="guest-nav" class="guest-nav figma-guest-nav">
            <a class="figma-btn figma-btn-dark" href="login.html">Entrar</a>
            <a class="figma-btn figma-btn-primary" href="registro.html">Registrar</a>
          </div>

          <a id="profile-nav" class="figma-btn figma-btn-profile hidden" href="perfil.html">Perfil</a>
        </div>
      </div>
    </header>
  `;

  onAuthStateChanged(auth, user => {
    const guest = document.querySelector('#guest-nav');
    const profile = document.querySelector('#profile-nav');
    const store = document.querySelector('#store-nav');
    if (!guest || !profile || !store) return;

    const signedIn = Boolean(user);
    guest.classList.toggle('hidden', signedIn);
    profile.classList.toggle('hidden', !signedIn);
    store.classList.toggle('hidden', !signedIn);
  });
}

export function footer() {
  const element = document.querySelector('[data-footer]');
  if (!element) return;

  element.innerHTML = `
    <footer class="figma-footer">
      <div class="figma-container figma-footer-inner">
        <a class="figma-brand figma-footer-brand" href="index.html" aria-label="Zytrix - Início">
          <span class="figma-brand-mark">Z</span>
          <span class="figma-brand-name">Zytrix</span>
        </a>

        <span class="figma-footer-copy">© 2025 Zytrix. Todos os direitos reservados.</span>

        <nav class="figma-footer-links" aria-label="Links institucionais">
          <a href="sobre.html">Sobre</a>
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
        </nav>
      </div>
    </footer>
  `;
}

export function liveCard(live, options = {}) {
  const initial = (live.username || 'S').charAt(0).toUpperCase();
  const selected = options.selected === true;

  return `
    <article class="figma-live-card${selected ? ' selected' : ''}" data-live-id="${escapeAttr(live.id)}" tabindex="0">
      <div class="figma-live-thumb">
        ${live.thumbnailURL
          ? `<img src="${escapeAttr(live.thumbnailURL)}" alt="Thumbnail de ${escapeAttr(live.username || 'streamer')}">`
          : `<div class="figma-live-placeholder"><span class="figma-brand-mark">Z</span><strong>ZYTRIX</strong></div>`
        }

        <span class="figma-live-badge"><i></i> AO VIVO</span>
        <span class="figma-live-viewers">● ${formatViewers(live.viewerCount)} ESPECTADORES</span>
        <span class="figma-live-play">${selected ? '✓' : '▶'}</span>
      </div>

      <div class="figma-live-meta">
        ${live.photoURL
          ? `<img class="figma-live-avatar" src="${escapeAttr(live.photoURL)}" alt="Foto de ${escapeAttr(live.username || 'streamer')}">`
          : `<span class="figma-live-avatar">${escapeHtml(initial)}</span>`
        }
        <div class="figma-live-copy">
          <strong>${escapeHtml(live.username || 'Streamer')}</strong>
          <span>${escapeHtml(live.title || 'Transmissão ao vivo')}</span>
          <small>${escapeHtml(live.categoryId || '')}</small>
        </div>
      </div>
    </article>
  `;
}

export function formatViewers(value = 0) {
  const number = Math.max(0, Number(value || 0));
  if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
  return number.toLocaleString('pt-BR');
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[character]);
}

export function escapeAttr(value = '') {
  return escapeHtml(value);
}

export const categories = {
  Gaming: ['Ação / Aventura', 'RPG', 'Esportes', 'Simulação'],
  Música: ['Rock', 'Sertanejo', 'Eletrônica', 'Funk'],
  'Just Chatting': ['Bate-Papo', 'Perguntas e Respostas', 'Histórias', 'Desafios'],
  Criatividade: ['Desenho', 'Design', 'Fotografia', 'Edição'],
  Esportes: ['Futebol', 'Basquete', 'Automobilismo', 'Lutas'],
  Tecnologia: ['Programação', 'Hardware', 'Inteligência Artificial', 'Ciência e Tech'],
  Podcasts: ['Conversas', 'Entrevistas', 'Notícias', 'Entretenimento'],
  IRL: ['Viagens', 'Eventos', 'Vida Cotidiana', 'Exploração']
};

export const icons = {
  Gaming: '🎮',
  Música: '🎵',
  'Just Chatting': '🎙️',
  Criatividade: '🎨',
  Esportes: '⚽',
  Tecnologia: '💻',
  Podcasts: '🎧',
  IRL: '🎥'
};
