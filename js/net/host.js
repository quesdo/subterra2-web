/* ============================================================
   host.js — Logique hôte-authoritaire
   Valide les actions reçues des clients, exécute sur le moteur,
   et retourne le résultat. L'hôte est le seul à exécuter le moteur.
   ============================================================ */

import {
  canDoAction, currentPlayer, explorerCell,
  performReveal, performMove, performExplore, performHeal, performPickup,
  performDropItem, performAttack, performDig, performPush, performCrawl,
  performEscape, useAbility, endExplorerTurn, resolvePeril,
  getMoveTargets, getOpenEdges,
} from '../engine/game.js';
import { serializeGame } from './serialize.js';

/* Vérifie qu'un playerId contrôle l'explorateur courant.
   playerAssignments = [{ playerId, explorerIds: [defId, ...] }]
   L'explorateur courant est identifié par son defId (ex: 'scholar'). */
function controlsCurrentExplorer(game, playerAssignments, playerId) {
  const explorer = currentPlayer(game);
  const assignment = playerAssignments.find(a => a.playerId === playerId);
  if (!assignment) return false;
  return assignment.explorerIds.includes(explorer.defId);
}

/* Valide une action reçue d'un client.
   Retourne { valid: true } ou { valid: false, reason: string }. */
export function validateAction(game, playerId, actionMsg) {
  const { id, args = {} } = actionMsg;

  if (!game.playerAssignments || !game.playerAssignments.find(a => a.playerId === playerId)) {
    return { valid: false, reason: 'Joueur inconnu' };
  }

  if (game.phase !== 'explorerTurn' && id !== 'endTurn') {
    return { valid: false, reason: 'Pas en phase d\u2019action (phase: ' + game.phase + ')' };
  }

  if (!controlsCurrentExplorer(game, game.playerAssignments, playerId)) {
    return { valid: false, reason: 'Ce n\u2019est pas le tour de votre Explorateur' };
  }

  if (id === 'endTurn') {
    return { valid: true };
  }

  const p = currentPlayer(game);
  if (p.state !== 'active' && id !== 'crawl') {
    return { valid: false, reason: 'Explorateur \u00e0 terre, action impossible' };
  }

  if (!canDoAction(game, id)) {
    return { valid: false, reason: 'Action impossible (PA insuffisant ou action non disponible)' };
  }

  if (id === 'move' || id === 'crawl' || id === 'dig') {
    if (!args.cellId || !game.board.cells.has(args.cellId)) {
      return { valid: false, reason: 'Case cible invalide' };
    }
  }

  if (id === 'reveal' || id === 'explore') {
    if (!args.cellId || !game.board.cells.has(args.cellId)) {
      return { valid: false, reason: 'Case source invalide' };
    }
  }

  return { valid: true };
}

/* Exécute une action sur l\u2019\u00e9tat du jeu (c\u00f4t\u00e9 h\u00f4te).
   L'action doit d\u00e9j\u00e0 avoir \u00e9t\u00e9 valid\u00e9e par validateAction. */
export function executeAction(game, actionMsg) {
  const { id, args = {} } = actionMsg;

  switch (id) {
    case 'reveal': {
      const cell = game.board.cells.get(args.cellId);
      return performReveal(game, cell, args.dir, args.rotation || null);
    }
    case 'move': {
      const cell = game.board.cells.get(args.cellId);
      return performMove(game, cell, args.costAP ?? 1);
    }
    case 'explore': {
      const cell = game.board.cells.get(args.cellId);
      return performExplore(game, cell, args.dir, args.rotation || null);
    }
    case 'heal': {
      const target = args.targetId
        ? game.explorers.find(e => e.id === args.targetId)
        : currentPlayer(game);
      return performHeal(game, target || currentPlayer(game));
    }
    case 'pickup':
      return performPickup(game);
    case 'dropItem':
      return performDropItem(game);
    case 'attack':
      return performAttack(game);
    case 'dig': {
      const cell = game.board.cells.get(args.cellId);
      return performDig(game, cell);
    }
    case 'push':
      return performPush(game);
    case 'crawl': {
      const cell = game.board.cells.get(args.cellId);
      return performCrawl(game, cell);
    }
    case 'escape':
      return performEscape(game);
    case 'ability':
      return useAbility(game, args.abilityId, args.target);
    case 'endTurn':
      endExplorerTurn(game);
      return true;
    default:
      return false;
  }
}

/* Traite une action reçue d\u2019un client : valide puis ex\u00e9cute.
   Retourne { accepted: boolean, reason?: string, state?: serialized }. */
export function handleClientAction(game, playerId, actionMsg) {
  const validation = validateAction(game, playerId, actionMsg);
  if (!validation.valid) {
    return { accepted: false, reason: validation.reason };
  }
  executeAction(game, actionMsg);
  return { accepted: true, state: serializeGame(game) };
}
