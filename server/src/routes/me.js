import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { getUserById, isProfileComplete } from '../users.js';
import { validateProfileUpdate } from '../validation.js';

const router = Router();

const COLUMN = {
  name: 'name', age: 'age', gender: 'gender', city: 'city', area: 'area',
  budgetMin: 'budget_min', budgetMax: 'budget_max', moveIn: 'move_in',
  housing: 'housing', genderPref: 'gender_pref', occupation: 'occupation', bio: 'bio',
  interests: 'interests', answers: 'answers', showGender: 'show_gender',
};

router.get('/', requireAuth, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please log in again' });
  res.json({ user });
});

router.put('/', requireAuth, (req, res) => {
  const current = getUserById(req.userId);
  if (!current) return res.status(401).json({ error: 'Please log in again' });

  const { data, errors } = validateProfileUpdate(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const merged = { ...current, ...data };
  if (merged.budgetMin != null && merged.budgetMax != null && merged.budgetMin > merged.budgetMax) {
    return res.status(400).json({ error: 'Minimum budget cannot be more than maximum budget' });
  }

  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(data)) {
    sets.push(`${COLUMN[key]} = ?`);
    values.push(key === 'interests' || key === 'answers' ? JSON.stringify(value) : key === 'showGender' ? Number(value) : value);
  }
  sets.push('onboarded = ?');
  values.push(isProfileComplete(merged) ? 1 : 0);

  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.userId);
  res.json({ user: getUserById(req.userId) });
});

export default router;
