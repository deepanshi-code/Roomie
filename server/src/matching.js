/**
 * Compatibility engine.
 *
 * Every answer stores { value, importance, dealbreaker }:
 *   value       – index into the question's ordered options
 *   importance  – 0..3 ("doesn't matter" .. "very important")
 *   dealbreaker – if true, hide people whose answer is more than
 *                 DEALBREAKER_TOLERANCE steps away from yours
 *
 * Pipeline for viewer A looking at candidate B:
 *   1. Hard filters  – same city, overlapping budget, gender preference (both ways)
 *   2. Dealbreakers  – either person's dealbreakers exclude the pair
 *   3. Directional scores
 *        fit(A→B) = Σ w_A(q)·sim(q) / Σ w_A(q)   "how well B fits what A cares about"
 *        fit(B→A) = same, from B's side
 *      sim(q) = 1 − |a − b| / (options − 1)       (ordinal distance, 0..1)
 *   4. Lifestyle = √(fit(A→B) · fit(B→A))  — geometric mean, so a pairing that
 *      is great for one person and bad for the other scores low.
 *   5. Final score = (1 − INTEREST_WEIGHT)·lifestyle + INTEREST_WEIGHT·interests
 *
 * All weights below are ASSUMPTIONS. They should be tuned against real outcome
 * data (did matched pairs move in? were they still living together after 3 months?).
 */
import { CATEGORIES, QUESTIONS } from './questions.js';

export const IMPORTANCE_WEIGHTS = [0, 1, 3, 8];
export const DEALBREAKER_TOLERANCE = 1;
export const INTEREST_WEIGHT = 0.15;
export const INTEREST_SATURATION = 3; // sharing 3+ interests = full interest score

const isAnswered = (ans) => !!ans && Number.isInteger(ans.value);
const norm = (s) => String(s ?? '').trim().toLowerCase();
const pct = (x) => Math.round(x * 100);

export function optionSimilarity(question, a, b) {
  const steps = question.options.length - 1;
  return steps <= 0 ? 1 : 1 - Math.abs(a - b) / steps;
}

function genderAccepts(viewer, other) {
  if (viewer.genderPref !== 'same') return true;
  return !!viewer.gender && viewer.gender !== 'prefer_not' && viewer.gender === other.gender;
}

/** Returns a list of human-readable reasons the pair fails hard filters (empty = OK). */
export function checkBasics(a, b) {
  const reasons = [];
  if (norm(a.city) !== norm(b.city)) reasons.push('Different city');
  const aMin = a.budgetMin ?? 0, aMax = a.budgetMax ?? Infinity;
  const bMin = b.budgetMin ?? 0, bMax = b.budgetMax ?? Infinity;
  if (aMax < bMin || bMax < aMin) reasons.push("Budgets don't overlap");
  if (!genderAccepts(a, b) || !genderAccepts(b, a)) reasons.push('Roommate gender preference');
  return reasons;
}

/** Dealbreakers triggered between viewer a and other b. `by` is relative to the viewer. */
export function findDealbreakers(a, b) {
  const hits = [];
  for (const q of QUESTIONS) {
    const qa = a.answers?.[q.id];
    const qb = b.answers?.[q.id];
    if (!isAnswered(qa) || !isAnswered(qb)) continue;
    const dist = Math.abs(qa.value - qb.value);
    if (dist <= DEALBREAKER_TOLERANCE) continue;
    if (qa.dealbreaker) hits.push({ questionId: q.id, question: q.short, by: 'you' });
    if (qb.dealbreaker) hits.push({ questionId: q.id, question: q.short, by: 'them' });
  }
  return hits;
}

/** How well `other` satisfies what `viewer` cares about (0..1). */
export function directionalScore(viewer, other) {
  let num = 0;
  let den = 0;
  for (const q of QUESTIONS) {
    const va = viewer.answers?.[q.id];
    const vb = other.answers?.[q.id];
    if (!isAnswered(va) || !isAnswered(vb)) continue;
    const w = IMPORTANCE_WEIGHTS[va.importance] ?? 0;
    num += w * optionSimilarity(q, va.value, vb.value);
    den += w;
  }
  return den === 0 ? 1 : num / den; // viewer marked everything "doesn't matter"
}

export function sharedInterests(a, b) {
  const theirs = new Set((b.interests ?? []).map(norm));
  return (a.interests ?? []).filter((i) => theirs.has(norm(i)));
}

/** Full compatibility report, written from the viewer's point of view. */
export function compatibility(viewer, other) {
  const fitsYou = directionalScore(viewer, other);
  const fitsThem = directionalScore(other, viewer);
  const lifestyle = Math.sqrt(fitsYou * fitsThem);

  const shared = sharedInterests(viewer, other);
  const interestScore = Math.min(shared.length, INTEREST_SATURATION) / INTEREST_SATURATION;
  const score = Math.round(100 * ((1 - INTEREST_WEIGHT) * lifestyle + INTEREST_WEIGHT * interestScore));

  const breakdown = [];
  for (const q of QUESTIONS) {
    const va = viewer.answers?.[q.id];
    const vb = other.answers?.[q.id];
    if (!isAnswered(va) || !isAnswered(vb)) continue;
    breakdown.push({
      questionId: q.id,
      category: q.category,
      question: q.short,
      you: q.options[va.value],
      them: q.options[vb.value],
      similarity: Math.round(optionSimilarity(q, va.value, vb.value) * 100) / 100,
      weight: (IMPORTANCE_WEIGHTS[va.importance] ?? 0) + (IMPORTANCE_WEIGHTS[vb.importance] ?? 0),
    });
  }

  const categories = CATEGORIES.map((c) => {
    const rows = breakdown.filter((r) => r.category === c.id);
    const totalW = rows.reduce((s, r) => s + r.weight, 0);
    const value = rows.length === 0 ? null
      : totalW > 0
        ? rows.reduce((s, r) => s + r.similarity * r.weight, 0) / totalW
        : rows.reduce((s, r) => s + r.similarity, 0) / rows.length;
    return { id: c.id, label: c.label, score: value === null ? null : pct(value) };
  });

  const byWeight = (x, y) => y.weight - x.weight || y.similarity - x.similarity;
  const strengths = breakdown.filter((r) => r.weight > 0 && r.similarity >= 0.66).sort(byWeight).slice(0, 3);
  const conflicts = breakdown
    .filter((r) => r.weight > 0 && r.similarity < 0.5)
    .sort((x, y) => y.weight - x.weight || x.similarity - y.similarity)
    .slice(0, 3);

  const dealbreakers = findDealbreakers(viewer, other);
  const blockers = [
    ...checkBasics(viewer, other),
    ...dealbreakers.map((d) => `${d.by === 'you' ? 'Your' : 'Their'} dealbreaker: ${d.question}`),
  ];

  return {
    score,
    lifestyle: pct(lifestyle),
    fitsYou: pct(fitsYou),
    fitsThem: pct(fitsThem),
    interestScore: pct(interestScore),
    sharedInterests: shared,
    categories,
    strengths,
    conflicts,
    breakdown,
    blockers,
    eligible: blockers.length === 0,
  };
}
