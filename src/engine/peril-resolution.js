import { getActiveExplorer, getCell, damage, heal, log, removeAllGuardians } from './state.js';
import { getAdjacentConnectedCells, nearestCell, DIRS, DIR_DELTA } from './board.js';
import { rollDie } from './perils.js';
import { wakeNearestGuardian, activateAllGuardians } from './guardians.js';
import { onLavaPeril } from './volcano.js';
import { hasVigilanceOnTile, hasSurvivor } from './abilities.js';
import { triggerSpikes } from './actions.js';
import { spawnGuardian } from './state.js';

export function resolveCollapseWithRoll(state, roll) {
  const ruinsCells = [];
  for (const cell of state.board.cells.values()) {
    if (cell.type === 'ruines' && !cell.rubble && !cell.consolidated && cell.ruinsNum === roll) {
      ruinsCells.push(cell);
    }
  }
  for (const cell of ruinsCells) {
    cell.rubble = true;
    for (const e of state.explorers) {
      if (e.state === 'dead' || e.state === 'escaped') continue;
      if (e.x === cell.x && e.y === cell.y) {
        damage(state, e, 5, 'collapse');
      }
    }
    removeAllGuardians(state.guardians, cell);
    log(state, `Ruines ${roll} s'effondrent en (${cell.x}, ${cell.y}) (-5 PV)`);
  }
}

export function wakeNearestGuardianAt(state, x, y) {
  const result = nearestCell(
    state.board,
    x,
    y,
    (cell) => (cell.guardianAnchor || cell.type === 'gardien') && (!cell.guardians || cell.guardians.length === 0),
    { ignoreRubble: true },
  );
  if (!result) return null;

  const cell = getCell(state, result.x, result.y);
  if (!cell) return null;

  const guardian = spawnGuardian(state.guardians, cell);
  if (!guardian) return null;

  log(state, `Gardien réveillé en (${result.x}, ${result.y})`);
  return cell;
}

export function resolvePeril(state, perilFace) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { events: [] };

  const isDeadOrEscaped = explorer.state === 'dead' || explorer.state === 'escaped';
  const events = [];

  switch (perilFace) {
    case 'stumble': {
      if (isDeadOrEscaped) {
        events.push('stumble_no_effect');
        break;
      }
      if (hasSurvivor(explorer)) {
        heal(state, explorer, 1);
        log(state, `${explorer.name} regagne 1 PV (Survivante)`);
        events.push('survivor_heal');
      } else if (explorer.pushedThisTurn) {
        if (!explorer.shielded) {
          damage(state, explorer, 1, 'stumble');
          log(state, `${explorer.name} trébuche (-1 PV)`);
        }
        events.push('stumble');
      } else {
        events.push('stumble_no_effect');
      }
      break;
    }

    case 'lava': {
      if (!isDeadOrEscaped) {
        onLavaPeril(state);
      }
      events.push('lava');
      break;
    }

    case 'collapse': {
      if (isDeadOrEscaped) {
        events.push('collapse_no_effect');
        break;
      }
      const roll = rollDie();
      resolveCollapseWithRoll(state, roll);
      events.push('collapse');
      break;
    }

    case 'trap': {
      if (isDeadOrEscaped) {
        events.push('trap_no_effect');
        break;
      }
      const cell = getCell(state, explorer.x, explorer.y);
      if (!cell) break;

      // Spike trap on current tile
      if (cell.type === 'piege_pics' && !cell.consolidated) {
        if (!hasVigilanceOnTile(state, cell.x, cell.y)) {
          triggerSpikes(state, cell);
          events.push('spikes');
        }
      }

      // Dart traps: on current tile + adjacent connected tiles
      const affectedTiles = new Set();
      if (cell.type === 'piege_flechettes' && !cell.consolidated) {
        if (!hasVigilanceOnTile(state, cell.x, cell.y)) {
          affectedTiles.add(`${cell.x},${cell.y}`);
          for (const nb of getAdjacentConnectedCells(state.board, cell.x, cell.y)) {
            affectedTiles.add(`${nb.x},${nb.y}`);
          }
        }
      }
      // Also check adjacent tiles for dart traps
      for (const nb of getAdjacentConnectedCells(state.board, cell.x, cell.y)) {
        if (nb.type === 'piege_flechettes' && !nb.consolidated) {
          if (!hasVigilanceOnTile(state, nb.x, nb.y)) {
            affectedTiles.add(`${nb.x},${nb.y}`);
            for (const nb2 of getAdjacentConnectedCells(state.board, nb.x, nb.y)) {
              affectedTiles.add(`${nb2.x},${nb2.y}`);
            }
          }
        }
      }

      for (const key of affectedTiles) {
        const [tx, ty] = key.split(',').map(Number);
        for (const e of state.explorers) {
          if (e.state === 'dead' || e.state === 'escaped') continue;
          if (e.x === tx && e.y === ty) {
            if (!hasVigilanceOnTile(state, tx, ty)) {
              damage(state, e, 1, 'piège à fléchettes');
            }
          }
        }
      }
      if (affectedTiles.size > 0) {
        log(state, `Pièges à fléchettes déclenchés (${affectedTiles.size} tuiles affectées)`);
        events.push('darts');
      }
      break;
    }

    case 'wake': {
      let result;
      if (isDeadOrEscaped) {
        result = wakeNearestGuardianAt(state, 0, 0);
      } else {
        result = wakeNearestGuardian(state);
      }
      if (result) events.push('wake');
      else events.push('wake_no_pool');
      break;
    }

    case 'activate': {
      activateAllGuardians(state);
      events.push('activate');
      break;
    }
  }

  return { events };
}
