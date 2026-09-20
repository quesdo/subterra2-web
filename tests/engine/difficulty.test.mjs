import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DIFFICULTY_TABLE, getEruptionStart } from '../../src/engine/difficulty.js';

test('difficulty table has correct values for 3 explorers', () => {
  assert.equal(DIFFICULTY_TABLE[3].beginner, 27);
  assert.equal(DIFFICULTY_TABLE[3].normal, 26);
  assert.equal(DIFFICULTY_TABLE[3].advanced, 22);
  assert.equal(DIFFICULTY_TABLE[3].expert, 20);
});

test('difficulty table has correct values for 4 explorers', () => {
  assert.equal(DIFFICULTY_TABLE[4].beginner, 22);
  assert.equal(DIFFICULTY_TABLE[4].normal, 19);
  assert.equal(DIFFICULTY_TABLE[4].advanced, 16);
  assert.equal(DIFFICULTY_TABLE[4].expert, 14);
});

test('difficulty table has correct values for 5 explorers', () => {
  assert.equal(DIFFICULTY_TABLE[5].beginner, 24);
  assert.equal(DIFFICULTY_TABLE[5].normal, 21);
  assert.equal(DIFFICULTY_TABLE[5].advanced, 18);
  assert.equal(DIFFICULTY_TABLE[5].expert, 16);
});

test('difficulty table has correct values for 6 explorers', () => {
  assert.equal(DIFFICULTY_TABLE[6].beginner, 20);
  assert.equal(DIFFICULTY_TABLE[6].normal, 17);
  assert.equal(DIFFICULTY_TABLE[6].advanced, 14);
  assert.equal(DIFFICULTY_TABLE[6].expert, 12);
});

test('4-explore and 5-explorer columns are NOT swapped', () => {
  assert.notEqual(DIFFICULTY_TABLE[4].beginner, DIFFICULTY_TABLE[5].beginner);
  assert.notEqual(DIFFICULTY_TABLE[4].normal, DIFFICULTY_TABLE[5].normal);
});

test('getEruptionStart returns correct value', () => {
  assert.equal(getEruptionStart(3, 'beginner'), 27);
  assert.equal(getEruptionStart(4, 'normal'), 19);
  assert.equal(getEruptionStart(5, 'expert'), 16);
  assert.equal(getEruptionStart(6, 'advanced'), 14);
});

test('getEruptionStart throws for unsupported explorer count', () => {
  assert.throws(() => getEruptionStart(2, 'beginner'));
  assert.throws(() => getEruptionStart(7, 'beginner'));
});

test('getEruptionStart throws for unknown difficulty', () => {
  assert.throws(() => getEruptionStart(3, 'nightmare'));
});
