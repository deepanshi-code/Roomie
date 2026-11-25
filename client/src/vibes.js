/**
 * Turn lifestyle answers into short "vibe tags" (a line icon + a few words) for profile cards,
 * so people can read someone's lifestyle at a glance instead of a table of answers.
 * Indexes follow each question's option order in server/src/questions.js.
 */
const TAGS = {
  sleep: [['sun', 'Early sleeper'], ['moon', 'In bed by midnight'], ['moon', 'Night owl'], ['moon', 'Very late nights']],
  homeTime: [null, null, ['laptop', 'Works from home']],
  tidiness: [['brush', 'Spotless'], ['brush', 'Tidy'], ['home', 'Lived-in'], ['home', 'Relaxed about mess']],
  noise: [['headphones', 'Library quiet'], ['headphones', 'Quiet'], ['volume', 'Music on'], ['volume', 'Loud is fine']],
  social: [['user', 'Keeps to self'], ['smile', 'Friendly'], ['users', 'Social'], ['users', 'Wants a close friend']],
  guests: [['home', 'Rare guests'], null, ['users', 'Weekly guests'], ['users', 'Guests often']],
  smoking: [['ban', 'Smoke-free home'], ['ban', 'Non-smoker'], ['flame', 'Smokes outside'], ['flame', 'Smokes indoors']],
  diet: [['leaf', 'Pure veg kitchen'], ['leaf', 'Vegetarian'], ['utensils', 'Some non-veg'], ['utensils', 'Cooks non-veg']],
  cooking: [null, null, ['utensils', 'Cooks daily']],
  pets: [null, ['paw', 'Pet-friendly'], ['paw', 'Has a pet']],
};
const ORDER = ['sleep', 'tidiness', 'social', 'noise', 'diet', 'smoking', 'pets', 'homeTime', 'guests', 'cooking'];

/** Line-icon name for each questionnaire category. */
export const CATEGORY_ICON = { schedule: 'clock', cleanliness: 'brush', social: 'users', habits: 'utensils', home: 'home' };

/** values: { [questionId]: optionIndex } → [{ icon: 'moon', label: 'Night owl' }, …] */
export function vibeTags(values, max = 6) {
  const out = [];
  for (const id of ORDER) {
    const tag = TAGS[id]?.[values[id]];
    if (tag && !out.some((t) => t.label === tag[1])) out.push({ icon: tag[0], label: tag[1] });
    if (out.length >= max) break;
  }
  return out;
}

/** Recover someone's option indexes from a compatibility breakdown (it carries their answer labels). */
export function valuesFromBreakdown(breakdown, meta, side = 'them') {
  const values = {};
  for (const row of breakdown ?? []) {
    const q = meta?.questions.find((x) => x.id === row.questionId);
    const idx = q?.options.indexOf(row[side]);
    if (idx >= 0) values[row.questionId] = idx;
  }
  return values;
}

export const valuesFromAnswers = (answers) => Object.fromEntries(
  Object.entries(answers ?? {}).map(([k, v]) => [k, v?.value]),
);

/** A pleasant gradient picked from the person's name, for profiles without photos. */
const GRADIENTS = [
  ['#1f6b5a', '#3f9a7f'], ['#c97a4a', '#e0a36f'], ['#3b6e8f', '#5b93b5'], ['#8a6a3f', '#b8925c'],
  ['#5b7c4a', '#84a86b'], ['#6b5b8a', '#8d7cad'], ['#a0524a', '#c77b6d'], ['#2f7d7a', '#4fa8a3'],
];
export function nameGradient(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  const [a, b] = GRADIENTS[Math.abs(h) % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
export const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
