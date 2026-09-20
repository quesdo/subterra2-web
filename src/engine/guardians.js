import {
  getActiveExplorer,
  getCell,
  spawnGuardian,
  damage,
  log,
  returnGuardiansToPool as stateReturnGuardiansToPool,
} from './state.js';
import {
  nearestCell,
  shortestPath,
  getAdjacentConnectedCells,
} from './board.js';

export function wakeNearestGuardian(state) {
  const explorer = getActiveExplorer(state);
  if (!explorer) return null;

  const result = nearestCell(
    state.board,
    explorer.x,
    explorer.y,
    (cell) => cell.guardianAnchor || cell.type === 'guardian',
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

export function resetActivationFlags(state) {
  for (const cell of state.board.cells.values()) {
    if (cell.guardians) {
      for (const g of cell.guardians) {
        g.activatedThisPhase = false;
      }
    }
  }
}

export function activateAllGuardians(state) {
  resetActivationFlags(state);

  const cellsWithGuardians = [];
  for (const cell of state.board.cells.values()) {
    if (cell.guardians && cell.guardians.length > 0) {
      cellsWithGuardians.push(cell);
    }
  }

  for (const cell of cellsWithGuardians) {
    while ((cell.guardians || []).some((g) => !g.activatedThisPhase)) {
      activateOneGuardian(state, cell);
    }
  }
}

export function activateOneGuardian(state, cell) {
  const guardian = (cell.guardians || []).find((g) => !g.activatedThisPhase);
  if (!guardian) return null;

  guardian.activatedThisPhase = true;

  // 1. Attack: active explorer on same tile
  const activeExplorers = state.explorers.filter(
    (e) => e.x === cell.x && e.y === cell.y && e.state === 'active',
  );
  if (activeExplorers.length > 0) {
    // TODO: Chef d'Expédition chooses target. For now, pick first.
    const target = activeExplorers[0];
    damage(state, target, 1, 'guardian');
    log(state, `Gardien attaque ${target.name}`);
    return 'attack';
  }

  // 2. Move: toward nearest active explorer
  const nearest = nearestCell(
    state.board,
    cell.x,
    cell.y,
    (c) =>
      state.explorers.some(
        (e) => e.x === c.x && e.y === c.y && e.state === 'active',
      ),
    { bridgeOccupied: false },
  );

  if (nearest) {
    const path = shortestPath(state.board, cell.x, cell.y, nearest.x, nearest.y, {
      bridgeOccupied: false,
    });
    if (path && path.length > 1) {
      const nextStep = path[1];
      const nextCell = getCell(state, nextStep.x, nextStep.y);
      if (nextCell && !nextCell.rubble) {
        const idx = cell.guardians.indexOf(guardian);
        if (idx >= 0) cell.guardians.splice(idx, 1);
        guardian.x = nextStep.x;
        guardian.y = nextStep.y;
        if (!nextCell.guardians) nextCell.guardians = [];
        nextCell.guardians.push(guardian);
        log(state, `Gardien se déplace vers (${nextStep.x}, ${nextStep.y})`);
        return 'move';
      }
    }
  }

  // 3. Dig: remove adjacent rubble
  const adjacent = getAdjacentConnectedCells(state.board, cell.x, cell.y);
  const rubbleCell = adjacent.find((c) => c.rubble);
  if (rubbleCell) {
    rubbleCell.rubble = false;
    log(state, `Gardien creuse les éboulis en (${rubbleCell.x}, ${rubbleCell.y})`);
    return 'dig';
  }

  return 'idle';
}

export function returnGuardiansToPool(state, guardians) {
  return stateReturnGuardiansToPool(state.guardians, guardians);
}
