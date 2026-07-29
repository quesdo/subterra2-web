/* ============================================================
   actions.js — Barre d'actions contextuelle (boutons circulaires)
   + ligne de capacités du personnage actif.
   Le bouton "Fin du tour" est rendu statiquement dans index.html
   (#end-turn-btn) et juste câblé ici.
   ============================================================ */

import { canDoAction } from '../engine/game.js';

/* Définition des actions de base. cost = PA (nombre) ou chaîne d'affichage.
   Coûts officiels (manuel p.10-11) : Courir et Creuser coûtent 2 PA,
   toutes les autres actions 1 PA. */
const ACTIONS = [
  { id: 'reveal',   icon: '🗺', label: 'Révéler',     cost: 1 },
  { id: 'move',     icon: '🚶', label: 'Se déplacer', cost: 1 },
  { id: 'explore',  icon: '🔦', label: 'Explorer',     cost: 1 },
  { id: 'heal',     icon: '✚',  label: 'Soigner',      cost: 1 },
  { id: 'pickup',   icon: '✋', label: 'Ramasser',     cost: 1 },
  { id: 'attack',   icon: '⚔', label: 'Attaquer',     cost: 1 },
  { id: 'run',      icon: '🏃', label: 'Courir',       cost: 2 },
  { id: 'dig',      icon: '⛏', label: 'Creuser',      cost: 2 },
];

/* Action "Se dépasser" (coût PV, pas PA) — stylée à part. */
const PUSH_ACTION = { id: 'push', icon: '💪', label: 'Se dépasser', cost: '−1PV', cls: 'push' };
/* Action "Sortir" (gratuite, conditionnelle). */
const ESCAPE_ACTION = { id: 'escape', icon: '🚪', label: 'Sortir', cost: 0, cls: 'special' };

/* Bouton circulaire pour une action. */
function actionBtn(a, disabled) {
  const cls = a.cls ? ` ${a.cls}` : '';
  const cost = (typeof a.cost === 'number' && a.cost === 0) ? '' : a.cost;
  return `<button class="action-btn${cls}" data-action="${a.id}" title="${a.label}${cost !== '' ? ` (${cost})` : ''}" ${disabled ? 'disabled' : ''}>
    <span class="ab-icon">${a.icon}</span>
    ${cost !== '' ? `<span class="ab-cost">${cost}</span>` : ''}
    <span class="ab-label">${a.label}</span>
  </button>`;
}

/* Rend les boutons d'action + la ligne de capacités. */
export function renderActionButtons(game, ui) {
  const box = document.getElementById('action-buttons');
  const p = game.explorers[game.currentExplorerIdx];
  let btns = '';

  if (p.state === 'down') {
    // À terre : seule action Ramper
    btns = actionBtn(
      { id: 'crawl', icon: '🦎', label: 'Ramper', cost: 1 },
      !canDoAction(game, 'crawl')
    );
  } else {
    btns = ACTIONS.map(a => actionBtn(a, !canDoAction(game, a.id))).join('');
    btns += actionBtn(PUSH_ACTION, !canDoAction(game, 'push'));
    btns += actionBtn(ESCAPE_ACTION, !canDoAction(game, 'escape'));
  }
  box.innerHTML = btns;

  box.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => ui.onAction(btn.dataset.action));
  });

  // Câblage du bouton "Fin du tour" statique (#end-turn-btn).
  // On ne recâble qu'une seule fois (flag dataset) pour préserver l'état
  // display:none géré par hideEndTurnButton() pendant la phase peril.
  const endBtn = document.getElementById('end-turn-btn');
  if (endBtn && !endBtn.dataset.wired) {
    endBtn.addEventListener('click', () => ui.onAction('endTurn'));
    endBtn.setAttribute('data-action', 'endTurn');
    endBtn.dataset.wired = '1';
  }

  // Ligne des capacités du personnage actif.
  renderAbilitiesRow(game, ui);
}

/* Rend les capacités du personnage actif (colonne gauche, sous le portrait). */
function renderAbilitiesRow(game, ui) {
  const box = document.getElementById('abilities-box');
  if (!box) return;
  const p = game.explorers[game.currentExplorerIdx];
  if (!p || p.state === 'down') { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="abilities-title">Capacités</div>' + p.abilities.map(a => {
    if (a.passive) {
      return `<button class="ability-btn passive" title="${a.desc} (passive)">
        <span class="ab-name">${a.name}</span>
        <em class="ab-passive-tag">passive</em>
      </button>`;
    }
    const uses = a.uses !== null ? `<span class="ab-uses">${a.usesLeft}/${a.uses}</span>` : '';
    return `<button class="ability-btn" data-ability="${a.id}" title="${a.desc}">
      <span class="ab-name">${a.name}</span>${uses}
      <span class="ab-cost-tag">${a.cost} PA</span>
    </button>`;
  }).join('');
  box.querySelectorAll('.ability-btn[data-ability]').forEach(btn => {
    btn.addEventListener('click', () => ui.onAbility(btn.dataset.ability));
  });
}
