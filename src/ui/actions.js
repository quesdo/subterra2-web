/* actions.js — Action bar: available actions, abilities, end turn */
import { EXPLORERS, ABILITIES } from '../engine/explorers.js';
import { canDoAction } from '../engine/actions.js';
import { canUseAbility } from '../engine/abilities.js';
import { getMoveTargets, getRevealTargets, getDigTargets } from '../engine/actions.js';

const ACTION_ICONS = {
  reveal:  '<img src="assets/images/actions/reveal.png" alt="" class="act-icon">',
  move:    '<img src="assets/images/actions/move.png" alt="" class="act-icon">',
  explore: '<img src="assets/images/actions/reveal.png" alt="" class="act-icon">',
  dig:     '<img src="assets/images/actions/dig.png" alt="" class="act-icon">',
  attack:  '<img src="assets/images/actions/attack.png" alt="" class="act-icon">',
  manage:  '<img src="assets/images/actions/key.png" alt="" class="act-icon">',
  run:     '<img src="assets/images/actions/move.png" alt="" class="act-icon">',
};

const ACTION_DEFS = [
  { id: 'reveal',  label: 'Révéler',    cost: 1 },
  { id: 'move',    label: 'Se déplacer', cost: 1 },
  { id: 'explore', label: 'Explorer',    cost: 1 },
  { id: 'heal',   label: 'Soigner',     cost: 1 },
  { id: 'attack', label: 'Attaquer',     cost: 1 },
  { id: 'dig',    label: 'Creuser',      cost: 2 },
  { id: 'run',    label: 'Courir',       cost: 2 },
  { id: 'manage', label: 'Manier objet', cost: 1 },
  { id: 'push',   label: 'Se dépasser',  cost: 0, special: true },
];

const ACTION_LABELS = {
  reveal: 'Révéler',
  move: 'Se déplacer',
  explore: 'Explorer',
  heal: 'Soigner',
  attack: 'Attaquer',
  dig: 'Creuser',
  run: 'Courir',
  manage: 'Manier un objet',
  push: 'Se dépasser',
  crawl: 'Ramper',
  pickup: 'Ramasser',
  drop: 'Déposer',
  place_key: 'Poser clé',
  escape: 'Sortir',
};

export function renderActionButtons(state, ui) {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const active = state.explorers[state.currentExplorerIdx];
  if (!active) return;

  const def = EXPLORERS.find(e => e.id === active.id);
  bar.innerHTML = '';

  if (state.phase === 'perilPhase' || state.phase === 'perilRoll') {
    const btn = document.createElement('button');
    btn.className = 'act-btn peril';
    btn.textContent = '🎲 Lancer le dé de Péril';
    btn.addEventListener('click', () => ui.onRollPeril());
    bar.appendChild(btn);
    return;
  }

  if (active.state === 'down') {
    const crawlBtn = document.createElement('button');
    crawlBtn.className = 'act-btn';
    crawlBtn.textContent = '🧎 Ramper';
    crawlBtn.disabled = false;
    crawlBtn.addEventListener('click', () => ui.onAction('crawl'));
    bar.appendChild(crawlBtn);

    addEndTurnButton(bar, ui);
    return;
  }

  for (const action of ACTION_DEFS) {
    const btn = document.createElement('button');
    btn.className = 'act-btn' + (action.special ? ' special' : '');
    btn.innerHTML = `${ACTION_ICONS[action.id] || ''} ${action.label} (${action.cost} PA)`;
    btn.disabled = !canDoAction(state, action.id);
    btn.addEventListener('click', () => ui.onAction(action.id));
    bar.appendChild(btn);
  }

  const explorer = state.explorers[state.currentExplorerIdx];
  const cell = state.board.cells.get(`${explorer.x},${explorer.y}`);
  if (cell && cell.isEntry && cell.exitDir === 'N') {
    const escBtn = document.createElement('button');
    escBtn.className = 'act-btn end-turn';
    escBtn.textContent = explorer.item === 'artifact' ? '🏆 S\'échapper avec l\'Artefact !' : '🚪 Sortir du temple';
    escBtn.addEventListener('click', () => ui.onAction('escape'));
    bar.appendChild(escBtn);
  }

  if (def) {
    for (const abId of def.abilities) {
      const ab = ABILITIES[abId];
      if (!ab || ab.passive) continue;
      const btn = document.createElement('button');
      btn.className = 'act-btn ability';
      const usesLeft = active.abilityUsesLeft?.[abId];
      const usesText = ab.uses != null ? ` (${usesLeft}/${ab.uses})` : '';
      const costLabel = ab.costType === 'hp' ? `${ab.cost} PV` : `${ab.cost} PA`;
      btn.textContent = `✦ ${ab.name} (${costLabel})${usesText}`;
      btn.disabled = !canUseAbility(state, abId);
      btn.title = ab.description;
      btn.addEventListener('click', () => ui.onAbility(abId));
      bar.appendChild(btn);
    }
  }

  addEndTurnButton(bar, ui);
}

function addEndTurnButton(bar, ui) {
  const endBtn = document.createElement('button');
  endBtn.className = 'act-btn end-turn';
  endBtn.textContent = '🎲 Fin du tour';
  endBtn.addEventListener('click', () => ui.onAction('endTurn'));
  bar.appendChild(endBtn);
}
