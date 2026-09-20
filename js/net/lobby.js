/* ============================================================
   lobby.js — Logique du lobby (attribution Explorateurs)
   Fonctions pures testables sans navigateur.
   L'UI du lobby est dans js/ui/lobby.js.
   ============================================================ */

import { EXPLORERS } from '../data/explorers.js';

const VALID_EXPLORER_IDS = new Set(EXPLORERS.map(e => e.id));

/* Valide l'attribution des Explorateurs aux joueurs.
   assignment = { playerId: [explorerDefId, ...], ... }
   players = [{ playerId, name }, ...]
   Retourne { valid: true } ou { valid: false, reason: string }. */
export function validateAttribution(assignment, players) {
  const allExplorerIds = [];
  for (const player of players) {
    const ids = assignment[player.playerId] || [];
    allExplorerIds.push(...ids);
  }

  if (allExplorerIds.length < 3) {
    return { valid: false, reason: 'Minimum 3 Explorateurs requis' };
  }

  if (allExplorerIds.length > 6) {
    return { valid: false, reason: 'Maximum 6 Explorateurs autorisés' };
  }

  for (const player of players) {
    const ids = assignment[player.playerId] || [];
    if (ids.length === 0) {
      return { valid: false, reason: 'Chaque joueur doit avoir au moins 1 Explorateur' };
    }
  }

  const seen = new Set();
  for (const id of allExplorerIds) {
    if (!VALID_EXPLORER_IDS.has(id)) {
      return { valid: false, reason: 'Explorateur inconnu: ' + id };
    }
    if (seen.has(id)) {
      return { valid: false, reason: 'Doublon: ' + id + ' est déjà attribué' };
    }
    seen.add(id);
  }

  return { valid: true };
}

/* Construit le tableau d'attribution pour le state de jeu.
   assignment = { playerId: [explorerDefId, ...] }
   players = [{ playerId, name }, ...]
   Retourne [{ playerId, explorerIds: [...] }, ...] */
export function buildPlayerAssignments(assignment, players) {
  return players.map(player => ({
    playerId: player.playerId,
    explorerIds: [...(assignment[player.playerId] || [])],
  }));
}
