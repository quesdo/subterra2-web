import { getCell, returnGuardiansToPool, damage, log } from './state.js';
import { getAdjacentConnectedCells } from './board.js';

export function advanceEruption(state) {
  const step = state.volcano.cursed ? 2 : 1;
  state.volcano.position = Math.max(0, state.volcano.position - step);
  if (state.volcano.position === 0) {
    state.volcano.erupting = true;
  }
  return state.volcano.position;
}

export function tryErupt(state) {
  if (!state.volcano.erupting || state.volcano.erupted) return false;
  triggerEruption(state);
  state.volcano.erupted = true;
  return true;
}

export function triggerEruption(state) {
  if (state.sanctuary) {
    const sanctuaryCell = getCell(state, state.sanctuary.x, state.sanctuary.y);
    if (sanctuaryCell) {
      flipToVolcano(state, sanctuaryCell);
    }
  }
  if (!state.sanctuary || (!state.artifactRetrieved && !state.artifactEscaped)) {
    state.winner = 'game';
    state.medal = 'Oubliés à jamais';
  }
}

export function spreadLava(state) {
  const toFlip = [];
  const visited = new Set();
  const queue = [];

  for (const cell of state.board.cells.values()) {
    if (cell.flipped) {
      queue.push(cell);
    }
  }

  while (queue.length > 0) {
    const cell = queue.shift();
    const neighbors = getAdjacentConnectedCells(state.board, cell.x, cell.y);
    for (const nb of neighbors) {
      if (nb.flipped) continue;
      if (state.sanctuary && nb.x === state.sanctuary.x && nb.y === state.sanctuary.y) continue;
      const k = `${nb.x},${nb.y}`;
      if (visited.has(k)) continue;
      visited.add(k);
      toFlip.push(nb);
      queue.push(nb);
    }
  }

  for (const cell of toFlip) {
    flipToVolcano(state, cell);
  }
}

export function flipToVolcano(state, cell) {
  cell.flipped = true;

  for (const explorer of state.explorers) {
    if (explorer.x === cell.x && explorer.y === cell.y && explorer.state !== 'dead' && explorer.state !== 'escaped') {
      explorer.state = 'dead';
      log(state, `${explorer.name} est englouti par la lave`);
    }
  }

  returnGuardiansToPool(state.guardians, cell.guardians || []);
  cell.guardians = [];

  cell.rubble = false;
  cell.keyMarker = false;
  cell.consolidated = false;
}

export function onLavaPeril(state) {
  for (const explorer of state.explorers) {
    if (explorer.state === 'dead' || explorer.state === 'escaped') continue;
    const cell = getCell(state, explorer.x, explorer.y);
    if (cell && (cell.type === 'lava' || cell.type === 'lave') && !cell.consolidated) {
      damage(state, explorer, 1, 'lava');
    }
  }

  if (state.volcano.erupted) {
    spreadLava(state);
  }

  if (state.volcano.erupting && !state.volcano.erupted) {
    tryErupt(state);
  }
}
