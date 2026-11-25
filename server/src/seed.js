/**
 * Resets the database and fills it with demo users so the app is usable immediately.
 * All seeded accounts are LOCAL TEST DATA and share the password below.
 *
 *   Demo login:  demo@roomie.test  /  demo1234
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { UPLOAD_DIR } from './config.js';
import { db, transaction } from './db.js';
import { QUESTIONS } from './questions.js';

const SEED_PASSWORD = 'demo1234';

// Deterministic PRNG so every seed run produces the same people.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickMany = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);

/** Archetypes: base answer index per question + what they care most about. */
const ARCHETYPES = {
  earlyBird: {
    base: { sleep: 0, wake: 0, homeTime: 0, dishes: 0, tidiness: 0, chores: 0, guests: 0, overnight: 0, noise: 0, social: 1, smoking: 0, drinking: 0, diet: 0, cooking: 2, pets: 0, bills: 0 },
    cares: ['dishes', 'tidiness', 'noise', 'smoking', 'sleep'],
    dealbreakers: ['smoking'],
    interests: ['Yoga', 'Running', 'Reading', 'Meditation', 'Cooking', 'Spirituality'],
    bios: ['Up at 5:30 for a run. Quiet evenings, clean kitchen, early nights.', 'I like a calm, tidy home and cook most days. Looking for someone similar.'],
  },
  nightOwl: {
    base: { sleep: 2, wake: 2, homeTime: 1, dishes: 2, tidiness: 2, chores: 2, guests: 2, overnight: 1, noise: 2, social: 2, smoking: 1, drinking: 2, diet: 3, cooking: 1, pets: 1, bills: 2 },
    cares: ['social', 'guests', 'sleep'],
    dealbreakers: [],
    interests: ['Movies', 'Music', 'Football', 'Travel', 'Board games', 'Dancing'],
    bios: ['Night person, friends over on weekends, always up for a movie.', 'Easygoing and social. I want a roommate who is also a friend.'],
  },
  balanced: {
    base: { sleep: 1, wake: 1, homeTime: 0, dishes: 1, tidiness: 1, chores: 1, guests: 1, overnight: 1, noise: 1, social: 1, smoking: 1, drinking: 1, diet: 2, cooking: 1, pets: 1, bills: 1 },
    cares: ['dishes', 'bills', 'noise'],
    dealbreakers: [],
    interests: ['Fitness', 'Travel', 'Podcasts', 'Startups', 'Cricket', 'Photography'],
    bios: ['Out at work most of the day. Respectful, splits things fairly, keeps it tidy.', 'Pretty balanced — friendly but value my space. Weekends for treks.'],
  },
  wfhCreative: {
    base: { sleep: 2, wake: 2, homeTime: 2, dishes: 1, tidiness: 2, chores: 1, guests: 1, overnight: 1, noise: 1, social: 0, smoking: 1, drinking: 1, diet: 2, cooking: 1, pets: 2, bills: 1 },
    cares: ['noise', 'homeTime', 'pets'],
    dealbreakers: ['noise'],
    interests: ['Gaming', 'Coding', 'Art', 'Anime', 'Tech', 'Pets', 'Writing'],
    bios: ['I work from home, so a quiet day-time flat matters. I have a cat.', 'Designer / dev, at home a lot. Headphones on, low drama.'],
  },
  partyStudent: {
    base: { sleep: 3, wake: 3, homeTime: 1, dishes: 3, tidiness: 3, chores: 2, guests: 3, overnight: 2, noise: 3, social: 3, smoking: 2, drinking: 3, diet: 3, cooking: 0, pets: 1, bills: 2 },
    cares: ['social', 'guests'],
    dealbreakers: [],
    interests: ['Music', 'Dancing', 'Gaming', 'Football', 'Fashion', 'Movies'],
    bios: ['College is for living! Friends over a lot, I order in, very chill.', 'Fun, loud, social. Not the person to ask about dish duty'],
  },
};

function answersFor(archetype) {
  const answers = {};
  for (const q of QUESTIONS) {
    let value = archetype.base[q.id];
    if (rand() < 0.3) value += rand() < 0.5 ? -1 : 1; // personal variation
    value = Math.max(0, Math.min(q.options.length - 1, value));
    const cares = archetype.cares.includes(q.id);
    const importance = cares ? (rand() < 0.7 ? 3 : 2) : pick([0, 1, 1, 2, 2]);
    answers[q.id] = { value, importance, dealbreaker: archetype.dealbreakers.includes(q.id) && rand() < 0.7 };
  }
  return answers;
}

const DEHRADUN_AREAS = ['Clement Town', 'Bell Road', 'Prem Nagar', 'Rajpur Road', 'Sahastradhara Road', 'Dalanwala', 'Patel Nagar'];
const PEOPLE = [
  // name, gender, age, occupation, city, archetype
  ['Ananya Rawat', 'female', 20, 'B.Tech CSE student', 'Dehradun', 'earlyBird'],
  ['Rohan Negi', 'male', 21, 'B.Tech student', 'Dehradun', 'partyStudent'],
  ['Ishita Bisht', 'female', 22, 'MBA student', 'Dehradun', 'balanced'],
  ['Kabir Malhotra', 'male', 23, 'Software engineer', 'Dehradun', 'wfhCreative'],
  ['Meera Joshi', 'female', 21, 'B.Sc student', 'Dehradun', 'earlyBird'],
  ['Arjun Thapa', 'male', 20, 'BCA student', 'Dehradun', 'nightOwl'],
  ['Sana Qureshi', 'female', 24, 'UX designer', 'Dehradun', 'wfhCreative'],
  ['Vikram Chauhan', 'male', 22, 'B.Tech ME student', 'Dehradun', 'balanced'],
  ['Priya Kandpal', 'female', 23, 'Content writer', 'Dehradun', 'nightOwl'],
  ['Aditya Pant', 'male', 21, 'B.Tech student', 'Dehradun', 'partyStudent'],
  ['Neha Gusain', 'female', 20, 'BBA student', 'Dehradun', 'balanced'],
  ['Sameer Khan', 'male', 25, 'Data analyst', 'Dehradun', 'earlyBird'],
  ['Tara Dobhal', 'non_binary', 22, 'Fine arts student', 'Dehradun', 'wfhCreative'],
  ['Kunal Rana', 'male', 24, 'Bank PO aspirant', 'Dehradun', 'earlyBird'],
  ['Riya Semwal', 'female', 21, 'B.Tech student', 'Dehradun', 'nightOwl'],
  ['Dev Sharma', 'male', 23, 'Startup founder', 'Dehradun', 'balanced'],
  ['Aisha Verma', 'female', 25, 'Product manager', 'Delhi', 'balanced'],
  ['Harsh Gupta', 'male', 26, 'Consultant', 'Delhi', 'nightOwl'],
  ['Simran Kaur', 'female', 24, 'Architect', 'Delhi', 'earlyBird'],
  ['Nikhil Iyer', 'male', 27, 'Backend developer', 'Bengaluru', 'wfhCreative'],
  ['Pooja Reddy', 'female', 25, 'QA engineer', 'Bengaluru', 'balanced'],
  ['Rahul Menon', 'male', 26, 'Data scientist', 'Bengaluru', 'earlyBird'],
];
const BUDGETS = { Dehradun: [[4000, 8000], [5000, 9000], [6000, 11000], [7000, 12000]], Delhi: [[10000, 18000], [12000, 22000]], Bengaluru: [[12000, 20000], [15000, 25000]] };
const AREAS = { Dehradun: DEHRADUN_AREAS, Delhi: ['Hauz Khas', 'Lajpat Nagar', 'Saket'], Bengaluru: ['Koramangala', 'HSR Layout', 'Indiranagar'] };

function moveInDate(offsetDays) {
  const d = new Date('2026-11-14T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const hash = bcrypt.hashSync(SEED_PASSWORD, 10);

const ids = transaction(() => {
  for (const { filename } of db.prepare('SELECT filename FROM photos').all()) {
    fs.rmSync(path.join(UPLOAD_DIR, filename), { force: true });
  }
  db.exec(`DELETE FROM photos; DELETE FROM email_verifications; DELETE FROM agreements; DELETE FROM messages; DELETE FROM matches; DELETE FROM swipes; DELETE FROM blocks; DELETE FROM users;
           DELETE FROM sqlite_sequence;`);
  const insert = db.prepare(`
    INSERT INTO users (email, password_hash, name, age, gender, city, area, budget_min, budget_max, move_in,
                       housing, gender_pref, occupation, bio, interests, answers, onboarded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // The demo account: a balanced-ish student in Dehradun.
  const demoAnswers = answersFor(ARCHETYPES.balanced);
  const demoId = Number(insert.run(
    'demo@roomie.test', hash, 'Demo User', 21, 'female', 'Dehradun', 'Clement Town', 5000, 10000,
    moveInDate(30), 'either', 'any', 'B.Tech student',
    'Trying out Roomie! Tidy-ish, out at college most of the day, like a calm flat with the occasional movie night.',
    JSON.stringify(['Music', 'Coding', 'Trekking', 'Movies', 'Cooking']), JSON.stringify(demoAnswers),
  ).lastInsertRowid);

  const others = PEOPLE.map(([name, gender, age, occupation, city, type]) => {
    const a = ARCHETYPES[type];
    const [min, max] = pick(BUDGETS[city]);
    const email = `${name.split(' ')[0].toLowerCase()}@roomie.test`;
    return Number(insert.run(
      email, hash, name, age, gender, city, pick(AREAS[city]), min, max, moveInDate(Math.floor(rand() * 75)),
      pick(['have_room', 'need_room', 'either']), rand() < 0.25 ? 'same' : 'any', occupation, pick(a.bios),
      JSON.stringify(pickMany(a.interests, 3 + Math.floor(rand() * 3))), JSON.stringify(answersFor(a)),
    ).lastInsertRowid);
  });

  // A few Dehradun people have already liked the demo user → liking them back creates an instant match.
  const like = db.prepare("INSERT OR IGNORE INTO swipes (from_id, to_id, action) VALUES (?, ?, 'like')");
  for (const id of others.slice(0, 16).filter((_, i) => i % 3 === 0)) like.run(id, demoId);

  // About half the demo users get a verified badge. The domains use the reserved ".example" TLD so
  // fictional people are never shown as verified at a real college or company.
  const verify = db.prepare(`UPDATE users SET verified_email = ?, verified_type = ?, verified_org = ?,
                             verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`);
  others.forEach((id, i) => {
    if (i % 2 !== 0) return;
    const [name, , , occupation] = PEOPLE[i];
    const student = /student|aspirant/i.test(occupation);
    const org = student ? 'university.example' : 'company.example';
    verify.run(`${name.split(' ')[0].toLowerCase()}@${org}`, student ? 'student' : 'work', org, id);
  });

  // One existing match with a short conversation, so the chat screen isn't empty.
  const friend = others[2]; // Ishita
  like.run(demoId, friend);
  like.run(friend, demoId);
  const [ua, ub] = demoId < friend ? [demoId, friend] : [friend, demoId];
  const matchId = Number(db.prepare('INSERT INTO matches (user_a, user_b) VALUES (?, ?)').run(ua, ub).lastInsertRowid);
  const msg = db.prepare('INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)');
  msg.run(matchId, friend, 'Hey! Saw we matched — looks like we both want a tidy place. Are you still looking near Clement Town?');
  msg.run(matchId, demoId, 'Hi Ishita! Yes — ideally a 2BHK from next month. What budget are you thinking?');
  msg.run(matchId, friend, 'Around 8–9k each. Want to meet at a café this weekend and then check a couple of flats?');

  // A quieter, older conversation and a brand-new match, so the inbox shows read, unread and new states.
  const pair = (other) => (demoId < other ? [demoId, other] : [other, demoId]);
  const addMatch = (other, createdAt) => {
    like.run(demoId, other);
    like.run(other, demoId);
    return Number(db.prepare('INSERT INTO matches (user_a, user_b, created_at) VALUES (?, ?, ?)').run(...pair(other), createdAt).lastInsertRowid);
  };
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const meera = others[4];
  const older = addMatch(meera, ago(30));
  const oldMsg = db.prepare('INSERT INTO messages (match_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)');
  oldMsg.run(older, meera, 'Hi! I wake up early too. Do you cook at home or mostly order in?', ago(27));
  oldMsg.run(older, demoId, 'Mostly cook! Simple veg stuff on weekdays.', ago(26.98));
  oldMsg.run(older, demoId, "I'll check the agreement draft tonight and get back to you.", ago(26.97));
  addMatch(others[6], ago(1)); // Sana: matched an hour ago, no messages yet

  return { demoId, count: others.length + 1 };
});

console.log(`Seeded ${ids.count} users. Demo login: demo@roomie.test / ${SEED_PASSWORD}`);
