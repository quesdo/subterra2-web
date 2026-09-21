import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState, getCell, spawnGuardian } from '../../src/engine/state.js';
import { placeCell } from '../../src/engine/board.js';
import { resolvePeril, resolveCollapseWithRoll } from '../../src/engine/peril-resolution.js';

function makeState() {
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

// ── Stumble ──────────────────────────────────────────────────────────

test('stumble damages explorer if pushed', () => {
  const state = makeState();
  state.explorers[0].pushedThisTurn = true;
  const hpBefore = state.explorers[0].hp;
  resolvePeril(state, 'stumble');
  assert.equal(state.explorers[0].hp, hpBefore - 1);
});

test('stumble does nothing if not pushed', () => {
  const state = makeState();
  state.explorers[0].pushedThisTurn = false;
  const hpBefore = state.explorers[0].hp;
  resolvePeril(state, 'stumble');
  assert.equal(state.explorers[0].hp, hpBefore);
});

test('stumble heals survivor instead of damaging', () => {
  const state = makeState();
  state.currentExplorerIdx = 2; // nurse has survivor
  state.explorers[2].hp = 3;
  state.explorers[2].pushedThisTurn = true;
  resolvePeril(state, 'stumble');
  assert.equal(state.explorers[2].hp, 4);
});

test('stumble is blocked by shield', () => {
  const state = makeState();
  state.explorers[0].pushedThisTurn = true;
  state.explorers[0].shielded = true;
  const hpBefore = state.explorers[0].hp;
  resolvePeril(state, 'stumble');
  assert.equal(state.explorers[0].hp, hpBefore);
});

// ── Collapse ──────────────────────────────────────────────────────────

test('collapse rolls die and matches ruins number: 5 HP damage, guardians eliminated, rubble placed', () => {
  const state = makeState();
  const ruinsCell = makeCell(5, 5, { type: 'ruines', ruinsNum: 3 });
  placeCell(state.board, ruinsCell);
  spawnGuardian(state.guardians, ruinsCell);
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].hp = 7;
  resolveCollapseWithRoll(state, 3);
  assert.equal(state.explorers[0].hp, 2); // 7 - 5 = 2
  assert.equal(ruinsCell.rubble, true);
  assert.equal(ruinsCell.guardians.length, 0);
  assert.equal(state.guardians.available, 5);
});

test('collapse with no matching ruins does nothing', () => {
  const state = makeState();
  const ruinsCell = makeCell(5, 5, { type: 'ruines', ruinsNum: 3 });
  placeCell(state.board, ruinsCell);
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].hp = 7;
  resolveCollapseWithRoll(state, 1);
  assert.equal(state.explorers[0].hp, 7);
  assert.equal(ruinsCell.rubble, false);
});

// ── Trap ──────────────────────────────────────────────────────────────

test('trap triggers spikes (3 HP) on current tile', () => {
  const state = makeState();
  state.currentExplorerIdx = 1; // miner — no vigilance
  const spikeCell = makeCell(5, 5, { type: 'piege_pics' });
  placeCell(state.board, spikeCell);
  state.explorers[1].x = 5;
  state.explorers[1].y = 5;
  state.explorers[1].hp = 7;
  resolvePeril(state, 'trap');
  assert.equal(state.explorers[1].hp, 4); // 7 - 3 = 4
});

test('trap triggers darts (1 HP) on current + adjacent connected tiles', () => {
  const state = makeState();
  state.currentExplorerIdx = 1; // miner — no vigilance
  // Explorer stands on a dart trap at (5,5)
  const dartCell = makeCell(5, 5, { type: 'piege_flechettes' });
  placeCell(state.board, dartCell);
  // Adjacent connected tile at (6,5) with another explorer
  const nbCell = makeCell(6, 5, { type: 'normale', walls: { N: true, E: true, S: true, W: true } });
  placeCell(state.board, nbCell);
  state.explorers[1].x = 5;
  state.explorers[1].y = 5;
  state.explorers[1].hp = 7;
  state.explorers[2].x = 6;
  state.explorers[2].y = 5;
  state.explorers[2].hp = 5;
  resolvePeril(state, 'trap');
  assert.equal(state.explorers[1].hp, 6); // 7 - 1 = 6
  assert.equal(state.explorers[2].hp, 4); // 5 - 1 = 4
});

test('trap with Vigilance on tile does nothing', () => {
  const state = makeState();
  // scout (index 0) has vigilance
  const spikeCell = makeCell(5, 5, { type: 'piege_pics' });
  placeCell(state.board, spikeCell);
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].hp = 5;
  resolvePeril(state, 'trap');
  assert.equal(state.explorers[0].hp, 5); // no damage
});

// ── Wake ──────────────────────────────────────────────────────────────

test('wake calls wakeNearestGuardian', () => {
  const state = makeState();
  // Explorer at (0,0), nearest guardian anchor at (3,0) or (-3,0)
  const result = resolvePeril(state, 'wake');
  assert.ok(result.events.includes('wake'));
  assert.equal(state.guardians.inPlay, 1);
  assert.equal(state.guardians.available, 4);
});

// ── Activate ──────────────────────────────────────────────────────────

test('activate calls activateAllGuardians', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const hpBefore = state.explorers[0].hp;
  resolvePeril(state, 'activate');
  // Guardian on (0,0) attacks explorer on (0,0)
  assert.equal(state.explorers[0].hp, hpBefore - 1);
});

// ── Escaped/Dead explorers ─────────────────────────────────────────────

test('escaped explorer rolling wake treats as at entrance (position 0,0)', () => {
  const state = makeState();
  state.explorers[0].state = 'escaped';
  state.explorers[0].x = 99;
  state.explorers[0].y = 99;
  const result = resolvePeril(state, 'wake');
  assert.ok(result.events.includes('wake'));
  assert.equal(state.guardians.inPlay, 1);
  // Guardian should be placed at nearest anchor to (0,0), not (99,99)
  const anchorRight = getCell(state, 3, 0);
  const anchorLeft = getCell(state, -3, 0);
  assert.ok(
    anchorRight.guardians.length >= 1 || anchorLeft.guardians.length >= 1,
    'Guardian should be placed at an anchor reachable from (0,0)'
  );
});

test('dead explorer rolling activate still activates guardians', () => {
  const state = makeState();
  state.explorers[0].state = 'dead';
  state.explorers[1].x = 0;
  state.explorers[1].y = 0;
  state.explorers[1].state = 'active';
  const cell = getCell(state, 0, 0);
  spawnGuardian(state.guardians, cell);
  const hpNurse = state.explorers[2].hp;
  resolvePeril(state, 'activate');
  // Guardian attacks weakest active explorer on tile (nurse 5 < miner 7)
  assert.equal(state.explorers[2].hp, hpNurse - 1);
});

test('escaped explorer is not damaged by lava peril', () => {
  const state = makeState();
  state.explorers[0].state = 'escaped';
  state.explorers[0].x = 5;
  state.explorers[0].y = 5;
  state.explorers[0].hp = 5;
  const lavaCell = makeCell(5, 5, { type: 'lave' });
  placeCell(state.board, lavaCell);
  resolvePeril(state, 'lava');
  assert.equal(state.explorers[0].hp, 5); // no damage
});

// ── Dart double-hit prevention ────────────────────────────────────────

test('dart damage does not double-hit (explorer on tile adjacent to two dart traps only takes 1 HP, not 2)', () => {
  const state = makeState();
  state.currentExplorerIdx = 1; // miner — no vigilance
  // Explorer stands on normal tile at (5,5) with all walls open
  const center = makeCell(5, 5, { type: 'normale', walls: { N: true, E: true, S: true, W: true } });
  placeCell(state.board, center);
  // Dart trap to the East at (6,5), connected via E/W
  const dartEast = makeCell(6, 5, { type: 'piege_flechettes', walls: { N: true, E: true, S: true, W: true } });
  placeCell(state.board, dartEast);
  // Dart trap to the South at (5,6), connected via S/N
  const dartSouth = makeCell(5, 6, { type: 'piege_flechettes', walls: { N: true, E: true, S: true, W: true } });
  placeCell(state.board, dartSouth);
  state.explorers[1].x = 5;
  state.explorers[1].y = 5;
  state.explorers[1].hp = 7;
  resolvePeril(state, 'trap');
  // (5,5) is adjacent to both dart traps. Without dedup, explorer takes 2 HP.
  // With dedup (Set), explorer takes only 1 HP.
  assert.equal(state.explorers[1].hp, 6); // 7 - 1 = 6, NOT 7 - 2 = 5
});
