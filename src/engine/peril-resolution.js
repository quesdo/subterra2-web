import { getActiveExplorer, getCell, damage, heal, log, removeAllGuardians } from './state.js';
import { getAdjacentConnectedCells, DIRS, DIR_DELTA } from './board.js';
import { rollDie } from './perils.js';
import { wakeNearestGuardian, activateAllGuardians } from './guardians.js';
import { onLavaPeril } from './volcano.js';
import { hasVigilanceOnTile, hasSurvivor } from './abilities.js';
import { triggerSpikes, triggerDarts } from './actions.js';

export function resolvePeril(state, perilFace) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return { events: [] };

  const events = [];

  switch (perilFace) {
    case 'stumble': {
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
      onLavaPeril(state);
      events.push('lava');
      break;
    }

    case 'collapse': {
      const roll = rollDie();
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
            if (!explorer.shielded) {
              damage(state, e, 5, 'collapse');
            }
          }
        }
        removeAllGuardians(state.guardians, cell);
        log(state, `Ruines ${roll} s'effondrent en (${cell.x}, ${cell.y}) (-5 PV)`);
      }
      events.push('collapse');
      break;
    }

    case 'trap': {
      const cell = getCell(state, explorer.x, explorer.y);
      if (cell) {
        if (cell.type === 'spikes' && !cell.consolidated) {
          if (!hasVigilanceOnTile(state, cell.x, cell.y)) {
            triggerSpikes(state, cell);
            events.push('spikes');
          }
        }
        if (cell.type === 'darts' && !cell.consolidated) {
          if (!hasVigilanceOnTile(state, cell.x, cell.y)) {
            triggerDarts(state, cell);
            events.push('darts');
          }
        }
        for (const nb of getAdjacentConnectedCells(state.board, explorer.x, explorer.y)) {
          if (nb.type === 'darts' && !nb.consolidated) {
            if (!hasVigilanceOnTile(state, nb.x, nb.y)) {
              triggerDarts(state, nb);
              events.push('darts_adjacent');
            }
          }
        }
      }
      break;
    }

    case 'wake': {
      const result = wakeNearestGuardian(state);
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
