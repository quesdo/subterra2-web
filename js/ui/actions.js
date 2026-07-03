/* ============================================================
   actions.js — Barre d'actions contextuelle
   ============================================================ */

import { canDoAction } from '../engine/game.js';

/* Définition des actions de base. */
const ACTIONS = [
  { id: 'reveal',   icon: '🗺', label: 'Révéler',  cost: 1 },
  { id: 'move',     icon: '🚶', label: 'Se déplacer', cost: 1 },
  { id: 'explore',  icon: '🔦', label: 'Explorer', cost: 1 },
  { id: 'heal',     icon: '✚',  label: 'Soigner',  cost: 1 },
  { id: 'pickup',   icon: '✋', label: 'Ramasser', cost: 1 },
  { id: 'attack',   icon: '⚔', label: 'Attaquer', cost: 1 },
  { id: 'run',      icon: '🏃', label: 'Courir',   cost: 1 },
  { id: 'dig',      icon: '⛏', label: 'Creuser',  cost: 1 },
  { id: 'push',     icon: '💪', label: 'Se dépasser', cost: '−1 PV' },
  { id: 'escape',   icon: '🚪', label: 'Sortir',   cost: 0 },
];

export function renderActionButtons(game, ui) {
  const box = document.getElementById('action-buttons');
  const p = game.explorers[game.currentExplorerIdx];
  let btns = '';

  // Si à terre : seule action = Ramper
  if (p.state === 'down') {
    btns = `<button class="action-btn" data-action="crawl" ${canDoAction(game,'crawl')?'':'disabled'}>
      <span class="ab-icon">🦎</span><span class="ab-label">Ramper</span>
    </button>`;
  } else {
    btns = ACTIONS.map(a => {
      const ok = canDoAction(game, a.id);
      return `<button class="action-btn" data-action="${a.id}" ${ok?'':'disabled'}>
        <span class="ab-icon">${a.icon}</span>
        <span class="ab-label">${a.label}</span>
        <span class="ab-cost">${a.cost}</span>
      </button>`;
    }).join('');
  }

  // Bouton terminer le tour (toujours présent)
  btns += `<button class="action-btn" data-action="endTurn" style="margin-left:auto">
    <span class="ab-icon">🎲</span><span class="ab-label">Lancer le dé de Péril</span>
  </button>`;

  box.innerHTML = btns;
  box.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => ui.onAction(btn.dataset.action));
  });
}
