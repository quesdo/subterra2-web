/* ============================================================
   actions.js — Barre d'actions contextuelle (boutons circulaires)
   + ligne de capacités du personnage actif.
   Le bouton "Fin du tour" est rendu statiquement dans index.html
   (#end-turn-btn) et juste câblé ici.
   ============================================================ */

import { canDoAction } from '../engine/game.js';
import { attachTooltips } from './tooltips.js';

/* Définition des actions de base. cost = PA (nombre) ou chaîne d'affichage.
   Coûts officiels (manuel p.10-11) : Courir et Creuser coûtent 2 PA,
   toutes les autres actions 1 PA. desc = texte d'aide au survol.
   img = icône SVG officielle (assets/images/actions/<id>.svg) si dispo. */
const ACTIONS = [
  { id: 'reveal',   icon: '🗺', img: 'reveal',  label: 'Révéler',       cost: 1, desc: "Piochez une tuile du Sac et placez-la connectée à votre tuile, dans l'orientation voulue." },
  { id: 'move',     icon: '🚶', img: 'move',    label: 'Se déplacer',   cost: 1, desc: "Déplacez votre Explorateur sur une tuile adjacente et connectée." },
  { id: 'explore',  icon: '🔦', label: 'Explorer',     cost: 1, desc: "Révélez une tuile ET y entrez immédiatement (plus rapide, plus risqué)." },
  { id: 'heal',     icon: '✚', label: 'Soigner',      cost: 1, desc: "Récupérez 1 PV, ou soignez un Explorateur sur votre tuile (+1 PV)." },
  { id: 'pickup',   icon: '✋', img: 'pickup',  label: 'Manier un objet', cost: 1, desc: "Ramassez, prenez, donnez ou déposez un objet (Clé/Artefact). Un seul objet par Explorateur." },
  { id: 'attack',   icon: '⚔', img: 'attack',   label: 'Attaquer',      cost: 1, desc: "Lancez le dé : sur 4+, éliminez un Gardien sur votre tuile." },
  { id: 'run',      icon: '🏃', label: 'Courir',       cost: 2, desc: "Réalisez jusqu'à 3 fois l'action Se déplacer." },
  { id: 'dig',      icon: '⛏', img: 'dig',      label: 'Creuser',       cost: 2, desc: "Enlevez un marqueur Éboulis de votre tuile ou d'une tuile adjacente connectée." },
];

/* Action "Se dépasser" (coût PV, pas PA) — stylée à part. */
const PUSH_ACTION = { id: 'push', icon: '💪', label: 'Se dépasser', cost: '−1PV', cls: 'push', desc: "1× par tour : perdez 1 PV pour gagner 1 PA supplémentaire." };
/* Action "Sortir" (gratuite, conditionnelle). */
const ESCAPE_ACTION = { id: 'escape', icon: '🚪', label: 'Sortir', cost: 0, cls: 'special', desc: "Quittez le Temple par la sortie. Sauvé, mais sans action ni capacité (lance encore le dé de Péril)." };
/* Action "Ramper" (à terre). */
const CRAWL_ACTION = { id: 'crawl', icon: '🦎', label: 'Ramper', cost: 1, desc: "À terre (0 PV) : seul déplacement possible d'une tuile. Le tour se termine ensuite." };

const ACTION_IMG_DIR = 'assets/images/actions';

/* Rend l'icône d'une action : image SVG officielle si dispo, sinon emoji. */
function actionIcon(a) {
  if (a.img) {
    return `<img class="ab-icon-img" src="${ACTION_IMG_DIR}/${a.img}.svg" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span class="ab-icon" style="display:none">${a.icon}</span>`;
  }
  return `<span class="ab-icon">${a.icon}</span>`;
}

/* Bouton circulaire pour une action. data-tip = info de survol (tooltip). */
function actionBtn(a, disabled) {
  const cls = a.cls ? ` ${a.cls}` : '';
  const cost = (typeof a.cost === 'number' && a.cost === 0) ? '' : a.cost;
  const tip = JSON.stringify({ title: a.label, cost: String(cost), desc: a.desc || '' })
    .replace(/"/g, '&quot;');
  return `<button class="action-btn${cls}" data-action="${a.id}" data-tip="${tip}" ${disabled ? 'disabled' : ''}>
    ${actionIcon(a)}
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
    btns = actionBtn(CRAWL_ACTION, !canDoAction(game, 'crawl'));
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
    endBtn.setAttribute('data-tip', '{"title":"Fin du tour","cost":"","desc":"Termine votre tour et lance le dé de Péril."}');
    endBtn.dataset.wired = '1';
  }

  // Ligne des capacités du personnage actif.
  renderAbilitiesRow(game, ui);

  // Active les tooltips sur les boutons d'action + capacités.
  attachTooltips(box);
  attachTooltips(document.getElementById('abilities-box') || box);
}

/* Rend les capacités du personnage actif (colonne gauche, sous le portrait). */
function renderAbilitiesRow(game, ui) {
  const box = document.getElementById('abilities-box');
  if (!box) return;
  const p = game.explorers[game.currentExplorerIdx];
  if (!p || p.state === 'down') { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="abilities-title">Capacités</div>' + p.abilities.map(a => {
    const costLabel = a.passive ? 'passive' : `${a.cost} PA`;
    const usesLabel = a.uses !== null ? ` · ${a.usesLeft}/${a.uses}` : '';
    const tip = JSON.stringify({ title: a.name, cost: costLabel + usesLabel, desc: a.desc })
      .replace(/"/g, '&quot;');
    const cls = a.passive ? ' passive' : '';
    const uses = a.uses !== null ? `<span class="ab-uses">${a.usesLeft}/${a.uses}</span>` : '';
    const costTag = a.passive
      ? `<em class="ab-passive-tag">passive</em>`
      : `<span class="ab-cost-tag">${a.cost} PA</span>`;
    return `<button class="ability-btn${cls}" data-ability="${a.id}" data-tip="${tip}">
      <span class="ab-name">${a.name}</span>${uses}${costTag}
    </button>`;
  }).join('');
  box.querySelectorAll('.ability-btn[data-ability]').forEach(btn => {
    btn.addEventListener('click', () => ui.onAbility(btn.dataset.ability));
  });
}
