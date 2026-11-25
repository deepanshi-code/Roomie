import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/questions.js';
import { clauseStatus, generateClauses } from '../src/agreement.js';

function person(id, overrides = {}) {
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, { value: 1, importance: 2 }]));
  for (const [k, v] of Object.entries(overrides)) answers[k] = { value: v, importance: 2 };
  return { id, answers };
}
const byId = (clauses, id) => clauses.find((c) => c.id === id);

test('identical answers produce only aligned/standard clauses', () => {
  const clauses = generateClauses(person(1), person(2));
  assert.ok(clauses.length >= 10);
  assert.ok(clauses.every((c) => c.status === 'aligned' || c.status === 'standard'));
  assert.equal(new Set(clauses.map((c) => c.id)).size, clauses.length, 'ids are unique');
});

test('stricter preference wins for smoking and overnight guests', () => {
  const nonSmoker = person(1, { smoking: 0, overnight: 0 });
  const smoker = person(2, { smoking: 3, overnight: 2 });
  const clauses = generateClauses(nonSmoker, smoker);
  assert.match(byId(clauses, 'smoking').text, /No smoking anywhere/);
  assert.equal(byId(clauses, 'smoking').status, 'discuss');
  assert.match(byId(clauses, 'guests').text, /No overnight guests/);
  // Order of people must not change the outcome.
  assert.deepEqual(generateClauses(smoker, nonSmoker).map((c) => c.text), clauses.map((c) => c.text));
});

test('quiet hours run from the earlier bedtime to the later wake-up', () => {
  const earlyBird = person(1, { sleep: 0, wake: 0 });
  const nightOwl = person(2, { sleep: 3, wake: 3 });
  const text = byId(generateClauses(earlyBird, nightOwl), 'quiet-hours').text;
  assert.match(text, /10:00 pm – 10:30 am/);
});

test('pet clause offers a written plan when one wants a pet and the other refuses', () => {
  const clauses = generateClauses(person(1, { pets: 0 }), person(2, { pets: 2 }));
  assert.match(byId(clauses, 'pets').text, /unless you both agree on a written plan/);
});

test('status reflects the widest gap among a clause\'s questions', () => {
  assert.equal(clauseStatus(person(1), person(2), []), 'standard');
  assert.equal(clauseStatus(person(1, { sleep: 0 }), person(2, { sleep: 1 }), ['sleep', 'wake']), 'compromise');
  assert.equal(clauseStatus(person(1, { sleep: 0 }), person(2, { sleep: 3 }), ['sleep', 'wake']), 'discuss');
});

test('basis lists both people\'s answers', () => {
  const c = byId(generateClauses(person(7, { dishes: 0 }), person(9, { dishes: 3 })), 'dishes');
  assert.deepEqual(c.basis[0].answers.map((x) => x.userId), [7, 9]);
  assert.equal(c.basis[0].answers[0].answer, 'Already washed them');
});
