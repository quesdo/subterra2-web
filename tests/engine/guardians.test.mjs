import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  wakeNearestGuardian,
  activateAllGuardians,
  activateOneGuardian,
  resetActivationFlags,
  returnGuardiansToPool,
} from '../../src/engine/guardians.js';
import {
  createGameState,
  spawnGuardian,
  getCell,
} from '../../src/engine/state.js';

function makeState() {
  return createGameState({
    explorerIds: ['scout', 'miner', 'nurse'],
    difficulty: 'normal',
  });
}

function addCell(state, x, y, opts = {}) {
  const cell = {
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
    ...opts,
  };
  state.board.cells.set(`${x},${y}`, cell);
  return cell;
}

function moveAllExplorers(state, x, y) {
  for (const e of state.explorers) {
    e.x = x;
    e.y = y;
  }
}

/* 1 */ test('wakeNearestGuardian places guardian on nearest anchor tile', () => {
  const state = makeState();
  // Active explorer (scout) at (0,0). Nearest anchor is (3,0) at distance 3.
  const cell = wakeNearestGuardian(state);
  assert.ok(cell, 'should return a cell');
  assert.strictEqual(cell.guardianAnchor, true);
  assert.ok(cell.guardians && cell.guardians.length === 1);
  assert.strictEqual(state.guardians.available, 4);
  assert.strictEqual(state.guardians.inPlay, 1);
});

/* 2 */ test('wakeNearestGuardian returns null when pool is empty', () => {
  const state = makeState();
  state.guardians.available = 0;
  const result = wakeNearestGuardian(state);
  assert.strictEqual(result, null);
});

/* 3 */ test('wakeNearestGuardian uses BFS ignoring rubble for distance', () => {
  const state = makeState();
  // Add (0,1) with rubble and (0,2) with guardianAnchor
  addCell(state, 0, 1, { rubble: true });
  addCell(state, 0, 2, { guardianAnchor: true });
  // (0,2) is at distance 2 through rubble; anchors at (±3,0) are at distance 3.
  // With ignoreRubble, (0,2) should be nearest.
  const cell = wakeNearestGuardian(state);
  assert.ok(cell);
  assert.strictEqual(cell.x, 0);
  assert.strictEqual(cell.y, 2);
  assert.strictEqual(cell.guardians.length, 1);
});

/* 4 */ test('wakeNearestGuardian skips occupied anchor and finds next nearest', () => {
  const state = makeState();
  const anchorCell = getCell(state, 3, 0);
  spawnGuardian(state.guardians, anchorCell);
  assert.strictEqual(anchorCell.guardians.length, 1);
  assert.strictEqual(state.guardians.available, 4);
  const cell = wakeNearestGuardian(state);
  assert.ok(cell);
  // (3,0) is occupied, so it should find the other anchor at (-3,0)
  assert.strictEqual(cell.x, -3);
  assert.strictEqual(cell.y, 0);
  assert.strictEqual(cell.guardians.length, 1);
  assert.strictEqual(anchorCell.guardians.length, 1);
  assert.strictEqual(state.guardians.available, 3);
});

/* 5 */ test('activateAllGuardians resets activation flags first', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  const g = spawnGuardian(state.guardians, cell);
  g.activatedThisPhase = true;
  const hpBefore = state.explorers[0].hp;
  activateAllGuardians(state);
  // Guardian should have attacked because flags were reset
  assert.strictEqual(state.explorers[0].hp, hpBefore - 1);
});

/* 6 */ test('activateAllGuardians activates each guardian once (no double activation)', () => {
  const state = makeState();
  state.explorers[0].x = 1;
  state.explorers[0].y = 0;
  const cellA = getCell(state, 0, 0);
  const cellB = getCell(state, 1, 0);
  spawnGuardian(state.guardians, cellA);
  spawnGuardian(state.guardians, cellB);
  const hpScout = state.explorers[0].hp;
  const hpNurse = state.explorers[2].hp;
  activateAllGuardians(state);
  // Guardian at (1,0) attacks scout (only active explorer there)
  assert.strictEqual(state.explorers[0].hp, hpScout - 1);
  // Guardian at (0,0) attacks nurse (lowest HP on tile: nurse 5 < miner 7)
  assert.strictEqual(state.explorers[2].hp, hpNurse - 1);
});

/* 7 */ test('guardian attacks active explorer on same tile (1 HP damage)', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const hpBefore = state.explorers[0].hp;
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'attack');
  assert.strictEqual(state.explorers[0].hp, hpBefore - 1);
});

/* 8 */ test('guardian does not attack downed explorer', () => {
  const state = makeState();
  state.explorers[0].state = 'down';
  state.explorers[0].hp = 0;
  state.explorers[1].x = 3;
  state.explorers[1].y = 0;
  state.explorers[2].x = 3;
  state.explorers[2].y = 0;
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const hpBefore = state.explorers[0].hp;
  const result = activateOneGuardian(state, cell);
  assert.notStrictEqual(result, 'attack');
  assert.strictEqual(state.explorers[0].hp, hpBefore);
});

/* 9 */ test('guardian moves toward nearest active explorer when can\'t attack', () => {
  const state = makeState();
  moveAllExplorers(state, 3, 0);
  const cell = getCell(state, 1, 0);
  const g = spawnGuardian(state.guardians, cell);
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'move');
  assert.strictEqual(g.x, 2);
  assert.strictEqual(g.y, 0);
  assert.strictEqual(cell.guardians.length, 0);
  const newCell = getCell(state, 2, 0);
  assert.strictEqual(newCell.guardians.length, 1);
});

/* 10 */ test('guardian does not move through rubble', () => {
  const state = makeState();
  moveAllExplorers(state, 2, 0);
  const rubbleCell = getCell(state, 1, 0);
  rubbleCell.rubble = true;
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'dig');
  assert.strictEqual(rubbleCell.rubble, false);
});

/* 11 */ test('guardian digs adjacent rubble when can\'t move', () => {
  const state = makeState();
  moveAllExplorers(state, 99, 99);
  const rubbleCell = getCell(state, 1, 0);
  rubbleCell.rubble = true;
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'dig');
  assert.strictEqual(rubbleCell.rubble, false);
});

/* 12 */ test('guardian can enter bridge tile even if occupied by explorer', () => {
  const state = makeState();
  addCell(state, 0, 1, { type: 'pont', occupied: true });
  addCell(state, 0, 2, {});
  moveAllExplorers(state, 0, 2);
  const cell = getCell(state, 0, 0);
  const g = spawnGuardian(state.guardians, cell);
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'move');
  assert.strictEqual(g.x, 0);
  assert.strictEqual(g.y, 1);
  const bridgeCell = getCell(state, 0, 1);
  assert.strictEqual(bridgeCell.guardians.length, 1);
});

/* 13 */ test('guardian damage is blocked by shield', () => {
  const state = makeState();
  state.explorers[0].shielded = true;
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const hpBefore = state.explorers[0].hp;
  const result = activateOneGuardian(state, cell);
  assert.strictEqual(result, 'attack');
  assert.strictEqual(state.explorers[0].hp, hpBefore);
});

/* 14 */ test('eliminated guardian returns to pool (pool.available increases)', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  const g = spawnGuardian(state.guardians, cell);
  assert.strictEqual(state.guardians.available, 4);
  assert.strictEqual(state.guardians.inPlay, 1);
  cell.guardians = [];
  const n = returnGuardiansToPool(state, [g]);
  assert.strictEqual(n, 1);
  assert.strictEqual(state.guardians.available, 5);
  assert.strictEqual(state.guardians.inPlay, 0);
});

/* 15 */ test('resetActivationFlags sets all guardians activatedThisPhase to false', () => {
  const state = makeState();
  const cellA = getCell(state, 0, 0);
  const cellB = getCell(state, 1, 0);
  const gA = spawnGuardian(state.guardians, cellA);
  const gB = spawnGuardian(state.guardians, cellB);
  gA.activatedThisPhase = true;
  gB.activatedThisPhase = true;
  resetActivationFlags(state);
  assert.strictEqual(gA.activatedThisPhase, false);
  assert.strictEqual(gB.activatedThisPhase, false);
});

/* 16 */ test('guardian that moved during activation is not activated again', () => {
  const state = makeState();
  moveAllExplorers(state, 3, 0);
  const cell = getCell(state, 1, 0);
  const g = spawnGuardian(state.guardians, cell);
  activateAllGuardians(state);
  assert.strictEqual(g.x, 2);
  assert.strictEqual(g.y, 0);
  assert.strictEqual(state.explorers[0].hp, 5);
});
