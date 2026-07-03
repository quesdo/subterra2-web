/* ============================================================
   multiplayer.js — Orchestrateur du multijoueur
   Détermine le mode (local/host/peer) et wrappe les actions.
   ============================================================ */

import { net, broadcast, sendToHost } from './peer.js';
import { serializeGame, deserializeGame } from './serialize.js';

/* Indique si on est en mode multijoueur en ligne. */
export function isOnline() {
  return net.mode === 'host' || net.mode === 'peer';
}

export function isHost() {
  return net.mode === 'host';
}

export function isPeer() {
  return net.mode === 'peer';
}

/* === DIFFUSION DE L'ÉTAT (côté hôte) === */
export function broadcastGameState(game) {
  if (net.mode !== 'host') return;
  const state = serializeGame(game);
  broadcast({ type: 'gameState', state });
}

/* === APPLICATION D'UN ÉTAT REÇU (côté pair) === */
export function applyRemoteState(state, ui, fullRender) {
  if (net.mode !== 'peer') return;
  ui.game = deserializeGame(state);
  fullRender();
}

/* === ENVOI D'UNE ACTION (côté pair → hôte) === */
/* Envoie une demande d'action à l'hôte. L'hôte l'exécutera et diffusera le nouvel état. */
export function sendAction(actionId, args = {}) {
  if (net.mode !== 'peer') return;
  sendToHost({ type: 'action', id: actionId, args, playerName: net.playerName });
}

/* === VÉRIFICATION : est-ce mon tour ? === */
/* Un pair ne peut agir que si c'est le tour de son explorateur.
   L'attribution explorateur↔pair est stockée dans game.playerAssignments. */
export function isMyTurn(game, myExplorerIdx) {
  if (net.mode === 'local') return true;
  if (net.mode === 'host') return true;
  // Côté pair : vérifier l'index de l'explorateur courant
  return game.currentExplorerIdx === myExplorerIdx;
}

/* === ENREGISTREMENT DES FONCTIONS GLOBALES === */
/* Ces fonctions sont appelées par lobby.js via window.__applyRemoteState / __handleRemoteAction.
   Elles sont définies ici pour garder la logique réseau centralisée, mais branchées
   depuis main.js au démarrage. */
export function setupGlobalHandlers(opts) {
  // opts = { applyRemoteState: (state) => void, handleRemoteAction: (msg, peerId) => void }
  window.__applyRemoteState = opts.applyRemoteState;
  window.__handleRemoteAction = opts.handleRemoteAction;
}

/* === RÉINITIALIALISATION === */
export function resetMultiplayer() {
  import('./peer.js').then(({ disconnect }) => disconnect());
}
