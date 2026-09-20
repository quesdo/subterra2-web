/* ============================================================
   client.js — Logique client (côté pair)
   Centralise l'envoi d'actions à l'hôte et la réception de l'état.
   ============================================================ */

import { sendToHost } from './peer.js';
import { deserializeGame } from './serialize.js';

/* L'ID du joueur local, stocké en localStorage pour la reconnexion. */
const STORAGE_KEY = 'subterra2_player_id';

/* Génère ou récupère un playerId persistant. */
export function getPlayerId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = 'p-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/* Envoie une action à l'hôte. */
export function sendActionToHost(actionId, args = {}) {
  sendToHost({ type: 'action', id: actionId, args });
}

/* Envoie une capacité à l'hôte. */
export function sendAbilityToHost(abilityId, args = {}) {
  sendToHost({ type: 'action', id: 'ability', args: { abilityId, ...args } });
}

/* Envoie une demande de fin de tour. */
export function sendEndTurnToHost() {
  sendToHost({ type: 'action', id: 'endTurn', args: {} });
}

/* Envoie une décision du Chef d'Expédition. */
export function sendChefDecision(decisionId, choice) {
  sendToHost({ type: 'chefDecision', decisionId, choice });
}

/* Envoie une demande de reroll (Aventurière). */
export function sendRerollRequest(dieId) {
  sendToHost({ type: 'rerollRequest', dieId });
}

/* Envoie un choix de tuile (Érudite). */
export function sendTileChoice(tileId) {
  sendToHost({ type: 'tileChoice', tileId });
}

/* Envoie une demande de reconnexion. */
export function sendReconnect(roomCode, playerId, name) {
  sendToHost({ type: 'reconnect', roomCode, playerId, name });
}

/* Applique un état reçu de l'hôte. */
export function applyState(serializedState, ui, fullRender) {
  ui.game = deserializeGame(serializedState);
  fullRender();
}

/* Vérifie si c'est le tour d'un Explorateur contrôlé par ce client. */
export function isMyTurn(game, playerId) {
  if (!game.playerAssignments) return false;
  const assignment = game.playerAssignments.find(a => a.playerId === playerId);
  if (!assignment) return false;
  const currentExplorer = game.explorers[game.currentExplorerIdx];
  return assignment.explorerIds.includes(currentExplorer.defId);
}

/* Filtre les actions autorisées pour ce client.
   Retourne true si l'action peut être envoyée à l'hôte. */
export function canClientAct(game, playerId) {
  return isMyTurn(game, playerId) && game.phase === 'explorerTurn';
}
