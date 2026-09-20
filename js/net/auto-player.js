/* ============================================================
   auto-player.js — IA basique pour les Explorateurs de joueurs
   déconnectés. L'hôte active cette IA quand un joueur se déconnecte.
   Stratégie : attaquer si Gardien adjacent, sinon BFS vers l'Entrée.
   ============================================================ */

import { currentPlayer, explorerCell, getMoveTargets,
         performAttack, performMove, performPush } from '../engine/game.js';
import { shortestPath } from '../engine/board.js';

/* Marque un Explorateur comme étant en mode auto. */
export function markAsAuto(explorer) {
  explorer.auto = true;
}

/* Vérifie si un Explorateur est en mode auto. */
export function isAuto(explorer) {
  return explorer.auto === true;
}

/* Décide de l'action à effectuer pour un Explorateur en mode auto.
   Retourne un message d'action { id, args } compatible avec host.js. */
export function decideAction(game, explorer) {
  const cell = explorerCell(game, explorer);
  if (!cell) return { id: 'endTurn', args: {} };

  if (game.ap <= 0) return { id: 'endTurn', args: {} };

  if (cell.guardians.length > 0 && game.ap >= 1) {
    return { id: 'attack', args: {} };
  }

  const targets = getMoveTargets(game, explorer);
  if (targets.length > 0 && game.ap >= 1) {
    const entry = [...game.board.cells.values()].find(c => c.isEntry && c.crossroad);
    if (entry) {
      const path = shortestPath(game.board.cells, cell, entry);
      if (path && path.length >= 2) {
        const nextCell = path[1];
        const target = targets.find(t => t.cell.x === nextCell.x && t.cell.y === nextCell.y);
        if (target) {
          return { id: 'move', args: { cellId: nextCell.x + ',' + nextCell.y } };
        }
      }
    }
    const first = targets[0];
    return { id: 'move', args: { cellId: first.cell.x + ',' + first.cell.y } };
  }

  return { id: 'endTurn', args: {} };
}

/* Exécute un tour complet pour un Explorateur auto.
   Utilise decideAction en boucle jusqu'à épuisement des PA,
   puis termine le tour. */
export function playAutoTurn(game, explorer) {
  let safety = 0;
  while (game.ap > 0 && safety < 10) {
    safety++;
    const decision = decideAction(game, explorer);
    if (decision.id === 'endTurn') break;
    if (decision.id === 'attack') {
      performAttack(game);
    } else if (decision.id === 'move' && decision.args.cellId) {
      const cell = game.board.cells.get(decision.args.cellId);
      if (cell) performMove(game, cell);
    }
  }
}
