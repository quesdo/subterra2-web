import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState } from '../../src/engine/state.js';
import {
  checkEndConditions,
  getMedal,
  isAllDown,
  isAllDeadOrEscaped,
  canStillPlay,
} from '../../src/engine/endgame.js';

function makeTestState() {
  return createGameState({
    explorerIds: ['scout', 'miner', 'nurse'],
    difficulty: 'normal',
  });
}

// --- checkEndConditions: game ongoing ---

test('checkEndConditions returns false when game is ongoing', () => {
  const state = makeTestState();
  assert.equal(checkEndConditions(state), false);
  assert.equal(state.winner, null);
  assert.equal(state.medal, null);
});

// --- checkEndConditions: victory ---

test('checkEndConditions sets winner=players when artifactEscaped is true', () => {
  const state = makeTestState();
  state.artifactEscaped = true;
  assert.equal(checkEndConditions(state), true);
  assert.equal(state.winner, 'players');
  assert.equal(state.medal, 'Légendaire');
});

test('checkEndConditions sets medal=Légendaire when all explorers survived', () => {
  const state = makeTestState();
  state.artifactEscaped = true;
  checkEndConditions(state);
  assert.equal(state.medal, 'Légendaire');
});

test('checkEndConditions sets medal=Or when 1 explorer is dead', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.artifactEscaped = true;
  checkEndConditions(state);
  assert.equal(state.winner, 'players');
  assert.equal(state.medal, 'Or');
});

test('checkEndConditions sets medal=Argent when 2 explorers are dead', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'dead';
  state.artifactEscaped = true;
  checkEndConditions(state);
  assert.equal(state.winner, 'players');
  assert.equal(state.medal, 'Argent');
});

test('checkEndConditions sets medal=Bronze when 3+ explorers are dead', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'dead';
  state.explorers[2].state = 'dead';
  state.artifactEscaped = true;
  checkEndConditions(state);
  assert.equal(state.winner, 'players');
  assert.equal(state.medal, 'Bronze');
});

// --- checkEndConditions: defeat ---

test('checkEndConditions sets winner=game when all explorers are dead', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'dead';
  state.explorers[2].state = 'dead';
  assert.equal(checkEndConditions(state), true);
  assert.equal(state.winner, 'game');
  assert.equal(state.medal, null);
});

test('checkEndConditions sets winner=game when all explorers are down', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'down';
  state.explorers[2].state = 'down';
  assert.equal(checkEndConditions(state), true);
  assert.equal(state.winner, 'game');
  assert.equal(state.medal, null);
});

test('checkEndConditions sets winner=game when all are dead or escaped', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'escaped';
  state.explorers[2].state = 'dead';
  assert.equal(checkEndConditions(state), true);
  assert.equal(state.winner, 'game');
  assert.equal(state.medal, null);
});

test('checkEndConditions sets winner=game and medal=Oubliés à jamais when artifact swallowed by lava', () => {
  const state = makeTestState();
  state.artifactSwallowed = true;
  assert.equal(checkEndConditions(state), true);
  assert.equal(state.winner, 'game');
  assert.equal(state.medal, 'Oubliés à jamais');
});

// --- getMedal ---

test('getMedal returns correct values for 0,1,2,3+ dead', () => {
  const state = makeTestState();

  state.explorers.forEach(e => { e.state = 'active'; });
  assert.equal(getMedal(state), 'Légendaire');

  state.explorers[0].state = 'dead';
  assert.equal(getMedal(state), 'Or');

  state.explorers[1].state = 'dead';
  assert.equal(getMedal(state), 'Argent');

  state.explorers[2].state = 'dead';
  assert.equal(getMedal(state), 'Bronze');
});

// --- isAllDown ---

test('isAllDown returns true when all active explorers are down', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'down';
  state.explorers[2].state = 'down';
  assert.equal(isAllDown(state), true);
});

test('isAllDown returns false when at least one is active', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'down';
  state.explorers[2].state = 'active';
  assert.equal(isAllDown(state), false);
});

test('isAllDown returns false when everyone is dead (different condition)', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'dead';
  state.explorers[2].state = 'dead';
  assert.equal(isAllDown(state), false);
});

test('isAllDown returns false when some are escaped (no in-play explorers is allDeadOrEscaped, not allDown)', () => {
  const state = makeTestState();
  state.explorers[0].state = 'escaped';
  state.explorers[1].state = 'escaped';
  state.explorers[2].state = 'escaped';
  assert.equal(isAllDown(state), false);
});

// --- isAllDeadOrEscaped ---

test('isAllDeadOrEscaped returns true when all are dead or escaped', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'escaped';
  state.explorers[2].state = 'dead';
  assert.equal(isAllDeadOrEscaped(state), true);
});

test('isAllDeadOrEscaped returns false when some are active or down', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'active';
  state.explorers[2].state = 'down';
  assert.equal(isAllDeadOrEscaped(state), false);
});

// --- canStillPlay ---

test('canStillPlay returns true when at least one active explorer exists', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'dead';
  state.explorers[2].state = 'active';
  assert.equal(canStillPlay(state), true);
});

test('canStillPlay returns false when all are dead', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'dead';
  state.explorers[2].state = 'dead';
  assert.equal(canStillPlay(state), false);
});

test('canStillPlay returns false when all are dead or escaped', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  state.explorers[1].state = 'escaped';
  state.explorers[2].state = 'dead';
  assert.equal(canStillPlay(state), false);
});

test('canStillPlay returns true when some are down but one is active', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'down';
  state.explorers[2].state = 'active';
  assert.equal(canStillPlay(state), true);
});

test('canStillPlay returns false when all in-play are down (no active)', () => {
  const state = makeTestState();
  state.explorers[0].state = 'down';
  state.explorers[1].state = 'down';
  state.explorers[2].state = 'down';
  assert.equal(canStillPlay(state), false);
});

// --- Escaped explorers count as survived ---

test('Escaped explorers count as survived (not dead) for medal calculation', () => {
  const state = makeTestState();
  state.explorers[0].state = 'escaped';
  state.explorers[1].state = 'escaped';
  state.explorers[2].state = 'escaped';
  state.artifactEscaped = true;
  checkEndConditions(state);
  assert.equal(state.winner, 'players');
  assert.equal(state.medal, 'Légendaire');
});
