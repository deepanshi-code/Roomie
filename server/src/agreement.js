/**
 * Roommate agreement generator.
 *
 * Turns two people's lifestyle answers into a draft set of house rules. The rules
 * of thumb used to settle differences are written into each clause's `rationale`
 * so users can see (and challenge) why a rule was suggested:
 *
 *   - STRICTER wins for things that affect health, safety or consent at home
 *     (smoking, overnight guests, vegetarian kitchen, pets, alcohol, noise,
 *     chore structure, expense tracking). Loosening a rule later is easier than tightening it.
 *   - MIDDLE ground for matters of degree (dishes, tidiness, guest frequency).
 *   - Quiet hours run from the EARLIER bedtime to the LATER wake-up, so both people can sleep.
 *
 * Each clause gets a status from how far apart the two answers were:
 *   aligned (same answer) · compromise (one step apart) · discuss (two or more steps)
 * Standard clauses that don't depend on answers have status "standard".
 */
import { QUESTION_MAP } from './questions.js';

const val = (u, q) => u.answers?.[q]?.value;
const has = (u, q) => Number.isInteger(val(u, q));
const stricter = (a, b, q) => Math.min(val(a, q) ?? 0, val(b, q) ?? 0);
const looser = (a, b, q) => Math.max(val(a, q) ?? 0, val(b, q) ?? 0);
const middle = (a, b, q) => Math.floor(((val(a, q) ?? 0) + (val(b, q) ?? 0)) / 2);

export function clauseStatus(a, b, qids) {
  if (qids.length === 0) return 'standard';
  let dist = 0;
  for (const q of qids) {
    if (has(a, q) && has(b, q)) dist = Math.max(dist, Math.abs(val(a, q) - val(b, q)));
  }
  return dist === 0 ? 'aligned' : dist === 1 ? 'compromise' : 'discuss';
}

function basis(a, b, qids) {
  return qids.map((q) => ({
    question: QUESTION_MAP[q].short,
    answers: [a, b].map((u) => ({ userId: u.id, answer: QUESTION_MAP[q].options[val(u, q)] ?? '—' })),
  }));
}

const STRICTER_NOTE = 'The stricter preference is used, because it affects both people at home. You can relax it together later.';

export function generateClauses(a, b) {
  const clause = (id, topic, title, text, qids, rationale) => ({
    id, topic, title, text, rationale,
    status: clauseStatus(a, b, qids),
    basis: basis(a, b, qids),
    edited: false,
  });

  // Quiet hours
  const quietStart = ['10:00 pm', '11:00 pm', '12:30 am', '2:00 am'][stricter(a, b, 'sleep')];
  const quietEnd = ['6:00 am', '8:00 am', '9:30 am', '10:30 am'][looser(a, b, 'wake')];
  const noiseRule = [
    'Shared spaces stay quiet at all times. Use headphones for music and calls.',
    'Use headphones or a low volume for music and calls in shared spaces.',
    'Music and TV are fine at a moderate volume outside quiet hours.',
    'Music and TV are fine outside quiet hours. Keep the volume fair to neighbours.',
  ][stricter(a, b, 'noise')];

  const dishes = [
    'Wash your own dishes straight after eating.',
    'Dishes are washed by the end of the same day.',
    'No dishes are left in the sink for more than 24 hours.',
    'The sink is cleared at least every two days, and always before guests come.',
  ][middle(a, b, 'dishes')];

  const tidy = [
    'Shared spaces are kept spotless. Personal items are put away the same day.',
    'Shared spaces are kept mostly tidy. Personal items are cleared by the end of each day.',
    'Shared spaces can look lived-in, but are cleared of personal items once a week and before guests.',
    'Shared spaces get a full reset at least once a week.',
  ][middle(a, b, 'tidiness')];
  const chores = [
    'Chores (sweeping, bathroom, trash, kitchen) follow a written weekly rota that rotates.',
    'Chores alternate week by week. If you miss your turn, you take the next one too.',
    'Whoever notices a chore does it. Check once a month that the split still feels fair.',
  ][stricter(a, b, 'chores')];

  const dayGuests = [
    'Day guests are occasional, with a heads-up first.',
    'Day guests a few times a month, with a heads-up the day before.',
    'Day guests about once a week, with a heads-up the same day.',
    'Day guests are welcome often, but keep it down during exams and work deadlines.',
  ][middle(a, b, 'guests')];
  const overnight = [
    'No overnight guests.',
    'Overnight guests occasionally (at most 2 nights a week), with 24 hours\' notice and the other person\'s OK.',
    'Overnight guests are fine with a same-day heads-up. Nobody stays more than 3 nights in a row without asking.',
  ][stricter(a, b, 'overnight')];

  const smoking = [
    'No smoking anywhere in the flat, including balconies and near windows.',
    'Smoking only outside the flat, away from doors and windows.',
    'Smoking only outside the flat, away from doors and windows.',
    'Smoking only in your own room with the window open, never in shared spaces.',
  ][stricter(a, b, 'smoking')];

  const alcohol = [
    'No alcohol at home.',
    'Alcohol is OK in moderation. Clean up afterwards, and drinking get-togethers follow the guest rules.',
    'Alcohol is fine. Drinking get-togethers follow the guest rules.',
    'Alcohol is fine. Drinking get-togethers follow the guest rules.',
  ][stricter(a, b, 'drinking')];

  const kitchenDiet = [
    'The kitchen is strictly vegetarian, including utensils, fridge and stored food.',
    'Non-veg can be cooked with separate utensils and a separate fridge shelf, and cleaned up right away.',
    'There are no food restrictions in the kitchen.',
    'There are no food restrictions in the kitchen.',
  ][stricter(a, b, 'diet')];
  const cooks = looser(a, b, 'cooking') >= 1
    ? ' Whoever cooks cleans the stove and counters the same day. Label personal food, and shared staples are split.'
    : ' Label personal food in the fridge, and throw out anything expired every week.';

  const minPets = stricter(a, b, 'pets');
  const pets = minPets === 0 && looser(a, b, 'pets') === 2
    ? 'No pets for now, unless you both agree on a written plan (feeding, cleaning, vet visits, damage).'
    : minPets === 0
      ? 'No pets.'
      : 'Pets are allowed. The owner handles feeding, cleaning, vet visits and any damage.';

  const bills = [
    'Shared expenses are logged in an expense-splitting app and settled every week.',
    'Shared expenses are split equally and settled in the first week of each month.',
    'Utilities (Wi-Fi, electricity, water) are split equally every month. Everyone buys their own groceries.',
  ][stricter(a, b, 'bills')];

  return [
    clause('quiet-hours', 'Schedule', 'Quiet hours',
      `Quiet hours are ${quietStart} – ${quietEnd}: no loud music, speakerphone calls or guests in shared spaces. ${noiseRule}`,
      ['sleep', 'wake', 'noise'],
      'Quiet hours start at the earlier bedtime and end at the later wake-up time, so both people can sleep. The stricter noise preference is used.'),
    clause('dishes', 'Cleanliness', 'Dishes', dishes, ['dishes'], 'Halfway between your two answers.'),
    clause('shared-spaces', 'Cleanliness', 'Shared spaces & chores', `${tidy} ${chores}`, ['tidiness', 'chores'],
      'Tidiness is set halfway between your answers. The more structured chore system is used, because without structure one person usually ends up doing more.'),
    clause('guests', 'Social life', 'Guests', `${dayGuests} ${overnight}`, ['guests', 'overnight'],
      'Day guests are set halfway between your answers. Overnight guests use the stricter preference, because both people should be comfortable with who sleeps in the home.'),
    clause('smoking', 'Habits', 'Smoking', smoking, ['smoking'], STRICTER_NOTE),
    clause('alcohol', 'Habits', 'Alcohol', alcohol, ['drinking'], STRICTER_NOTE),
    clause('kitchen', 'Habits', 'Kitchen & food', kitchenDiet + cooks, ['diet', 'cooking'], STRICTER_NOTE),
    clause('pets', 'Home', 'Pets', pets, ['pets'], STRICTER_NOTE),
    clause('bills', 'Money', 'Shared expenses', bills, ['bills'],
      'The more detailed tracking method is used. Money disagreements are easier to avoid than to fix.'),
    clause('rent', 'Money', 'Rent & deposit',
      'Rent is ₹_____ per month, split _____. Each person pays their share by the ___ of the month. Security deposit: ₹_____ each.',
      [], 'Fill in the blanks together. Keep your formal rental agreement for the legal details.'),
    clause('privacy', 'Home', 'Privacy & borrowing',
      "Knock before entering each other's rooms. Ask before borrowing anything, and return or replace it quickly.",
      [], 'A standard rule that most roommate agreements include.'),
    clause('communication', 'Home', 'Raising problems',
      'Bring up problems within a few days, face to face and calmly, not over text. Have a 10-minute check-in once a month to update this agreement.',
      [], 'Small problems left unsaid turn into big ones.'),
    clause('moving-out', 'Home', 'Moving out',
      "Give at least 30 days' notice before moving out, and help find a replacement if the lease needs one.",
      [], 'A standard rule that most roommate agreements include.'),
  ];
}
