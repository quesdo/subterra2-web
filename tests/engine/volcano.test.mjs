import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createGameState,
  getCell,
  spawnGuardian,
} from '../../src/engine/state.js';
import { placeCell } from '../../src/engine/board.js';
import {
  advanceEruption,
  tryErupt,
  triggerEruption,
  spreadLava,
  flipToVolcano,
  onLavaPeril,
} from '../../src/engine/volcano.js';

function makeTestState() {
  return createGameState({
    explorerIds: ['scout', 'miner', 'nurse'],
    difficulty: 'normal',
  });
}

function makeCell(x, y, overrides = {}) {
  return {
    x,
    y,
    type: 'normale',
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
    guardians: [],
    ...overrides,
  };
}

// ── advanceEruption ─────────────────────────────────────────────────

test('advanceEruption decrements position by 1 normally', () => {
  const state = makeTestState();
  state.volcano.position = 5;
  const newPos = advanceEruption(state);
  assert.equal(newPos, 4);
  assert.equal(state.volcano.position, 4);
});

test('advanceEruption decrements by 2 when cursed', () => {
  const state = makeTestState();
  state.volcano.cursed = true;
  state.volcano.position = 5;
  const newPos = advanceEruption(state);
  assert.equal(newPos, 3);
  assert.equal(state.volcano.position, 3);
});

test('advanceEruption sets erupting=true when position reaches 0', () => {
  const state = makeTestState();
  state.volcano.position = 1;
  advanceEruption(state);
  assert.equal(state.volcano.position, 0);
  assert.equal(state.volcano.erupting, true);
});

test('advanceEruption clamps position at 0 (not negative)', () => {
  const state = makeTestState();
  state.volcano.position = 0;
  const newPos = advanceEruption(state);
  assert.equal(newPos, 0);
  assert.equal(state.volcano.position, 0);
});

test('advanceEruption clamps at 0 when cursed would go negative', () => {
  const state = makeTestState();
  state.volcano.cursed = true;
  state.volcano.position = 1;
  const newPos = advanceEruption(state);
  assert.equal(newPos, 0);
  assert.equal(state.volcano.erupting, true);
});

// ── tryErupt ─────────────────────────────────────────────────────────

test('tryErupt does nothing if not erupting', () => {
  const state = makeTestState();
  state.volcano.erupting = false;
  const result = tryErupt(state);
  assert.equal(result, false);
  assert.equal(state.volcano.erupted, false);
});

test('tryErupt triggers eruption when erupting and not yet erupted', () => {
  const state = makeTestState();
  state.volcano.erupting = true;
  state.volcano.erupted = false;
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  placeCell(state.board, makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' }));
  const result = tryErupt(state);
  assert.equal(result, true);
});

test('tryErupt sets erupted=true after eruption', () => {
  const state = makeTestState();
  state.volcano.erupting = true;
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  placeCell(state.board, makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' }));
  tryErupt(state);
  assert.equal(state.volcano.erupted, true);
});

test('tryErupt does nothing if already erupted', () => {
  const state = makeTestState();
  state.volcano.erupting = true;
  state.volcano.erupted = true;
  const result = tryErupt(state);
  assert.equal(result, false);
});

// ── triggerEruption ──────────────────────────────────────────────────

test('triggerEruption kills explorers on flipped tiles', () => {
  const state = makeTestState();
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  placeCell(state.board, makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' }));
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].state = 'active';
  triggerEruption(state);
  assert.equal(state.explorers[0].state, 'dead');
});

test('triggerEruption eliminates guardians on flipped tiles (returns to pool)', () => {
  const state = makeTestState();
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  const cell = makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' });
  placeCell(state.board, cell);
  spawnGuardian(state.guardians, cell);
  spawnGuardian(state.guardians, cell);
  const initialAvailable = state.guardians.available;
  triggerEruption(state);
  assert.equal(cell.guardians.length, 0);
  assert.equal(state.guardians.available, initialAvailable + 2);
});

test('triggerEruption flips sanctuary if placed', () => {
  const state = makeTestState();
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  const cell = makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' });
  placeCell(state.board, cell);
  triggerEruption(state);
  assert.equal(cell.flipped, true);
  assert.equal(state.winner, null);
});

test('triggerEruption sets winner=game if sanctuary not discovered', () => {
  const state = makeTestState();
  state.sanctuary = null;
  triggerEruption(state);
  assert.equal(state.winner, 'game');
});

test('triggerEruption sets winner=game if artifact not retrieved and not escaped', () => {
  const state = makeTestState();
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = false;
  state.artifactEscaped = false;
  placeCell(state.board, makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' }));
  triggerEruption(state);
  assert.equal(state.winner, 'game');
});

// ── spreadLava ───────────────────────────────────────────────────────

test('spreadLava flips adjacent connected tiles', () => {
  const state = makeTestState();
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  const c3 = makeCell(5, 7);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  placeCell(state.board, c3);
  spreadLava(state);
  assert.equal(c2.flipped, true);
  assert.equal(c3.flipped, true);
});

test('spreadLava includes Entry and Latérales cells', () => {
  const state = makeTestState();
  const cell00 = getCell(state, 0, 0);
  cell00.flipped = true;
  spreadLava(state);
  assert.equal(getCell(state, 0, -1).flipped, true);
  assert.equal(getCell(state, -1, 0).flipped, true);
  assert.equal(getCell(state, -2, 0).flipped, true);
  assert.equal(getCell(state, -3, 0).flipped, true);
  assert.equal(getCell(state, 1, 0).flipped, true);
  assert.equal(getCell(state, 2, 0).flipped, true);
  assert.equal(getCell(state, 3, 0).flipped, true);
});

test('spreadLava kills explorers on newly flipped tiles', () => {
  const state = makeTestState();
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  state.explorers[0].x = 5;
  state.explorers[0].y = 6;
  state.explorers[0].state = 'active';
  spreadLava(state);
  assert.equal(state.explorers[0].state, 'dead');
});

test('spreadLava eliminates guardians on newly flipped tiles', () => {
  const state = makeTestState();
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  spawnGuardian(state.guardians, c2);
  const initialAvailable = state.guardians.available;
  spreadLava(state);
  assert.equal(c2.guardians.length, 0);
  assert.equal(state.guardians.available, initialAvailable + 1);
});

test('spreadLava does not flip disconnected tiles', () => {
  const state = makeTestState();
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  c1.walls = { N: true, E: false, S: false, W: false };
  const c2 = makeCell(5, 6, { walls: { N: false, E: true, S: true, W: true } });
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  spreadLava(state);
  assert.equal(c2.flipped, false);
});

test('spreadLava skips sanctuary', () => {
  const state = makeTestState();
  state.sanctuary = { x: 5, y: 5 };
  const c1 = makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' });
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  const c3 = makeCell(5, 7);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  placeCell(state.board, c3);
  spreadLava(state);
  assert.equal(c2.flipped, true);
  assert.equal(c3.flipped, true);
  assert.equal(c1.flipped, true);
});

// ── flipToVolcano ────────────────────────────────────────────────────

test('flipToVolcano sets flipped=true on cell', () => {
  const state = makeTestState();
  const cell = makeCell(5, 5);
  placeCell(state.board, cell);
  flipToVolcano(state, cell);
  assert.equal(cell.flipped, true);
});

test('flipToVolcano kills explorers on the cell', () => {
  const state = makeTestState();
  const cell = makeCell(5, 5);
  placeCell(state.board, cell);
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].state = 'active';
  state.explorers[1].x = 0;
  state.explorers[1].y = 0;
  state.explorers[1].state = 'active';
  flipToVolcano(state, cell);
  assert.equal(state.explorers[0].state, 'dead');
  assert.equal(state.explorers[1].state, 'active');
});

test('flipToVolcano returns guardians to pool', () => {
  const state = makeTestState();
  const cell = makeCell(5, 5);
  placeCell(state.board, cell);
  spawnGuardian(state.guardians, cell);
  spawnGuardian(state.guardians, cell);
  const initialAvailable = state.guardians.available;
  flipToVolcano(state, cell);
  assert.equal(cell.guardians.length, 0);
  assert.equal(state.guardians.available, initialAvailable + 2);
});

test('flipToVolcano clears markers on cell', () => {
  const state = makeTestState();
  const cell = makeCell(5, 5, { rubble: true, keyMarker: true, consolidated: true });
  placeCell(state.board, cell);
  flipToVolcano(state, cell);
  assert.equal(cell.rubble, false);
  assert.equal(cell.keyMarker, false);
  assert.equal(cell.consolidated, false);
});

// ── onLavaPeril ───────────────────────────────────────────────────────

test('onLavaPeril damages all explorers on lava tiles (1 HP)', () => {
  const state = makeTestState();
  const lavaCell = makeCell(5, 5, { type: 'lave' });
  placeCell(state.board, lavaCell);
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].hp = 5;
  state.explorers[1].x = 0;
  state.explorers[1].y = 0;
  state.explorers[1].hp = 7;
  onLavaPeril(state);
  assert.equal(state.explorers[0].hp, 4);
  assert.equal(state.explorers[1].hp, 7);
});

test('onLavaPeril triggers eruption if volcano is ready', () => {
  const state = makeTestState();
  state.volcano.erupting = true;
  state.volcano.erupted = false;
  state.sanctuary = { x: 5, y: 5 };
  state.artifactRetrieved = true;
  placeCell(state.board, makeCell(5, 5, { isSanctuary: true, type: 'sanctuary' }));
  onLavaPeril(state);
  assert.equal(state.volcano.erupted, true);
});

test('onLavaPeril spreads lava if volcano has erupted', () => {
  const state = makeTestState();
  state.volcano.erupted = true;
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  onLavaPeril(state);
  assert.equal(c2.flipped, true);
});

test('onLavaPeril does not spread lava if volcano has not erupted', () => {
  const state = makeTestState();
  state.volcano.erupted = false;
  state.volcano.erupting = false;
  const c1 = makeCell(5, 5);
  c1.flipped = true;
  const c2 = makeCell(5, 6);
  placeCell(state.board, c1);
  placeCell(state.board, c2);
  onLavaPeril(state);
  assert.equal(c2.flipped, false);
});
