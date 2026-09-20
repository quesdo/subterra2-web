import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createGameState, getCell } from '../../src/engine/state.js';
import { areConnected, placeCell } from '../../src/engine/board.js';
import { DIRS, DIR_DELTA } from '../../src/engine/board.js';
import {
  hasAbility, hasScholar, hasAgile, hasVigilanceOnTile, hasSurvivor,
  canUseAbility, removeShield,
  useConsolidate, useGrenade, useDemolish, useAnnihilate, usePrepare,
  useHeal, useRevive, usePurify, useExcavate, useResearch, useAdventurer,
} from '../../src/engine/abilities.js';

function makeState(explorerIds = ['scout', 'miner', 'nurse']) {
  const state = createGameState({ explorerIds, difficulty: 'normal' });
  state.ap = 2;
  return state;
}

test('hasScholar returns true when active explorer has scholar', () => {
  const state = makeState(['aristocrat', 'miner', 'nurse']);
  assert.equal(hasScholar(state), true);
});

test('hasScholar returns false when active explorer does not have scholar', () => {
  const state = makeState(['scout', 'miner', 'nurse']);
  assert.equal(hasScholar(state), false);
});

test('hasAgile returns true when active explorer has agile', () => {
  const state = makeState(['thief', 'miner', 'nurse']);
  assert.equal(hasAgile(state), true);
});

test('hasVigilanceOnTile returns true when any explorer on tile has vigilance', () => {
  const state = makeState(['scout', 'miner', 'nurse']);
  state.explorers[0].x = 0; state.explorers[0].y = 0;
  state.explorers[1].x = 0; state.explorers[1].y = 0;
  assert.equal(hasVigilanceOnTile(state, 0, 0), true);
});

test('hasVigilanceOnTile returns false when no explorer on tile has vigilance', () => {
  const state = makeState(['miner', 'sniper', 'nurse']);
  state.explorers[0].x = 0; state.explorers[0].y = 0;
  assert.equal(hasVigilanceOnTile(state, 0, 0), false);
});

test('hasSurvivor returns true when explorer has survivor', () => {
  const state = makeState(['scout', 'miner', 'nurse']);
  assert.equal(hasSurvivor(state.explorers[2]), true); // nurse has survivor
});

test('canUseAbility returns false when not enough AP', () => {
  const state = makeState(['sniper', 'miner', 'nurse']);
  state.ap = 0;
  assert.equal(canUseAbility(state, 'snipe'), false);
});

test('canUseAbility returns false when on cooldown', () => {
  const state = makeState(['soldier', 'miner', 'nurse']);
  state.explorers[0].abilityCooldown.prepare = 1;
  assert.equal(canUseAbility(state, 'prepare'), false);
});

test('canUseAbility returns false when out of uses', () => {
  const state = makeState(['commander', 'miner', 'nurse']);
  state.explorers[0].abilityUsesLeft.research = 0;
  assert.equal(canUseAbility(state, 'research'), false);
});

test('canUseAbility returns false for downed explorer', () => {
  const state = makeState(['sniper', 'miner', 'nurse']);
  state.explorers[0].state = 'down';
  assert.equal(canUseAbility(state, 'snipe'), false);
});

test('removeShield removes shield from explorer', () => {
  const state = makeState();
  state.explorers[0].shielded = true;
  removeShield(state, state.explorers[0]);
  assert.equal(state.explorers[0].shielded, false);
});

test('useConsolidate makes tile normal and decrements uses', () => {
  const state = makeState(['miner', 'sniper', 'nurse']);
  const cell = getCell(state, 0, 0);
  cell.type = 'spikes';
  useConsolidate(state);
  assert.equal(cell.type, 'normal');
  assert.equal(cell.consolidated, true);
  assert.equal(state.explorers[0].abilityUsesLeft.consolidate, 3);
  assert.equal(state.ap, 1);
});

test('useGrenade eliminates ALL guardians on target tile', () => {
  const state = makeState(['sapper', 'miner', 'nurse']);
  const cell = getCell(state, 0, 0);
  cell.walls.E = true;
  const nb = { x: 1, y: 0, type: 'normal', walls: {N:true,E:true,S:true,W:true}, guardians: [{id:'G0'},{id:'G1'},{id:'G2'}] };
  placeCell(state.board, nb);
  state.guardians.inPlay = 3;
  state.guardians.available = 2;
  useGrenade(state, 1, 0);
  assert.equal(nb.guardians.length, 0);
  assert.equal(state.guardians.available, 5);
  assert.equal(state.guardians.inPlay, 0);
});

test('useDemolish destroys wall and decrements uses', () => {
  const state = makeState(['sapper', 'miner', 'nurse']);
  const cell = getCell(state, 0, 0);
  cell.walls.E = false;
  const nb = { x: 1, y: 0, type: 'normal', walls: {N:true,E:true,S:true,W:false}, guardians: [] };
  placeCell(state.board, nb);
  useDemolish(state, 'E');
  assert.equal(cell.walls.E, true);
  assert.equal(nb.walls.W, true);
  assert.equal(state.explorers[0].abilityUsesLeft.demolish, 2);
});

test('useAnnihilate removes 1 guardian from current tile', () => {
  const state = makeState(['soldier', 'miner', 'nurse']);
  const cell = getCell(state, 0, 0);
  cell.guardians = [{id:'G0'}, {id:'G1'}];
  state.guardians.inPlay = 2;
  state.guardians.available = 3;
  useAnnihilate(state);
  assert.equal(cell.guardians.length, 1);
  assert.equal(state.guardians.available, 4);
});

test('usePrepare sets shield and cooldown', () => {
  const state = makeState(['soldier', 'miner', 'nurse']);
  usePrepare(state);
  assert.equal(state.explorers[0].shielded, true);
  assert.equal(state.explorers[0].abilityCooldown.prepare, 2);
});

test('usePrepare cannot be used on next turn (cooldown check)', () => {
  const state = makeState(['soldier', 'miner', 'nurse']);
  usePrepare(state);
  state.explorers[0].abilityCooldown.prepare = 1;
  assert.equal(canUseAbility(state, 'prepare'), false);
});

test('useHeal heals 2 HP (not 1)', () => {
  const state = makeState(['nurse', 'miner', 'sniper']);
  state.explorers[1].hp = 5;
  state.explorers[1].x = 0; state.explorers[1].y = -1;
  const cell = getCell(state, 0, 0);
  const nb = getCell(state, 0, -1);
  if (nb) {
    cell.walls.N = true;
    nb.walls.S = true;
  }
  useHeal(state, 'miner');
  assert.equal(state.explorers[1].hp, 7);
});

test('useRevive heals downed explorer by 1 HP', () => {
  const state = makeState(['priestess', 'miner', 'nurse']);
  state.explorers[1].state = 'down';
  state.explorers[1].hp = 0;
  useRevive(state, 'miner');
  assert.equal(state.explorers[1].hp, 1);
  assert.equal(state.explorers[1].state, 'active');
});

test('useRevive heals active explorer by 3 PV', () => {
  const state = makeState(['priestess', 'miner', 'nurse']);
  state.explorers[1].hp = 3; // miner maxHp=7, so 3+3=6 < 7
  useRevive(state, 'miner');
  assert.equal(state.explorers[1].hp, 6);
});

test('usePurify eliminates all guardians on another tile', () => {
  const state = makeState(['priestess', 'miner', 'nurse']);
  const nb = { x: 1, y: 0, type: 'normal', walls: {N:true,E:true,S:true,W:true}, guardians: [{id:'G0'},{id:'G1'}] };
  placeCell(state.board, nb);
  state.guardians.inPlay = 2;
  state.guardians.available = 3;
  usePurify(state, 1, 0);
  assert.equal(nb.guardians.length, 0);
  assert.equal(state.guardians.available, 5);
});

test('useAdventurer costs 1 HP (not AP)', () => {
  const state = makeState(['aristocrat', 'miner', 'nurse']);
  const hpBefore = state.explorers[0].hp;
  const apBefore = state.ap;
  useAdventurer(state);
  assert.equal(state.explorers[0].hp, hpBefore - 1);
  assert.equal(state.ap, apBefore); // AP unchanged
});

test('useAdventurer damage not blocked by shield', () => {
  const state = makeState(['aristocrat', 'miner', 'nurse']);
  state.explorers[0].shielded = true;
  const hpBefore = state.explorers[0].hp;
  useAdventurer(state);
  assert.equal(state.explorers[0].hp, hpBefore - 1);
});

test('useExcavate removes rubble for 1 AP total (not 3)', () => {
  const state = makeState(['miner', 'sniper', 'nurse']);
  const cell = getCell(state, 0, 0);
  cell.rubble = true;
  useExcavate(state, 0, 0);
  assert.equal(cell.rubble, false);
  assert.equal(state.ap, 1); // 2 - 1 = 1, NOT 2 - 1 - 2 = -1
});
