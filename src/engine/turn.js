import { getActiveExplorer, log } from './state.js';
import { activateAllGuardiansWithLog, resetActivationFlags } from './guardians.js';
import { advanceEruption, spreadLava } from './volcano.js';
import { checkEndConditions } from './endgame.js';

export function getTurnOrder(state) {
  const order = [];
  const start = state.expeditionLeaderIdx;
  for (let i = 0; i < state.explorers.length; i++) {
    order.push((start + i) % state.explorers.length);
  }
  return order;
}

export function startExplorerTurn(state) {
  const explorer = state.explorers[state.currentExplorerIdx];

  if (explorer.shielded) {
    explorer.shielded = false;
    log(state, `Bouclier de ${explorer.name} retiré`);
  }

  for (const abId of Object.keys(explorer.abilityCooldown || {})) {
    if (explorer.abilityCooldown[abId] > 0) {
      explorer.abilityCooldown[abId]--;
    }
  }

  state.ap = 2;
  explorer.pushedThisTurn = false;

  if (explorer.state === 'dead' || explorer.state === 'escaped') {
    state.phase = 'perilPhase';
    log(state, `${explorer.name} est ${explorer.state === 'dead' ? 'mort' : 'sorti'} — lance le dé de Péril uniquement`);
    return;
  }

  state.phase = 'explorerTurn';

  if (explorer.state === 'down') {
    log(state, `${explorer.name} est à terre — peut seulement ramper`);
  }
}

export function endExplorerTurn(state) {
  state.processedPlayers++;

  if (state.processedPlayers >= state.explorers.length) {
    endGameTurn(state);
    return;
  }

  state.currentExplorerIdx = (state.currentExplorerIdx + 1) % state.explorers.length;
  startExplorerTurn(state);
}

export function endGameTurn(state) {
  for (let i = 0; i < 2; i++) {
    activateAllGuardiansWithLog(state);
  }
  log(state, `Gardiens activés 2×`);

  advanceEruption(state);
  log(state, `Marqueur Éruption: ${state.volcano.position}`);

  if (state.volcano.erupted) {
    spreadLava(state);
    if (state.volcano.cursed) {
      spreadLava(state);
    }
  }

  state.turn++;
  state.processedPlayers = 0;
  state.currentExplorerIdx = state.expeditionLeaderIdx;
  checkEndConditions(state);

  if (!state.winner) {
    startExplorerTurn(state);
  }
}
