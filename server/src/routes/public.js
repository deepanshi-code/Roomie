import { Router } from 'express';
import { db } from '../db.js';
import { getOnboardedUsers } from '../users.js';

/**
 * Public, no-login preview for the landing page ("Try it now").
 *
 * PRIVACY: anonymous visitors only get a limited card: first name, age, occupation, area, budget,
 * housing, verified type, a few interests and the lifestyle answers used for tags/quick match.
 * Never: photos, bio, full name, email, verified email/domain, importance or dealbreakers.
 * Cities with fewer than MIN_PER_CITY people are not listed, so small groups aren't singled out.
 */
const router = Router();
const MIN_PER_CITY = 3;
const MAX_PEOPLE = 12;
const PREVIEW_QUESTIONS = ['sleep', 'dishes', 'guests', 'smoking', 'tidiness', 'social', 'noise', 'diet', 'pets', 'homeTime', 'cooking'];

function previewCard(u, index) {
  const values = {};
  for (const q of PREVIEW_QUESTIONS) {
    if (Number.isInteger(u.answers?.[q]?.value)) values[q] = u.answers[q].value;
  }
  return {
    key: index, // position only; real user ids aren't exposed
    firstName: u.name.split(' ')[0],
    age: u.age,
    occupation: u.occupation || null,
    area: u.area || null,
    city: u.city,
    budgetMin: u.budgetMin,
    budgetMax: u.budgetMax,
    housing: u.housing,
    verified: u.verified ? u.verified.type : null,
    interests: (u.interests ?? []).slice(0, 4),
    values,
  };
}

router.get('/public/preview', (req, res) => {
  const cities = db.prepare(`
    SELECT MIN(city) AS city, COUNT(*) AS count FROM users
    WHERE onboarded = 1 AND city IS NOT NULL
    GROUP BY LOWER(TRIM(city)) HAVING COUNT(*) >= ? ORDER BY count DESC
  `).all(MIN_PER_CITY);

  const wanted = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';
  const city = cities.find((c) => c.city.trim().toLowerCase() === wanted) ?? cities[0] ?? null;

  const people = city
    ? getOnboardedUsers()
      .filter((u) => u.city.trim().toLowerCase() === city.city.trim().toLowerCase())
      .slice(0, MAX_PEOPLE)
      .map(previewCard)
    : [];

  res.set('Cache-Control', 'public, max-age=60');
  res.json({ cities, city: city?.city ?? null, people });
});

export default router;
