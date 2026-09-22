import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  mainCategory
} from './firebase.js';
import { header, footer, categories, icons } from './ui.js';

header('categorias');
footer();

const grid = document.querySelector('#categories-grid');
const order = Object.keys(categories);
const referenceCounts = {
  Gaming: 245,
  Música: 128,
  'Just Chatting': 189,
  Criatividade: 96,
  Esportes: 84,
  Tecnologia: 72,
  Podcasts: 56,
  IRL: 35
};

function render(counts = null) {
  grid.innerHTML = order.map(category => {
    const count = counts ? Number(counts[category] || 0) : referenceCounts[category];
    return `
      <a class="figma-category-card" href="categoria.html?categoria=${encodeURIComponent(category)}">
        <span class="figma-category-icon">${icons[category]}</span>
        <span class="figma-category-copy">
          <strong>${category}</strong>
          <small>${count.toLocaleString('pt-BR')} transmissões</small>
        </span>
        <span class="figma-category-arrow" aria-hidden="true">→</span>
      </a>
    `;
  }).join('');
}

render();

const liveQuery = query(collection(db, 'streams'), where('status', '==', 'live'));
const stop = onSnapshot(liveQuery, snapshot => {
  const counts = Object.fromEntries(order.map(category => [category, 0]));

  snapshot.docs.forEach(item => {
    const category = mainCategory(item.data().categoryId || '');
    if (category in counts) counts[category] += 1;
  });

  render(counts);
}, () => {
  // Mantém os números de referência do Figma caso a contagem em tempo real falhe.
});

window.addEventListener('pagehide', () => stop?.());
