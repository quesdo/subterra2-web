import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState, getCell } from '../../src/engine/state.js';
import { placeCell } from '../../src/engine/board.js';
import { tryPlaceSanctuary, placeKeyOnSanctuary, retrieveArtifact, isSanctuaryUnlocked } from '../../src/engine/artefact.js';

function makeState() {
  const state = createGameState({ explorerIds: ['scout', 'miner', 'nurse'], difficulty: 'normal' });
  state.ap = 2;
  return state;
}

function makeStateWithTiles() {
  const state = makeState();
  state.tileBag = [];
  // Add a tile far from entry so sanctuary can be placed there
  const farTile = { x: 5, y: 0, type: 'normal', walls: {N:true,E:true,S:true,W:true}, guardians: [] };
  placeCell(state.board, farTile);
  // Connect it to entry with intermediate tiles
  for (let i = 1; i < 5; i++) {
    const t = { x: i, y: 0, type: 'normal', walls: {N:true,E:true,S:true,W:true}, guardians: [] };
    placeCell(state.board, t);
  }
  // Connect entry to the chain
  const entryBot = getCell(state, 0, 0);
  if (entryBot) entryBot.walls.E = true;
  const t1 = getCell(state, 1, 0);
  if (t1) t1.walls.W = true;
  return state;
}

test('tryPlaceSanctuary does nothing when bag is not empty', () => {
  const state = makeState();
  const result = tryPlaceSanctuary(state);
  assert.equal(result, false);
});

test('tryPlaceSanctuary places sanctuary when bag is empty', () => {
  const state = makeStateWithTiles();
  tryPlaceSanctuary(state);
  assert.ok(state.sanctuary);
});

test('placeKeyOnSanctuary increments counter', () => {
  const state = makeStateWithTiles();
  tryPlaceSanctuary(state);
  state.explorers[0].item = 'key';
  state.explorers[0].x = state.sanctuary.x;
  state.explorers[0].y = state.sanctuary.y;
  placeKeyOnSanctuary(state);
  assert.equal(state.keysPlacedOnSanctuary, 1);
  assert.equal(state.explorers[0].item, null);
});

test('placeKeyOnSanctuary at 3 unlocks and places artifact', () => {
  const state = makeStateWithTiles();
  tryPlaceSanctuary(state);
  state.explorers[0].x = state.sanctuary.x;
  state.explorers[0].y = state.sanctuary.y;
  state.ap = 3;
  state.explorers[0].item = 'key';
  placeKeyOnSanctuary(state);
  state.explorers[0].item = 'key';
  placeKeyOnSanctuary(state);
  state.explorers[0].item = 'key';
  placeKeyOnSanctuary(state);
  assert.equal(state.keysPlacedOnSanctuary, 3);
  assert.equal(state.artifactOnSanctuary, true);
  assert.equal(isSanctuaryUnlocked(state), true);
});

test('retrieveArtifact sets explorer item and curse', () => {
  const state = makeStateWithTiles();
  tryPlaceSanctuary(state);
  state.explorers[0].x = state.sanctuary.x;
  state.explorers[0].y = state.sanctuary.y;
  state.artifactOnSanctuary = true;
  retrieveArtifact(state);
  assert.equal(state.explorers[0].item, 'artifact');
  assert.equal(state.artifactRetrieved, true);
});

test('retrieveArtifact activates curse (cursed=true on volcano)', () => {
  const state = makeStateWithTiles();
  tryPlaceSanctuary(state);
  state.explorers[0].x = state.sanctuary.x;
  state.explorers[0].y = state.sanctuary.y;
  state.artifactOnSanctuary = true;
  retrieveArtifact(state);
  assert.equal(state.curseActive, true);
  assert.equal(state.volcano.cursed, true);
});

test('isSanctuaryUnlocked returns false initially', () => {
  const state = makeState();
  assert.equal(isSanctuaryUnlocked(state), false);
});
