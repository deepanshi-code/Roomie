import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS } from '../src/questions.js';
import {
  checkBasics, compatibility, directionalScore, findDealbreakers, INTEREST_WEIGHT,
} from '../src/matching.js';

/** Build a user whose answers are all `value` (clamped per question) with given importance. */
function makeUser(overrides = {}, { value = 0, importance = 2, dealbreaker = false } = {}) {
  const answers = {};
  for (const q of QUESTIONS) {
    answers[q.id] = { value: Math.min(value, q.options.length - 1), importance, dealbreaker: false };
  }
  if (dealbreaker) answers.smoking.dealbreaker = true;
  return {
    city: 'Dehradun', budgetMin: 5000, budgetMax: 10000, gender: 'female', genderPref: 'any',
    interests: ['Music', 'Coding', 'Trekking'], answers, ...overrides,
  };
}

test('identical people with 3 shared interests score 100', () => {
  const c = compatibility(makeUser(), makeUser());
  assert.equal(c.lifestyle, 100);
  assert.equal(c.score, 100);
  assert.equal(c.eligible, true);
  assert.equal(c.conflicts.length, 0);
});

test('opposite answers score low and list conflicts', () => {
  const a = makeUser({}, { value: 0 });
  const b = makeUser({ interests: [] }, { value: 3 }); // max value on every question
  const c = compatibility(a, b);
  assert.equal(c.lifestyle, 0);
  assert.ok(c.score <= 5, `expected near-zero score, got ${c.score}`);
  assert.ok(c.conflicts.length > 0);
});

test('importance 0 ("doesn\'t matter") is ignored', () => {
  const a = makeUser({}, { value: 0, importance: 0 });
  a.answers.sleep.importance = 3; // the only thing A cares about
  const b = makeUser({}, { value: 3 });
  b.answers.sleep.value = 0; // B agrees on the one thing A cares about
  assert.equal(directionalScore(a, b), 1);
});

test('geometric mean penalises one-sided matches', () => {
  // A cares only about sleep (matches); B cares only about guests (mismatch).
  const a = makeUser({}, { importance: 0 });
  const b = makeUser({}, { importance: 0 });
  a.answers.sleep.importance = 3;
  b.answers.guests.importance = 3;
  b.answers.guests.value = 3; // far from A's 0
  const c = compatibility(a, b);
  assert.equal(c.fitsYou, 100);
  assert.equal(c.fitsThem, 0);
  assert.equal(c.lifestyle, 0, 'arithmetic mean would have hidden this as 50%');
});

test('dealbreaker excludes answers more than one step away, not one step', () => {
  const a = makeUser({}, { dealbreaker: true }); // smoking = 0, dealbreaker
  const oneStep = makeUser();
  oneStep.answers.smoking.value = 1;
  const threeSteps = makeUser();
  threeSteps.answers.smoking.value = 3;

  assert.equal(findDealbreakers(a, oneStep).length, 0);
  const hits = findDealbreakers(a, threeSteps);
  assert.deepEqual(hits.map((h) => [h.questionId, h.by]), [['smoking', 'you']]);
  assert.equal(compatibility(threeSteps, a).eligible, false, 'dealbreakers apply from both sides');
});

test('hard filters: city, budget overlap, gender preference', () => {
  const a = makeUser();
  assert.deepEqual(checkBasics(a, makeUser({ city: ' dehradun ' })), [], 'city match is case/space-insensitive');
  assert.ok(checkBasics(a, makeUser({ city: 'Delhi' })).includes('Different city'));
  assert.ok(checkBasics(a, makeUser({ budgetMin: 11000, budgetMax: 15000 })).includes("Budgets don't overlap"));
  assert.deepEqual(checkBasics(a, makeUser({ budgetMin: 10000, budgetMax: 15000 })), [], 'touching ranges overlap');

  const sameOnly = makeUser({ genderPref: 'same', gender: 'female' });
  assert.ok(checkBasics(sameOnly, makeUser({ gender: 'male' })).includes('Roommate gender preference'));
  assert.ok(checkBasics(makeUser({ gender: 'male' }), sameOnly).includes('Roommate gender preference'), 'checked both ways');
  assert.deepEqual(checkBasics(sameOnly, makeUser({ gender: 'female' })), []);
});

test('interest weight caps at saturation', () => {
  const a = makeUser({ interests: [] });
  const b = makeUser({ interests: [] });
  const c = compatibility(a, b);
  assert.equal(c.lifestyle, 100);
  assert.equal(c.score, Math.round(100 * (1 - INTEREST_WEIGHT)));
});
