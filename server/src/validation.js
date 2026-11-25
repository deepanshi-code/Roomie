import { GENDERS, GENDER_PREFS, HOUSING, IMPORTANCE_LABELS, QUESTION_MAP } from './questions.js';

const ids = (list) => list.map((x) => x.id);

function str(value, field, { min = 0, max }, errors) {
  if (typeof value !== 'string') { errors.push(`${field} must be text`); return undefined; }
  const v = value.trim();
  if (v.length < min) errors.push(min === 1 ? `${field} is required` : `${field} is too short`);
  else if (v.length > max) errors.push(`${field} must be at most ${max} characters`);
  return v;
}

function int(value, field, { min, max }, errors) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) { errors.push(`${field} must be a whole number between ${min} and ${max}`); return undefined; }
  return n;
}

function oneOf(value, field, allowed, errors) {
  if (!allowed.includes(value)) { errors.push(`${field} is invalid`); return undefined; }
  return value;
}

/**
 * Validates a partial profile update. Only fields present in `body` are checked/returned.
 * Returns { data, errors } where data uses camelCase keys.
 */
export function validateProfileUpdate(body = {}) {
  const errors = [];
  const data = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  if (has('name')) data.name = str(body.name, 'Name', { min: 1, max: 50 }, errors);
  if (has('age')) data.age = int(body.age, 'Age', { min: 18, max: 99 }, errors);
  if (has('gender')) data.gender = oneOf(body.gender, 'Gender', ids(GENDERS), errors);
  if (has('city')) data.city = str(body.city, 'City', { min: 1, max: 60 }, errors);
  if (has('area')) data.area = str(body.area, 'Area', { max: 80 }, errors);
  if (has('budgetMin')) data.budgetMin = int(body.budgetMin, 'Minimum budget', { min: 0, max: 1_000_000 }, errors);
  if (has('budgetMax')) data.budgetMax = int(body.budgetMax, 'Maximum budget', { min: 0, max: 1_000_000 }, errors);
  if (data.budgetMin != null && data.budgetMax != null && data.budgetMin > data.budgetMax) {
    errors.push('Minimum budget cannot be more than maximum budget');
  }
  if (has('moveIn')) {
    if (body.moveIn === '' || body.moveIn == null) data.moveIn = null;
    else if (typeof body.moveIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.moveIn)) data.moveIn = body.moveIn;
    else errors.push('Move-in date must be YYYY-MM-DD');
  }
  if (has('housing')) data.housing = oneOf(body.housing, 'Housing', ids(HOUSING), errors);
  if (has('showGender')) {
    if (typeof body.showGender === 'boolean') data.showGender = body.showGender;
    else errors.push('Show gender must be true or false');
  }
  if (has('genderPref')) data.genderPref = oneOf(body.genderPref, 'Roommate gender preference', ids(GENDER_PREFS), errors);
  if (has('occupation')) data.occupation = str(body.occupation, 'Occupation', { max: 80 }, errors);
  if (has('bio')) data.bio = str(body.bio, 'Bio', { max: 500 }, errors);

  if (has('interests')) {
    if (!Array.isArray(body.interests) || body.interests.length > 15) {
      errors.push('Pick up to 15 interests');
    } else {
      const cleaned = [...new Set(body.interests
        .filter((i) => typeof i === 'string')
        .map((i) => i.trim())
        .filter((i) => i.length > 0 && i.length <= 30))];
      data.interests = cleaned;
    }
  }

  if (has('answers')) {
    if (typeof body.answers !== 'object' || body.answers === null || Array.isArray(body.answers)) {
      errors.push('Answers are invalid');
    } else {
      const answers = {};
      for (const [qid, ans] of Object.entries(body.answers)) {
        const q = QUESTION_MAP[qid];
        if (!q) continue; // ignore unknown questions
        const value = Number(ans?.value);
        const importance = Number(ans?.importance ?? 2);
        if (!Number.isInteger(value) || value < 0 || value >= q.options.length) {
          errors.push(`Invalid answer for "${q.short}"`);
          continue;
        }
        if (!Number.isInteger(importance) || importance < 0 || importance >= IMPORTANCE_LABELS.length) {
          errors.push(`Invalid importance for "${q.short}"`);
          continue;
        }
        answers[qid] = { value, importance, dealbreaker: ans?.dealbreaker === true };
      }
      data.answers = answers;
    }
  }

  return { data, errors };
}
