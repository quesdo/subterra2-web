import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createGameState,
  createGuardianPool,
  spawnGuardian,
  removeGuardian,
  removeAllGuardians,
  serialize,
  deserialize,
  log,
  getActiveExplorer,
  getExplorerAt,
  damage,
  heal,
} from '../../src/engine/state.js';

function makeTestState() {
  return createGameState({
    explorerIds: ['scout', 'miner', 'nurse'],
    difficulty: 'normal',
  });
}

test('createGameState creates valid game state', () => {
  const state = makeTestState();
  assert.equal(state.turn, 1);
  assert.equal(state.phase, 'explorerTurn');
  assert.equal(state.currentExplorerIdx, 0);
  assert.equal(state.explorers.length, 3);
  assert.equal(state.tileBag.length, 30);
  assert.equal(state.journalBag.length, 3);
  assert.equal(state.winner, null);
  assert.equal(state.medal, null);
  assert.equal(state.sanctuary, null);
});

test('createGameState sets correct eruption position for 3 explorers normal', () => {
  const state = makeTestState();
  assert.equal(state.volcano.position, 26);
});

test('createGameState sets correct eruption position for 4 explorers beginner', () => {
  const state = createGameState({
    explorerIds: ['scout', 'miner', 'nurse', 'sniper'],
    difficulty: 'beginner',
  });
  assert.equal(state.volcano.position, 22);
});

test('createGameState throws for < 3 explorers', () => {
  assert.throws(() => createGameState({ explorerIds: ['scout', 'miner'] }));
});

test('createGameState throws for > 6 explorers', () => {
  assert.throws(() => createGameState({
    explorerIds: ['scout', 'miner', 'nurse', 'sniper', 'sapper', 'soldier', 'commander'],
  }));
});

test('explorers start on entry tile (0,0)', () => {
  const state = makeTestState();
  for (const e of state.explorers) {
    assert.equal(e.x, 0);
    assert.equal(e.y, 0);
    assert.equal(e.state, 'active');
  }
});

test('explorers have correct HP from their definitions', () => {
  const state = makeTestState();
  assert.equal(state.explorers[0].hp, 5); // scout
  assert.equal(state.explorers[1].hp, 7); // miner
  assert.equal(state.explorers[2].hp, 5); // nurse
});

test('explorers have abilityUsesLeft set from ability definitions', () => {
  const state = createGameState({
    explorerIds: ['commander', 'miner', 'sapper'],
    difficulty: 'normal',
  });
  // commander has research (3 uses)
  assert.equal(state.explorers[0].abilityUsesLeft.research, 3);
  // miner has consolidate (4 uses)
  assert.equal(state.explorers[1].abilityUsesLeft.consolidate, 4);
  // sapper has demolish (3 uses)
  assert.equal(state.explorers[2].abilityUsesLeft.demolish, 3);
});

test('guardian pool starts with 5 available, 0 in play', () => {
  const pool = createGuardianPool(5);
  assert.equal(pool.available, 5);
  assert.equal(pool.inPlay, 0);
});

test('spawnGuardian decreases available, increases inPlay', () => {
  const pool = createGuardianPool(5);
  const cell = { x: 1, y: 0, guardians: [] };
  const g = spawnGuardian(pool, cell);
  assert.ok(g);
  assert.equal(pool.available, 4);
  assert.equal(pool.inPlay, 1);
  assert.equal(cell.guardians.length, 1);
  assert.equal(g.activatedThisPhase, false);
});

test('spawnGuardian returns null when pool is empty', () => {
  const pool = createGuardianPool(1);
  const cell = { x: 0, y: 0, guardians: [] };
  spawnGuardian(pool, cell);
  const g2 = spawnGuardian(pool, cell);
  assert.equal(g2, null);
  assert.equal(pool.available, 0);
});

test('removeGuardian returns guardian to pool', () => {
  const pool = createGuardianPool(5);
  const cell = { x: 0, y: 0, guardians: [] };
  spawnGuardian(pool, cell);
  const g = removeGuardian(pool, cell);
  assert.ok(g);
  assert.equal(pool.available, 5);
  assert.equal(pool.inPlay, 0);
  assert.equal(cell.guardians.length, 0);
});

test('removeAllGuardians returns all to pool', () => {
  const pool = createGuardianPool(5);
  const cell = { x: 0, y: 0, guardians: [] };
  spawnGuardian(pool, cell);
  spawnGuardian(pool, cell);
  spawnGuardian(pool, cell);
  const n = removeAllGuardians(pool, cell);
  assert.equal(n, 3);
  assert.equal(pool.available, 5);
  assert.equal(pool.inPlay, 0);
});

test('serialize/deserialize round-trips correctly', () => {
  const state = makeTestState();
  state.explorers[0].hp = 3;
  state.volcano.position = 10;
  const json = serialize(state);
  const restored = deserialize(json);
  assert.equal(restored.turn, 1);
  assert.equal(restored.explorers[0].hp, 3);
  assert.equal(restored.volcano.position, 10);
  assert.equal(restored.tileBag.length, 30);
});

test('log adds messages to state log', () => {
  const state = makeTestState();
  log(state, 'Test message');
  assert.equal(state.log.length, 1);
  assert.equal(state.log[0], 'Test message');
});

test('getActiveExplorer returns current explorer', () => {
  const state = makeTestState();
  const active = getActiveExplorer(state);
  assert.equal(active.id, 'scout');
  state.currentExplorerIdx = 1;
  assert.equal(getActiveExplorer(state).id, 'miner');
});

test('damage reduces HP', () => {
  const state = makeTestState();
  damage(state, state.explorers[0], 2, 'test');
  assert.equal(state.explorers[0].hp, 3);
  assert.equal(state.explorers[0].state, 'active');
});

test('damage to 0 HP sets state to down', () => {
  const state = makeTestState();
  damage(state, state.explorers[0], 5, 'test');
  assert.equal(state.explorers[0].hp, 0);
  assert.equal(state.explorers[0].state, 'down');
});

test('damage blocked by shield (except push)', () => {
  const state = makeTestState();
  state.explorers[0].shielded = true;
  const downed = damage(state, state.explorers[0], 3, 'trap');
  assert.equal(downed, false);
  assert.equal(state.explorers[0].hp, 5);
});

test('damage not blocked by shield when source is push', () => {
  const state = makeTestState();
  state.explorers[0].shielded = true;
  damage(state, state.explorers[0], 1, 'push');
  assert.equal(state.explorers[0].hp, 4);
});

test('heal increases HP up to max', () => {
  const state = makeTestState();
  damage(state, state.explorers[0], 2, 'test');
  heal(state, state.explorers[0], 1);
  assert.equal(state.explorers[0].hp, 4);
  heal(state, state.explorers[0], 10);
  assert.equal(state.explorers[0].hp, 5);
});

test('heal revives downed explorer', () => {
  const state = makeTestState();
  damage(state, state.explorers[0], 5, 'test');
  assert.equal(state.explorers[0].state, 'down');
  heal(state, state.explorers[0], 1);
  assert.equal(state.explorers[0].state, 'active');
  assert.equal(state.explorers[0].hp, 1);
});

test('damage does not affect dead or escaped explorers', () => {
  const state = makeTestState();
  state.explorers[0].state = 'dead';
  damage(state, state.explorers[0], 3, 'test');
  assert.equal(state.explorers[0].hp, 5);

  state.explorers[1].state = 'escaped';
  damage(state, state.explorers[1], 3, 'test');
  assert.equal(state.explorers[1].hp, 7);
});
