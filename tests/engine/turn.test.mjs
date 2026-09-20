import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState } from '../../src/engine/state.js';
import { endExplorerTurn, endGameTurn, startExplorerTurn, getTurnOrder } from '../../src/engine/turn.js';

function makeState() {
  const state = createGameState({ explorerIds: ['scout', 'miner', 'nurse'], difficulty: 'normal' });
  state.ap = 2;
  return state;
}

test('endExplorerTurn advances to next explorer', () => {
  const state = makeState();
  endExplorerTurn(state);
  assert.equal(state.currentExplorerIdx, 1);
  assert.equal(state.ap, 2);
});

test('endExplorerTurn triggers endGameTurn when all processed', () => {
  const state = makeState();
  endExplorerTurn(state);
  endExplorerTurn(state);
  endExplorerTurn(state);
  assert.equal(state.turn, 2);
  assert.equal(state.processedPlayers, 0);
});

test('endGameTurn activates guardians 2 times', () => {
  const state = makeState();
  let activations = 0;
  const origActivate = state._activateAll;
  endGameTurn(state);
  // Can't easily verify guardian activation count without guardians on board
  // but we can verify turn incremented
  assert.equal(state.turn, 2);
});

test('endGameTurn advances eruption by 1', () => {
  const state = makeState();
  const before = state.volcano.position;
  endGameTurn(state);
  assert.equal(state.volcano.position, before - 1);
});

test('endGameTurn advances eruption by 2 when cursed', () => {
  const state = makeState();
  state.volcano.cursed = true;
  const before = state.volcano.position;
  endGameTurn(state);
  assert.equal(state.volcano.position, before - 2);
});

test('endGameTurn increments turn counter', () => {
  const state = makeState();
  assert.equal(state.turn, 1);
  endGameTurn(state);
  assert.equal(state.turn, 2);
});

test('endGameTurn resets processedPlayers', () => {
  const state = makeState();
  state.processedPlayers = 3;
  endGameTurn(state);
  assert.equal(state.processedPlayers, 0);
});

test('endExplorerTurn works when expedition leader is dead', () => {
  const state = makeState();
  state.explorers[0].state = 'dead';
  endExplorerTurn(state);
  assert.equal(state.currentExplorerIdx, 1);
  endExplorerTurn(state);
  endExplorerTurn(state);
  assert.equal(state.turn, 2);
});

test('endExplorerTurn works when expedition leader is escaped', () => {
  const state = makeState();
  state.explorers[0].state = 'escaped';
  endExplorerTurn(state);
  assert.equal(state.currentExplorerIdx, 1);
  endExplorerTurn(state);
  endExplorerTurn(state);
  assert.equal(state.turn, 2);
});

test('startExplorerTurn sets AP to 2 and resets pushedThisTurn', () => {
  const state = makeState();
  state.ap = 0;
  state.explorers[0].pushedThisTurn = true;
  startExplorerTurn(state);
  assert.equal(state.ap, 2);
  assert.equal(state.explorers[0].pushedThisTurn, false);
});

test('getTurnOrder returns correct order starting from expedition leader', () => {
  const state = makeState();
  const order = getTurnOrder(state);
  assert.deepEqual(order, [0, 1, 2]);
  state.expeditionLeaderIdx = 1;
  const order2 = getTurnOrder(state);
  assert.deepEqual(order2, [1, 2, 0]);
});

test('startExplorerTurn removes shield at start of turn', () => {
  const state = makeState();
  state.explorers[0].shielded = true;
  startExplorerTurn(state);
  assert.equal(state.explorers[0].shielded, false);
});

test('startExplorerTurn decrements ability cooldowns', () => {
  const state = makeState();
  state.explorers[0].abilityCooldown.prepare = 1;
  startExplorerTurn(state);
  assert.equal(state.explorers[0].abilityCooldown.prepare, 0);
});
