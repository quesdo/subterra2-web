import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState, getCell } from '../../src/engine/state.js';
import { createBoard, placeCell, areConnected } from '../../src/engine/board.js';
import { spendAP, canDoAction, push, performHeal, attack, performAttackWithRoll, dig, manageObject, crawl } from '../../src/engine/actions.js';

function makeState() {
  const state = createGameState({ explorerIds: ['scout', 'miner', 'nurse'], difficulty: 'normal' });
  state.ap = 2;
  return state;
}

test('spendAP decrements AP correctly', () => {
  const state = makeState();
  spendAP(state, 1);
  assert.equal(state.ap, 1);
  spendAP(state, 1);
  assert.equal(state.ap, 0);
});

test('spendAP throws when insufficient AP', () => {
  const state = makeState();
  state.ap = 0;
  assert.throws(() => spendAP(state, 1));
});

test('canDoAction returns false when not enough AP', () => {
  const state = makeState();
  state.ap = 0;
  assert.equal(canDoAction(state, 'reveal'), false);
});

test('canDoAction returns false for downed explorer (non-crawl)', () => {
  const state = makeState();
  state.explorers[0].state = 'down';
  assert.equal(canDoAction(state, 'reveal'), false);
  assert.equal(canDoAction(state, 'crawl'), true);
});

test('push costs 1 HP and grants 1 AP', () => {
  const state = makeState();
  const hpBefore = state.explorers[0].hp;
  push(state);
  assert.equal(state.explorers[0].hp, hpBefore - 1);
  assert.equal(state.ap, 3);
  assert.equal(state.explorers[0].pushedThisTurn, true);
});

test('push can only be used once per turn', () => {
  const state = makeState();
  push(state);
  const result = push(state);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'already_pushed');
});

test('push to 0 HP sets phase to perilPhase', () => {
  const state = makeState();
  state.explorers[0].hp = 1;
  push(state);
  assert.equal(state.explorers[0].state, 'down');
  assert.equal(state.phase, 'perilPhase');
});

test('push damage not blocked by shield', () => {
  const state = makeState();
  state.explorers[0].shielded = true;
  const hpBefore = state.explorers[0].hp;
  push(state);
  assert.equal(state.explorers[0].hp, hpBefore - 1);
});

test('performHeal self restores 1 HP', () => {
  const state = makeState();
  state.explorers[0].hp = 3;
  performHeal(state, 'scout');
  assert.equal(state.explorers[0].hp, 4);
  assert.equal(state.ap, 1);
});

test('performHeal cannot exceed max HP', () => {
  const state = makeState();
  state.explorers[0].hp = 5;
  performHeal(state, 'scout');
  assert.equal(state.explorers[0].hp, 5);
});

test('performHeal ally on same tile restores 1 HP', () => {
  const state = makeState();
  state.explorers[1].hp = 5;
  state.explorers[1].x = 0; state.explorers[1].y = 0;
  performHeal(state, 'miner');
  assert.equal(state.explorers[1].hp, 6);
});

test('attack with roll >= 4 eliminates guardian', () => {
  const state = makeState();
  const cell = { x: 0, y: 0, type: 'entry', walls: {N:true,E:true,S:true,W:true}, guardians: [{id:'G0'}] };
  state.board.cells.set('0,0', cell);
  state.guardians.inPlay = 1;
  state.guardians.available = 4;
  performAttackWithRoll(state, 5);
  assert.equal(cell.guardians.length, 0);
  assert.equal(state.guardians.available, 5);
});

test('attack with roll < 4 does nothing', () => {
  const state = makeState();
  const cell = { x: 0, y: 0, type: 'entry', walls: {N:true,E:true,S:true,W:true}, guardians: [{id:'G0'}] };
  state.board.cells.set('0,0', cell);
  state.guardians.inPlay = 1;
  state.guardians.available = 4;
  performAttackWithRoll(state, 2);
  assert.equal(cell.guardians.length, 1);
});

test('manageObject picks up key from tile', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  cell.keyMarker = true;
  manageObject(state, 'pickup');
  assert.equal(state.explorers[0].item, 'key');
  assert.equal(cell.keyMarker, false);
  assert.equal(state.ap, 1);
});

test('manageObject cannot pick up if already holding', () => {
  const state = makeState();
  state.explorers[0].item = 'key';
  const result = manageObject(state, 'pickup');
  assert.equal(result.ok, false);
});

test('manageObject drops item on tile', () => {
  const state = makeState();
  state.explorers[0].item = 'key';
  manageObject(state, 'drop');
  assert.equal(state.explorers[0].item, null);
  assert.equal(getCell(state, 0, 0).keyMarker, true);
});

test('manageObject gives item to another explorer on same tile', () => {
  const state = makeState();
  state.explorers[0].item = 'key';
  state.explorers[1].x = 0; state.explorers[1].y = 0;
  manageObject(state, 'give', 'miner');
  assert.equal(state.explorers[0].item, null);
  assert.equal(state.explorers[1].item, 'key');
});

test('manageObject takes item from another explorer on same tile', () => {
  const state = makeState();
  state.explorers[1].item = 'key';
  state.explorers[1].x = 0; state.explorers[1].y = 0;
  manageObject(state, 'take', 'miner');
  assert.equal(state.explorers[0].item, 'key');
  assert.equal(state.explorers[1].item, null);
});

test('artifact on ground can be picked up', () => {
  const state = makeState();
  state.artifactOnGround = { x: 0, y: 0 };
  manageObject(state, 'pickup');
  assert.equal(state.explorers[0].item, 'artifact');
  assert.equal(state.artifactOnGround, null);
});

test('dig removes rubble, costs 2 AP', () => {
  const state = makeState();
  const cell = getCell(state, 0, 0);
  cell.rubble = true;
  dig(state, 0, 0);
  assert.equal(cell.rubble, false);
  assert.equal(state.ap, 0);
});

test('downed explorer can only crawl', () => {
  const state = makeState();
  state.explorers[0].state = 'down';
  assert.equal(canDoAction(state, 'crawl'), true);
  assert.equal(canDoAction(state, 'reveal'), false);
  assert.equal(canDoAction(state, 'attack'), false);
});
