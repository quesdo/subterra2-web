export const DIRS = ['N', 'E', 'S', 'W'];
export const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DIR_DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function key(x, y) {
  return `${x},${y}`;
}

function defaultCell(x, y, overrides = {}) {
  return {
    x,
    y,
    type: 'normal',
    walls: { N: true, E: true, S: true, W: true },
    flipped: false,
    rubble: false,
    keyMarker: false,
    consolidated: false,
    demolished: {},
    ruinsNum: null,
    isEntry: false,
    isLateral: false,
    isSanctuary: false,
    guardianAnchor: false,
    exitDir: null,
    occupied: false,
    ...overrides,
  };
}

export function createBoard() {
  return { cells: new Map() };
}

export function placeCell(board, cell) {
  board.cells.set(key(cell.x, cell.y), cell);
}

export function getCell(board, x, y) {
  return board.cells.get(key(x, y)) || null;
}

export function areConnected(board, x1, y1, x2, y2) {
  const cellA = getCell(board, x1, y1);
  const cellB = getCell(board, x2, y2);
  if (!cellA || !cellB) return false;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  let dirFromA, dirFromB;
  if (dx === 1) { dirFromA = 'E'; dirFromB = 'W'; }
  else if (dx === -1) { dirFromA = 'W'; dirFromB = 'E'; }
  else if (dy === 1) { dirFromA = 'S'; dirFromB = 'N'; }
  else { dirFromA = 'N'; dirFromB = 'S'; }
  return cellA.walls[dirFromA] === true && cellB.walls[dirFromB] === true;
}

export function reachableNeighbors(board, x, y, opts = {}) {
  const cell = getCell(board, x, y);
  if (!cell) return [];
  const result = [];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = x + dx;
    const ny = y + dy;
    const nb = getCell(board, nx, ny);
    if (!nb) continue;
    if (nb.flipped) continue;
    if (!areConnected(board, x, y, nx, ny)) continue;
    if (nb.rubble && !opts.ignoreRubble) continue;
    if (nb.occupied && opts.bridgeOccupied !== false) continue;
    result.push({ x: nx, y: ny });
  }
  return result;
}

export function bfs(board, x, y, opts = {}) {
  const dist = new Map();
  const startKey = key(x, y);
  dist.set(startKey, 0);
  const queue = [[x, y, 0]];
  while (queue.length) {
    const [cx, cy, d] = queue.shift();
    for (const { x: nx, y: ny } of reachableNeighbors(board, cx, cy, opts)) {
      const nk = key(nx, ny);
      if (!dist.has(nk)) {
        dist.set(nk, d + 1);
        queue.push([nx, ny, d + 1]);
      }
    }
  }
  return dist;
}

export function shortestPath(board, x1, y1, x2, y2, opts = {}) {
  const prev = new Map();
  const startKey = key(x1, y1);
  prev.set(startKey, null);
  const queue = [[x1, y1]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === x2 && cy === y2) {
      const path = [];
      let cur = key(cx, cy);
      while (cur !== null) {
        const [px, py] = cur.split(',').map(Number);
        path.unshift({ x: px, y: py });
        cur = prev.get(cur);
      }
      return path;
    }
    const ck = key(cx, cy);
    for (const { x: nx, y: ny } of reachableNeighbors(board, cx, cy, opts)) {
      const nk = key(nx, ny);
      if (!prev.has(nk)) {
        prev.set(nk, ck);
        queue.push([nx, ny]);
      }
    }
  }
  return null;
}

export function nearestCell(board, x, y, predicate, opts = {}) {
  const dist = bfs(board, x, y, opts);
  for (const [k, d] of dist) {
    const [cx, cy] = k.split(',').map(Number);
    const cell = getCell(board, cx, cy);
    if (cell && predicate(cell, cx, cy)) {
      return { x: cx, y: cy, dist: d };
    }
  }
  return null;
}

export function lineOfSight(board, x1, y1, x2, y2, maxDist = Infinity) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx !== 0 && dy !== 0) return false;
  const steps = Math.abs(dx) + Math.abs(dy);
  if (steps === 0) return true;
  if (steps > maxDist) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let cx = x1;
  let cy = y1;
  for (let i = 0; i < steps; i++) {
    const dir = sx === 1 ? 'E' : sx === -1 ? 'W' : sy === 1 ? 'S' : 'N';
    const [ddx, ddy] = DIR_DELTA[dir];
    const nx = cx + ddx;
    const ny = cy + ddy;
    const next = getCell(board, nx, ny);
    if (!next) return false;
    if (!areConnected(board, cx, cy, nx, ny)) return false;
    if (next.rubble) return false;
    if (next.flipped) return false;
    cx = nx;
    cy = ny;
  }
  return true;
}

export function placeEntry(board) {
  const placed = [];

  const entryTop = defaultCell(0, -1, {
    type: 'entry',
    walls: { N: false, E: false, S: true, W: false },
    isEntry: true,
    exitDir: 'N',
  });
  placeCell(board, entryTop);
  placed.push(entryTop);

  const entryBot = defaultCell(0, 0, {
    type: 'entry',
    walls: { N: true, E: true, S: true, W: true },
    isEntry: true,
  });
  placeCell(board, entryBot);
  placed.push(entryBot);

  const nl1 = defaultCell(-1, 0, {
    type: 'normal',
    walls: { N: false, E: true, S: true, W: true },
    isLateral: true,
  });
  placeCell(board, nl1);
  placed.push(nl1);

  const nl2 = defaultCell(-2, 0, {
    type: 'normal',
    walls: { N: false, E: true, S: true, W: true },
    isLateral: true,
  });
  placeCell(board, nl2);
  placed.push(nl2);

  const gl = defaultCell(-3, 0, {
    type: 'guardian',
    walls: { N: false, E: true, S: false, W: false },
    guardianAnchor: true,
    isLateral: true,
  });
  placeCell(board, gl);
  placed.push(gl);

  const nr1 = defaultCell(1, 0, {
    type: 'normal',
    walls: { N: false, E: true, S: true, W: true },
    isLateral: true,
  });
  placeCell(board, nr1);
  placed.push(nr1);

  const nr2 = defaultCell(2, 0, {
    type: 'normal',
    walls: { N: false, E: true, S: true, W: true },
    isLateral: true,
  });
  placeCell(board, nr2);
  placed.push(nr2);

  const gr = defaultCell(3, 0, {
    type: 'guardian',
    walls: { N: false, E: false, S: false, W: true },
    guardianAnchor: true,
    isLateral: true,
  });
  placeCell(board, gr);
  placed.push(gr);

  return placed;
}

export function rotateWalls(walls, rotation) {
  const rots = Math.round(rotation / 90) % 4;
  if (rots === 0) return { ...walls };
  let result = { ...walls };
  for (let i = 0; i < rots; i++) {
    result = {
      N: result.W,
      E: result.N,
      S: result.E,
      W: result.S,
    };
  }
  return result;
}

export function getValidRotations(board, x, y, tileWalls) {
  const valid = [];
  for (const rotation of [0, 90, 180, 270]) {
    const rotated = rotateWalls(tileWalls, rotation);
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const adj = getCell(board, x + dx, y + dy);
      if (!adj) continue;
      const oppDir = OPP[dir];
      if (rotated[dir] === true && adj.walls[oppDir] === true) {
        valid.push(rotation);
        break;
      }
    }
  }
  return valid;
}

export function placeTile(board, x, y, tileDef, rotation) {
  const rotatedWalls = rotateWalls(tileDef.walls, rotation);
  const cell = defaultCell(x, y, {
    type: tileDef.type,
    walls: rotatedWalls,
    ruinsNum: tileDef.ruinsNum ?? null,
  });
  placeCell(board, cell);
  return cell;
}

export function canPlaceBeyondLaterales(board, x, y) {
  const lateralCells = [...board.cells.values()].filter((c) => c.isLateral);
  if (lateralCells.length === 0) return true;
  const minX = Math.min(...lateralCells.map((c) => c.x));
  const maxX = Math.max(...lateralCells.map((c) => c.x));
  return x >= minX && x <= maxX;
}

export function getAdjacentConnectedCells(board, x, y) {
  const result = [];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (areConnected(board, x, y, nx, ny)) {
      const cell = getCell(board, nx, ny);
      if (cell) result.push(cell);
    }
  }
  return result;
}
