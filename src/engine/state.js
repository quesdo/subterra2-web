import { createBoard, placeEntry, placeCell } from './board.js';
import { TEMPLE_TILES, JOURNAL_TILES } from './tiles.js';
import { EXPLORERS, ABILITIES } from './explorers.js';
import { getEruptionStart } from './difficulty.js';

export function createGuardianPool(maxGuardians = 5) {
  return { available: maxGuardians, inPlay: 0, nextId: 0 };
}

export function spawnGuardian(pool, cell) {
  if (pool.available <= 0) return null;
  const id = 'G' + pool.nextId++;
  pool.available--;
  pool.inPlay++;
  if (!cell.guardians) cell.guardians = [];
  const guardian = { id, x: cell.x, y: cell.y, activatedThisPhase: false };
  cell.guardians.push(guardian);
  return guardian;
}

export function removeGuardian(pool, cell) {
  if (!cell.guardians || cell.guardians.length === 0) return null;
  const g = cell.guardians.pop();
  pool.available++;
  pool.inPlay--;
  return g;
}

export function removeAllGuardians(pool, cell) {
  if (!cell.guardians) return 0;
  const n = cell.guardians.length;
  pool.available += n;
  pool.inPlay -= n;
  cell.guardians = [];
  return n;
}

export function returnGuardiansToPool(pool, guardians) {
  const n = guardians.length;
  pool.available += n;
  pool.inPlay -= n;
  return n;
}

export function createGameState(config) {
  const {
    explorerIds,
    difficulty = 'normal',
    maxExplorers = explorerIds.length,
  } = config;

  const numExplorers = explorerIds.length;
  if (numExplorers < 3 || numExplorers > 6) {
    throw new Error(`Explorer count must be 3-6, got ${numExplorers}`);
  }

  const board = createBoard();
  const entryCells = placeEntry(board);

  const explorers = explorerIds.map((expId, i) => {
    const def = EXPLORERS.find(e => e.id === expId);
    if (!def) throw new Error(`Unknown explorer: ${expId}`);

    const abilityUsesLeft = {};
    const abilityCooldown = {};
    for (const abId of def.abilities) {
      const ab = ABILITIES[abId];
      abilityUsesLeft[abId] = ab.uses;
      abilityCooldown[abId] = 0;
    }

    return {
      id: def.id,
      name: def.name,
      roleId: def.id,
      hp: def.pv,
      maxHp: def.pv,
      state: 'active',
      x: 0,
      y: 0,
      item: null,
      pushedThisTurn: false,
      shielded: false,
      abilityUsesLeft,
      abilityCooldown,
      orderIndex: i,
    };
  });

  const tileBag = shuffle(TEMPLE_TILES.map(t => t.id));
  const journalBag = JOURNAL_TILES.map(t => t.id);

  const eruptionStart = getEruptionStart(numExplorers, difficulty);

  return {
    turn: 1,
    phase: 'explorerTurn',
    currentExplorerIdx: 0,
    processedPlayers: 0,
    explorers,
    board,
    tileBag,
    journalBag,
    guardians: createGuardianPool(5),
    volcano: {
      position: eruptionStart,
      cursed: false,
      erupting: false,
      erupted: false,
    },
    keysPlacedOnSanctuary: 0,
    artifactRetrieved: false,
    artifactEscaped: false,
    artifactOnGround: null,
    curseActive: false,
    sanctuary: null,
    winner: null,
    medal: null,
    log: [],
    difficulty,
    expeditionLeaderIdx: 0,
    ap: 2,
  };
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function serialize(state) {
  const boardCells = {};
  for (const [key, cell] of state.board.cells) {
    boardCells[key] = { ...cell };
    if (cell.guardians) boardCells[key].guardians = cell.guardians.map(g => ({ ...g }));
  }
  return JSON.stringify({
    ...state,
    board: { cells: boardCells },
    explorers: state.explorers.map(e => ({ ...e })),
    guardians: { ...state.guardians },
    volcano: { ...state.volcano },
  });
}

export function deserialize(json) {
  const obj = JSON.parse(json);
  const board = createBoard();
  for (const [key, cell] of Object.entries(obj.board.cells)) {
    placeCell(board, cell);
  }
  return {
    ...obj,
    board,
    explorers: obj.explorers.map(e => ({ ...e })),
    guardians: { ...obj.guardians },
    volcano: { ...obj.volcano },
  };
}

export function log(state, message) {
  state.log.push(message);
  if (state.log.length > 200) state.log.shift();
}

export function getActiveExplorer(state) {
  return state.explorers[state.currentExplorerIdx];
}

export function getExplorerAt(state, x, y) {
  return state.explorers.find(e => e.x === x && e.y === y && e.state !== 'dead' && e.state !== 'escaped');
}

export function getCell(state, x, y) {
  return state.board.cells.get(`${x},${y}`) || null;
}

export function damage(state, explorer, amount, source) {
  if (explorer.shielded && source !== 'push') return false;
  if (explorer.state === 'dead' || explorer.state === 'escaped') return false;

  explorer.hp = Math.max(0, explorer.hp - amount);

  if (explorer.hp === 0 && explorer.state === 'active') {
    explorer.state = 'down';
    log(state, `${explorer.name} tombe à terre (${source})`);
    return true;
  }
  return false;
}

export function heal(state, explorer, amount) {
  if (explorer.state === 'dead' || explorer.state === 'escaped') return false;

  explorer.hp = Math.min(explorer.maxHp, explorer.hp + amount);

  if (explorer.state === 'down' && explorer.hp > 0) {
    explorer.state = 'active';
    log(state, `${explorer.name} se relève (${explorer.hp} PV)`);
    return true;
  }
  return false;
}
