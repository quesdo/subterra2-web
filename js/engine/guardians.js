/* ============================================================
   guardians.js — IA des Gardiens (Légion Cendrée)
   Activation : 1.Attaquer 2.Se déplacer vers + proche 3.Creuser
   ============================================================ */

import { DIRS, OPP, DELTA } from '../data/tiles.js';
import { areConnected, neighbor, reachableNeighbors, bfs, nearestCell, shortestPath } from './board.js';

/* Crée une réserve de 5 Gardiens. */
export function createGuardianPool() {
  return { available: 5, inPlay: 0 };
}

/* Place un Gardien sur une case (depuis la réserve). */
export function spawnGuardian(pool, cell) {
  if (pool.available <= 0) return false;
  pool.available--;
  pool.inPlay++;
  cell.guardians.push({ id: 'G' + (5 - pool.available) });
  return true;
}

/* Élimine un Gardien (retour à la réserve). */
export function removeGuardian(pool, cell) {
  if (cell.guardians.length === 0) return false;
  cell.guardians.pop();
  pool.available++;
  pool.inPlay--;
  return true;
}

/* Élimine tous les Gardiens d'une case. */
export function removeAllGuardians(pool, cell) {
  const n = cell.guardians.length;
  cell.guardians = [];
  pool.available += n;
  pool.inPlay -= n;
  return n;
}

/* Trouve la case d'ancrage Gardien (type 'guardian' ou Latérales) la plus
   proche d'un Explorateur, et y place un Gardien. */
export function wakeNearestGuardian(cells, pool, fromCell) {
  if (pool.available <= 0) return null;
  // Ancrages = cases de type 'guardian' OU Latérales avec anchor
  const anchors = [...cells.values()].filter(c =>
    (c.type === 'guardian' || c.guardianAnchor) && !c.flipped
  );
  if (anchors.length === 0) return null;
  const nearest = nearestCell(cells, fromCell, anchors, { ignoreRubble: false });
  if (!nearest) return null;
  spawnGuardian(pool, nearest.cell);
  return nearest.cell;
}

/* Active tous les Gardiens une fois.
   Chaque Gardien réalise la 1ère action disponible :
   1. Attaquer (si Explorateur actif sur sa tuile)
   2. Se déplacer vers l'Explorateur actif le plus proche
   3. Creuser un Éboulis adjacent
   Retourne la liste des événements produits. */
export function activateAllGuardians(state) {
  const { board, explorers, pool } = state;
  const events = [];
  const cells = board.cells;

  // Pour chaque case contenant des Gardiens
  const guardianCells = [...cells.values()].filter(c => c.guardians.length > 0 && !c.flipped);

  for (const cell of guardianCells) {
    // Copier la liste car elle peut changer pendant l'activation
    const guardianCount = cell.guardians.length;
    for (let i = 0; i < guardianCount; i++) {
      const ev = activateOneGuardian(state, cell);
      if (ev) events.push(ev);
      // Si le gardien a bougé, on continue avec la case suivante
      // (les gardiens restants sur la case d'origine seront traités)
    }
  }
  return events;
}

function activateOneGuardian(state, cell) {
  const { board, explorers, pool } = state;
  const cells = board.cells;

  // Cibles = Explorateurs actifs (non à terre, non échappés, non morts)
  const activeExplorers = explorers.filter(e => e.state === 'active');
  if (activeExplorers.length === 0) return null;

  // 1. ATTAQUER : un Explorateur actif sur la même tuile ?
  // Explorateurs actifs sur la même tuile (comparaison par coordonnées)
  const here = activeExplorers.filter(e => sameCell(e, cell));
  if (here.length > 0) {
    // Le Chef d'Expédition choisit qui subit (ici : le moins de PV, ou aléatoire)
    const target = pickAttackTarget(here, state);
    if (target) {
      damageExplorer(state, target, 1, 'un Gardien');
      return { type: 'attack', guardian: cell.id, target: target.id };
    }
  }

  // 2. SE DÉPLACER : vers l'Explorateur actif le plus proche
  const targetCells = activeExplorers.map(e => getCellById(cells, e.position)).filter(Boolean);
  const nearest = nearestCell(cells, cell, targetCells, { ignoreRubble: false });
  if (nearest && nearest.dist > 0) {
    // Trouver le prochain pas vers la cible
    const path = shortestPath(cells, cell, nearest.cell, { ignoreRubble: false });
    if (path && path.length >= 2) {
      const nextStep = path[1];
      // Le gardien peut-il s'y déplacer ? (connecté, pas d'Éboulis bloquant le passage)
      // Les gardiens ne traversent pas les Éboulis (ils creusent à l'étape 3)
      const connected = areConnected(cells, cell, nextStep);
      if (connected && !nextStep.rubble && !nextStep.flipped) {
        // Déplacer un gardien
        moveGuardian(pool, cell, nextStep);
        // Fuite : si un Explorateur quitte une tuile avec gardien, il perd 1 PV/gardien.
        // (La fuite est gérée au moment du déplacement de l'Explorateur, pas ici.)
        return { type: 'move', guardian: cell.id, to: nextStep.id };
      }
    }
  }

  // 3. CREUSER : enlever un Éboulis adjacent
  for (const dir of DIRS) {
    const nb = neighbor(cells, cell, dir);
    if (nb && nb.rubble && areConnected(cells, cell, nb)) {
      nb.rubble = false;
      return { type: 'dig', guardian: cell.id, tile: nb.id };
    }
  }

  return null; // aucune action possible
}

function moveGuardian(pool, from, to) {
  if (from.guardians.length === 0) return;
  const g = from.guardians.pop();
  to.guardians.push(g);
}

/* Dégâts à un Explorateur (gère Bouclier, à terre, mort).
   Écrit directement dans state.logEntries (pas d'import circulaire avec game.js). */
function damageExplorer(state, explorer, amount, source) {
  if (explorer.shielded) return; // protégé
  explorer.hp = Math.max(0, explorer.hp - amount);
  pushLog(state, `💀 ${explorer.name} perd ${amount} PV (${source}).`, 'bad');
  if (explorer.hp <= 0 && explorer.state === 'active') {
    explorer.state = 'down';
    pushLog(state, `⬇️ ${explorer.name} s'effondre, à terre !`, 'bad');
  }
}

/* Helper de log local (évite l'import circulaire avec game.js). */
function pushLog(state, msg, type = '') {
  if (state.logEntries) {
    state.logEntries.push({ turn: state.turn || 0, msg, type });
  }
}

function pickAttackTarget(candidates, state) {
  // Le Chef d'Expédition décide ; par défaut, le moins blessé pour répartir,
  // ou aléatoire. Ici : aléatoire parmi les actifs présents.
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function sameCell(explorer, cell) {
  return explorer.x === cell.x && explorer.y === cell.y;
}
function getCellById(cells, positionKey) {
  // e.position est la clé de coordonnées "x,y" -> lookup direct dans la map
  return cells.get(positionKey);
}
