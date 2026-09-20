import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PERIL_FACES, PERIL_DIE, rollPeril, rollDie } from '../../src/engine/perils.js';

test('PERIL_DIE has exactly 6 entries', () => {
  assert.equal(PERIL_DIE.length, 6);
});

test('PERIL_FACES has all 6 keys: stumble, lava, collapse, trap, wake, activate', () => {
  const expectedKeys = ['stumble', 'lava', 'collapse', 'trap', 'wake', 'activate'];
  assert.deepEqual(Object.keys(PERIL_FACES).sort(), expectedKeys.sort());
});

test('Each face has correct id, label, glyph', () => {
  const expected = [
    { id: 'stumble',   label: 'Trébucher',          glyph: '🤕' },
    { id: 'lava',      label: 'Lave',               glyph: '🌋' },
    { id: 'collapse',  label: 'Effondrement',        glyph: '💥' },
    { id: 'trap',      label: 'Déclencher un piège',  glyph: '⚔' },
    { id: 'wake',      label: 'Réveiller un Gardien', glyph: '👁' },
    { id: 'activate',  label: 'Activer les Gardiens', glyph: '🔃' },
  ];
  for (const exp of expected) {
    const face = PERIL_FACES[exp.id];
    assert.ok(face, `Face ${exp.id} should exist`);
    assert.equal(face.id, exp.id);
    assert.equal(face.label, exp.label);
    assert.equal(face.glyph, exp.glyph);
  }
});

test('rollPeril returns one of the 6 valid face IDs', () => {
  const validIds = new Set(PERIL_DIE);
  for (let i = 0; i < 1000; i++) {
    const result = rollPeril();
    assert.ok(validIds.has(result), `rollPeril returned invalid face: ${result}`);
  }
});

test('rollDie returns 1-6', () => {
  for (let i = 0; i < 1000; i++) {
    const result = rollDie();
    assert.ok(result >= 1 && result <= 6, `rollDie returned out of range: ${result}`);
    assert.equal(result, Math.floor(result), `rollDie should return integer: ${result}`);
  }
});

test('rollDie can produce all values 1 through 6', () => {
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    seen.add(rollDie());
  }
  for (const v of [1, 2, 3, 4, 5, 6]) {
    assert.ok(seen.has(v), `rollDie never produced ${v}`);
  }
});

test('rollPeril can produce all 6 face IDs', () => {
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    seen.add(rollPeril());
  }
  for (const id of PERIL_DIE) {
    assert.ok(seen.has(id), `rollPeril never produced ${id}`);
  }
});

test('Damage amounts: spikes=3, collapse=5, lava=1, darts=1', () => {
  assert.equal(PERIL_FACES.trap.damage.spikes, 3);
  assert.equal(PERIL_FACES.trap.damage.darts, 1);
  assert.equal(PERIL_FACES.collapse.damage, 5);
  assert.equal(PERIL_FACES.lava.damage, 1);
});

test('stumble damage is 1 and marked conditional', () => {
  assert.equal(PERIL_FACES.stumble.damage, 1);
  assert.equal(PERIL_FACES.stumble.conditional, true);
});

test('wake and activate have 0 damage (placement/activation, not damage)', () => {
  assert.equal(PERIL_FACES.wake.damage, 0);
  assert.equal(PERIL_FACES.activate.damage, 0);
});
