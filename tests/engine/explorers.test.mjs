import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ABILITIES, EXPLORERS } from '../../src/engine/explorers.js';

// ── Ability data tests ──────────────────────────────────────────────

const expectedAbilities = [
  { id: 'scholar',     name: 'Érudite',          cost: 0, passive: true,  uses: null },
  { id: 'adventurer',  name: 'Aventurière',      cost: 1, passive: false, uses: null },
  { id: 'agile',       name: 'Agile',            cost: 0, passive: true,  uses: null },
  { id: 'illuminate',  name: 'Illuminer',        cost: 1, passive: false, uses: null },
  { id: 'sprint',      name: 'Sprinter',         cost: 1, passive: false, uses: null },
  { id: 'vigilance',   name: 'Vigilance',        cost: 0, passive: true,  uses: null },
  { id: 'order',       name: 'Ordonner',         cost: 1, passive: false, uses: null },
  { id: 'research',    name: 'Rechercher',       cost: 1, passive: false, uses: 3 },
  { id: 'excavate',    name: 'Excaver',          cost: 1, passive: false, uses: null },
  { id: 'consolidate', name: 'Consolider',       cost: 1, passive: false, uses: 4 },
  { id: 'scope',       name: 'Lunette de visée', cost: 1, passive: false, uses: null },
  { id: 'snipe',       name: 'Tir de précision', cost: 1, passive: false, uses: null },
  { id: 'grenade',     name: 'Grenade',          cost: 1, passive: false, uses: null },
  { id: 'demolish',    name: 'Démolir',          cost: 1, passive: false, uses: 3 },
  { id: 'annihilate',  name: 'Anéantir',         cost: 1, passive: false, uses: null },
  { id: 'prepare',     name: 'Se préparer',      cost: 1, passive: false, uses: null },
  { id: 'heal',        name: 'Guérir',           cost: 1, passive: false, uses: null },
  { id: 'survivor',    name: 'Survivante',       cost: 0, passive: true,  uses: null },
  { id: 'revive',      name: 'Ranimer',         cost: 1, passive: false, uses: null },
  { id: 'purify',      name: 'Purifier',        cost: 1, passive: false, uses: null },
];

for (const exp of expectedAbilities) {
  test(`ability "${exp.id}" exists with correct cost/passive/uses`, () => {
    const a = ABILITIES[exp.id];
    assert.ok(a, `ability ${exp.id} should exist`);
    assert.equal(a.id, exp.id);
    assert.equal(a.name, exp.name);
    assert.equal(a.cost, exp.cost);
    assert.equal(a.passive, exp.passive);
    assert.equal(a.uses, exp.uses);
    assert.ok(typeof a.description === 'string' && a.description.length > 0, 'has a description');
  });
}

test('all 20 abilities are present', () => {
  assert.equal(Object.keys(ABILITIES).length, 20);
});

test('adventurer has costType hp (unique)', () => {
  assert.equal(ABILITIES.adventurer.costType, 'hp');
  const withCostType = Object.values(ABILITIES).filter(a => a.costType);
  assert.equal(withCostType.length, 1);
  assert.equal(withCostType[0].id, 'adventurer');
});

test('heal description says 2 PV', () => {
  assert.match(ABILITIES.heal.description, /2 PV/);
  assert.doesNotMatch(ABILITIES.heal.description, /1 PV/);
});

test('revive description mentions +1 PV for downed and +3 PV for active (not reversed)', () => {
  const desc = ABILITIES.revive.description;
  assert.match(desc, /\+1 PV/);
  assert.match(desc, /\+3 PV/);
  // "à terre" should be associated with +1, not +3
  assert.ok(desc.indexOf('à terre') < desc.indexOf('+1 PV') || desc.indexOf('+1 PV') < desc.indexOf('à terre'),
    'revive description should mention downed state and +1 PV');
});

// ── Explorer data tests ─────────────────────────────────────────────

const expectedExplorers = [
  { id: 'aristocrat',  name: "L'Aristocrate",       role: 'Exploration', pv: 3, abilities: ['scholar', 'adventurer'] },
  { id: 'thief',       name: 'Le Gredin',           role: 'Exploration', pv: 3, abilities: ['agile', 'illuminate'] },
  { id: 'scout',       name: 'Le Guide',            role: 'Exploration', pv: 5, abilities: ['sprint', 'vigilance'] },
  { id: 'commander',   name: "L'Archéo",            role: 'Commandement', pv: 5, abilities: ['order', 'research'] },
  { id: 'miner',       name: 'Le Contremaître',     role: 'Force',        pv: 7, abilities: ['excavate', 'consolidate'] },
  { id: 'sniper',      name: "Le Tireur d'élite",   role: 'Combat',       pv: 5, abilities: ['scope', 'snipe'] },
  { id: 'sapper',      name: 'Le Sapeur',           role: 'Combat',       pv: 5, abilities: ['grenade', 'demolish'] },
  { id: 'soldier',     name: 'La Combattante',      role: 'Combat',       pv: 7, abilities: ['annihilate', 'prepare'] },
  { id: 'nurse',       name: 'La Guérisseuse',      role: 'Soin',         pv: 5, abilities: ['heal', 'survivor'] },
  { id: 'priestess',   name: 'Le Prêtre',           role: 'Soin',         pv: 3, abilities: ['revive', 'purify'] },
];

for (const exp of expectedExplorers) {
  test(`explorer "${exp.id}" exists with correct pv/role/abilities`, () => {
    const e = EXPLORERS.find(x => x.id === exp.id);
    assert.ok(e, `explorer ${exp.id} should exist`);
    assert.equal(e.name, exp.name);
    assert.equal(e.role, exp.role);
    assert.equal(e.pv, exp.pv);
    assert.equal(e.abilities.length, 2);
    assert.deepEqual(e.abilities, exp.abilities);
  });
}

test('exactly 10 explorers', () => {
  assert.equal(EXPLORERS.length, 10);
});

test('every explorer has color, glyph, and blurb', () => {
  for (const e of EXPLORERS) {
    assert.ok(e.color, `${e.id} should have a color`);
    assert.ok(e.glyph, `${e.id} should have a glyph`);
    assert.ok(typeof e.blurb === 'string' && e.blurb.length > 0, `${e.id} should have a blurb`);
  }
});

test('each ability is used by exactly one explorer (no dupes, no missing)', () => {
  const used = [];
  for (const e of EXPLORERS) {
    used.push(...e.abilities);
  }
  assert.equal(used.length, 20, '20 ability references across 10 explorers');
  const unique = new Set(used);
  assert.equal(unique.size, 20, 'all 20 ability references are unique');
  for (const id of Object.keys(ABILITIES)) {
    assert.ok(unique.has(id), `ability ${id} is used by at least one explorer`);
  }
});
