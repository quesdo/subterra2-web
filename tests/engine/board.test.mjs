import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createBoard, placeCell, getCell, areConnected, reachableNeighbors,
  bfs, shortestPath, nearestCell, lineOfSight, placeEntry,
  getValidRotations, placeTile, canPlaceBeyondLaterales,
  getAdjacentConnectedCells, rotateWalls,
  DIRS, OPP, DIR_DELTA,
} from '../../src/engine/board.js';

function makeCell(x, y, opts = {}) {
  return {
    x,
    y,
    type: opts.type || 'normal',
    walls: opts.walls || { N: true, E: true, S: true, W: true },
    flipped: opts.flipped || false,
    rubble: opts.rubble || false,
    keyMarker: opts.keyMarker || false,
    consolidated: opts.consolidated || false,
    demolished: opts.demolished || {},
    ruinsNum: opts.ruinsNum ?? null,
    isEntry: opts.isEntry || false,
    isLateral: opts.isLateral || false,
    isSanctuary: opts.isSanctuary || false,
    guardianAnchor: opts.guardianAnchor || false,
    exitDir: opts.exitDir || null,
    occupied: opts.occupied || false,
  };
}

function openBoard(cells) {
  const board = createBoard();
  for (const c of cells) placeCell(board, c);
  return board;
}

/* 1 */ test('createBoard returns an object with a cells Map', () => {
  const board = createBoard();
  assert.ok(board.cells);
  assert.strictEqual(board.cells instanceof Map, true);
  assert.strictEqual(board.cells.size, 0);
});

/* 2 */ test('placeCell + getCell work correctly', () => {
  const board = createBoard();
  const cell = makeCell(1, 2, { type: 'lava' });
  placeCell(board, cell);
  const got = getCell(board, 1, 2);
  assert.ok(got);
  assert.strictEqual(got.type, 'lava');
  assert.strictEqual(got.x, 1);
  assert.strictEqual(got.y, 2);
});

/* 3 */ test('getCell returns null for non-existent cell', () => {
  const board = createBoard();
  assert.strictEqual(getCell(board, 5, 5), null);
});

/* 4 */ test('areConnected: two adjacent cells with open shared edges -> true', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true } }),
  ]);
  assert.strictEqual(areConnected(board, 0, 0, 1, 0), true);
});

/* 5 */ test('areConnected: two adjacent cells with wall on one side -> false', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: false } }),
  ]);
  assert.strictEqual(areConnected(board, 0, 0, 1, 0), false);
});

/* 6 */ test('areConnected: two adjacent cells with wall on both sides -> false', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: false, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: false } }),
  ]);
  assert.strictEqual(areConnected(board, 0, 0, 1, 0), false);
});

/* 7 */ test('areConnected: two non-adjacent cells -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(2, 0),
  ]);
  assert.strictEqual(areConnected(board, 0, 0, 2, 0), false);
});

/* 8 */ test('areConnected: diagonal cells -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 1),
  ]);
  assert.strictEqual(areConnected(board, 0, 0, 1, 1), false);
});

/* 9 */ test('reachableNeighbors: returns only connected non-flipped cells', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true }, flipped: true }),
    makeCell(0, 1, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(-1, 0, { walls: { N: true, E: false, S: true, W: true } }),
  ]);
  const neighbors = reachableNeighbors(board, 0, 0);
  assert.strictEqual(neighbors.length, 1);
  assert.deepStrictEqual(neighbors[0], { x: 0, y: 1 });
});

/* 10 */ test('reachableNeighbors: skips rubble cells by default', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true }, rubble: true }),
  ]);
  const neighbors = reachableNeighbors(board, 0, 0);
  assert.strictEqual(neighbors.length, 0);
});

/* 11 */ test('reachableNeighbors: includes rubble cells when ignoreRubble is true', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true }, rubble: true }),
  ]);
  const neighbors = reachableNeighbors(board, 0, 0, { ignoreRubble: true });
  assert.strictEqual(neighbors.length, 1);
  assert.deepStrictEqual(neighbors[0], { x: 1, y: 0 });
});

/* 12 */ test('bfs: returns correct distances in a simple 3-cell line', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0),
    makeCell(2, 0),
  ]);
  const dist = bfs(board, 0, 0);
  assert.strictEqual(dist.get('0,0'), 0);
  assert.strictEqual(dist.get('1,0'), 1);
  assert.strictEqual(dist.get('2,0'), 2);
});

/* 13 */ test('bfs: respects walls (does not cross closed edges)', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: false, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true } }),
  ]);
  const dist = bfs(board, 0, 0);
  assert.strictEqual(dist.size, 1);
  assert.strictEqual(dist.get('0,0'), 0);
  assert.strictEqual(dist.has('1,0'), false);
});

/* 14 */ test('bfs: respects rubble (does not enter rubble cells by default)', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0, { rubble: true }),
  ]);
  const dist = bfs(board, 0, 0);
  assert.strictEqual(dist.size, 1);
  assert.strictEqual(dist.get('0,0'), 0);
  assert.strictEqual(dist.has('1,0'), false);
});

/* 15 */ test('shortestPath: returns correct path for simple case', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0),
    makeCell(2, 0),
  ]);
  const path = shortestPath(board, 0, 0, 2, 0);
  assert.ok(path);
  assert.strictEqual(path.length, 3);
  assert.deepStrictEqual(path[0], { x: 0, y: 0 });
  assert.deepStrictEqual(path[1], { x: 1, y: 0 });
  assert.deepStrictEqual(path[2], { x: 2, y: 0 });
});

/* 16 */ test('shortestPath: returns null when unreachable', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: false, S: true, W: true } }),
    makeCell(2, 0),
  ]);
  const path = shortestPath(board, 0, 0, 2, 0);
  assert.strictEqual(path, null);
});

/* 17 */ test('nearestCell: finds nearest cell matching predicate', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0),
    makeCell(2, 0, { keyMarker: true }),
  ]);
  const result = nearestCell(board, 0, 0, (cell) => cell.keyMarker);
  assert.ok(result);
  assert.strictEqual(result.x, 2);
  assert.strictEqual(result.y, 0);
  assert.strictEqual(result.dist, 2);
});

/* 18 */ test('nearestCell: returns null when no match', () => {
  const board = openBoard([
    makeCell(0, 0),
  ]);
  const result = nearestCell(board, 0, 0, (cell) => cell.type === 'lava');
  assert.strictEqual(result, null);
});

/* 19 */ test('lineOfSight: same row, no walls -> true', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0),
    makeCell(2, 0),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 2, 0), true);
});

/* 20 */ test('lineOfSight: same row, wall in between -> false', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: false, S: true, W: true } }),
    makeCell(1, 0),
    makeCell(2, 0),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 2, 0), false);
});

/* 21 */ test('lineOfSight: rubble in between -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0, { rubble: true }),
    makeCell(2, 0),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 2, 0), false);
});

/* 22 */ test('lineOfSight: different row and column -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 1),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 1, 1), false);
});

/* 23 */ test('lineOfSight: beyond maxDist -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0),
    makeCell(2, 0),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 2, 0, 1), false);
});

/* 24 */ test('lineOfSight: flipped cell in between -> false', () => {
  const board = openBoard([
    makeCell(0, 0),
    makeCell(1, 0, { flipped: true }),
    makeCell(2, 0),
  ]);
  assert.strictEqual(lineOfSight(board, 0, 0, 2, 0), false);
});

/* 25 */ test('placeEntry: creates entry cells and lateral cells', () => {
  const board = createBoard();
  const placed = placeEntry(board);

  assert.ok(Array.isArray(placed));
  assert.ok(placed.length >= 7);

  const entryTop = getCell(board, 0, -1);
  const entryBot = getCell(board, 0, 0);
  assert.ok(entryTop, 'ENTRY_TOP at (0,-1)');
  assert.ok(entryBot, 'ENTRY_BOT at (0,0)');
  assert.strictEqual(entryTop.isEntry, true);
  assert.strictEqual(entryBot.isEntry, true);
  assert.strictEqual(areConnected(board, 0, -1, 0, 0), true, 'entry cells connected N/S');

  const gl = getCell(board, -3, 0);
  const gr = getCell(board, 3, 0);
  assert.ok(gl, 'left guardian anchor at (-3,0)');
  assert.ok(gr, 'right guardian anchor at (3,0)');
  assert.strictEqual(gl.guardianAnchor, true);
  assert.strictEqual(gr.guardianAnchor, true);

  assert.ok(getCell(board, -1, 0), 'left normal at (-1,0)');
  assert.ok(getCell(board, -2, 0), 'left normal at (-2,0)');
  assert.ok(getCell(board, 1, 0), 'right normal at (1,0)');
  assert.ok(getCell(board, 2, 0), 'right normal at (2,0)');

  assert.strictEqual(areConnected(board, 0, 0, 1, 0), true, 'entry bot connected to right normal');
  assert.strictEqual(areConnected(board, 0, 0, -1, 0), true, 'entry bot connected to left normal');
});

/* 26 */ test('getValidRotations: returns rotations that establish at least one connection', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: false, E: true, S: false, W: false } }),
  ]);
  const tileWalls = { N: false, E: true, S: true, W: false };
  const rotations = getValidRotations(board, 1, 0, tileWalls);
  assert.ok(rotations.includes(90));
  assert.ok(rotations.includes(180));
  assert.strictEqual(rotations.includes(0), false);
  assert.strictEqual(rotations.includes(270), false);
});

/* 27 */ test('placeTile: applies rotation to walls correctly', () => {
  const board = createBoard();
  const tileDef = { type: 'normal', walls: { N: false, E: true, S: true, W: false } };
  const cell = placeTile(board, 1, 0, tileDef, 90);
  assert.ok(cell);
  assert.strictEqual(cell.type, 'normal');
  assert.strictEqual(cell.x, 1);
  assert.strictEqual(cell.y, 0);
  const expected = rotateWalls(tileDef.walls, 90);
  assert.deepStrictEqual(cell.walls, expected);
  assert.strictEqual(getCell(board, 1, 0), cell);
});

/* 28 */ test('canPlaceBeyondLaterales: returns false for positions behind/beyond laterales', () => {
  const board = createBoard();
  placeEntry(board);
  assert.strictEqual(canPlaceBeyondLaterales(board, 4, 0), false);
  assert.strictEqual(canPlaceBeyondLaterales(board, -4, 0), false);
  assert.strictEqual(canPlaceBeyondLaterales(board, 5, 3), false);
});

/* 29 */ test('canPlaceBeyondLaterales: returns true for valid positions', () => {
  const board = createBoard();
  placeEntry(board);
  assert.strictEqual(canPlaceBeyondLaterales(board, 0, 1), true);
  assert.strictEqual(canPlaceBeyondLaterales(board, 3, 2), true);
  assert.strictEqual(canPlaceBeyondLaterales(board, -3, 2), true);
});

/* 30 */ test('getAdjacentConnectedCells: returns only adjacent connected cells', () => {
  const board = openBoard([
    makeCell(0, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(1, 0, { walls: { N: true, E: true, S: true, W: true } }),
    makeCell(0, 1, { walls: { N: false, E: true, S: true, W: true } }),
  ]);
  const adjacent = getAdjacentConnectedCells(board, 0, 0);
  assert.strictEqual(adjacent.length, 1);
  assert.strictEqual(adjacent[0].x, 1);
  assert.strictEqual(adjacent[0].y, 0);
});
