import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  TEMPLE_TILES,
  JOURNAL_TILES,
  ENTRY_TILE,
  LATERAL_TILES,
  SANCTUARY_TILE,
} from '../../src/engine/tiles.js';

test('TEMPLE_TILES has exactly 30 tiles', () => {
  assert.equal(TEMPLE_TILES.length, 30);
});

test('JOURNAL_TILES has exactly 3 tiles', () => {
  assert.equal(JOURNAL_TILES.length, 3);
});

test('tile type counts match the spec', () => {
  const counts = {};
  for (const t of TEMPLE_TILES) {
    counts[t.type] = (counts[t.type] || 0) + 1;
  }
  assert.equal(counts['normale'], 3);
  assert.equal(counts['pont'], 2);
  assert.equal(counts['cle'], 3);
  assert.equal(counts['lave'], 5);
  assert.equal(counts['piege_pics'], 3);
  assert.equal(counts['piege_flechettes'], 4);
  assert.equal(counts['ruines'], 6);
  assert.equal(counts['gardien'], 4);
});

test('each Ruines tile has a unique ruinsNum from 1-6', () => {
  const ruins = TEMPLE_TILES.filter(t => t.type === 'ruines');
  assert.equal(ruins.length, 6);
  const nums = ruins.map(t => t.ruinsNum).sort((a, b) => a - b);
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6]);
});

test('journal tiles are NOT in TEMPLE_TILES', () => {
  const templeIds = new Set(TEMPLE_TILES.map(t => t.id));
  for (const j of JOURNAL_TILES) {
    assert.ok(!templeIds.has(j.id), `journal tile ${j.id} should not be in TEMPLE_TILES`);
  }
});

test('every temple tile has an id and type', () => {
  for (const t of TEMPLE_TILES) {
    assert.ok(t.id, 'tile should have an id');
    assert.ok(t.type, 'tile should have a type');
  }
});

test('every tile has a walls object with N/E/S/W keys', () => {
  for (const t of TEMPLE_TILES) {
    assert.ok(t.walls, `tile ${t.id} should have walls`);
    assert.equal(typeof t.walls.N, 'boolean', `tile ${t.id} walls.N should be boolean`);
    assert.equal(typeof t.walls.E, 'boolean', `tile ${t.id} walls.E should be boolean`);
    assert.equal(typeof t.walls.S, 'boolean', `tile ${t.id} walls.S should be boolean`);
    assert.equal(typeof t.walls.W, 'boolean', `tile ${t.id} walls.W should be boolean`);
  }
  for (const t of JOURNAL_TILES) {
    assert.ok(t.walls, `journal tile ${t.id} should have walls`);
    assert.equal(typeof t.walls.N, 'boolean');
    assert.equal(typeof t.walls.E, 'boolean');
    assert.equal(typeof t.walls.S, 'boolean');
    assert.equal(typeof t.walls.W, 'boolean');
  }
});

test('ENTRY_TILE is type entry with 2 cells', () => {
  assert.equal(ENTRY_TILE.type, 'entry');
  assert.ok(ENTRY_TILE.cells, 'ENTRY_TILE should have cells');
  assert.equal(ENTRY_TILE.cells.length, 2);
});

test('LATERAL_TILES has 2 tiles of type lateral with guardianAnchor', () => {
  assert.equal(LATERAL_TILES.length, 2);
  for (const t of LATERAL_TILES) {
    assert.equal(t.type, 'lateral');
    assert.ok(t.guardianAnchor, 'lateral tile should have guardianAnchor');
  }
});

test('SANCTUARY_TILE is type sanctuary', () => {
  assert.equal(SANCTUARY_TILE.type, 'sanctuary');
});
