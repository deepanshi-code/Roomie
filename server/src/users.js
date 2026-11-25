import { db } from './db.js';
import { QUESTIONS } from './questions.js';

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    age: row.age,
    gender: row.gender,
    city: row.city,
    area: row.area,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    moveIn: row.move_in,
    housing: row.housing,
    genderPref: row.gender_pref,
    showGender: row.show_gender == null ? true : !!row.show_gender,
    occupation: row.occupation,
    bio: row.bio,
    interests: JSON.parse(row.interests || '[]'),
    answers: JSON.parse(row.answers || '{}'),
    onboarded: !!row.onboarded,
    createdAt: row.created_at,
    photos: getPhotos(row.id),
    // Public badge: the type and the email's domain, never the address itself.
    verified: row.verified_type ? { type: row.verified_type, org: row.verified_org, at: row.verified_at } : null,
    verifiedEmail: row.verified_email ?? null,
  };
}

export function getPhotos(userId) {
  return db.prepare('SELECT id, filename FROM photos WHERE user_id = ? ORDER BY position, id')
    .all(userId)
    .map((p) => ({ id: p.id, url: `/uploads/${p.filename}` }));
}

/** What other users may see. Emails and raw answers (importance, dealbreakers) stay private. */
export function publicUser(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { email, answers, verifiedEmail, showGender, ...rest } = user;
  // Hidden gender is still used for matching (e.g. "same gender only"), but never sent to others.
  return showGender ? rest : { ...rest, gender: null };
}

export function getUserById(id) {
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function getOnboardedUsers() {
  return db.prepare('SELECT * FROM users WHERE onboarded = 1').all().map(rowToUser);
}

export function isProfileComplete(u) {
  const basics = u.name && u.age && u.gender && u.city && u.housing
    && u.budgetMin != null && u.budgetMax != null;
  const answered = QUESTIONS.every((q) => Number.isInteger(u.answers?.[q.id]?.value));
  return !!(basics && answered);
}

export function isBlockedEitherWay(a, b) {
  return !!db.prepare(
    'SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
  ).get(a, b, b, a);
}

/** Returns the match row if `userId` is part of it, else null. */
export function getMatchForUser(matchId, userId) {
  const m = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!m || (m.user_a !== userId && m.user_b !== userId)) return null;
  return { ...m, otherId: m.user_a === userId ? m.user_b : m.user_a };
}

export function getMatchBetween(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return db.prepare('SELECT * FROM matches WHERE user_a = ? AND user_b = ?').get(x, y) ?? null;
}
