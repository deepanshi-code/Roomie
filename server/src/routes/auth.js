import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, wrap } from '../auth.js';
import { getUserById } from '../users.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', wrap(async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 8–128 characters' });
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) {
    return res.status(400).json({ error: 'Enter your name (max 50 characters)' });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(cleanEmail, hash, name.trim());
  const user = getUserById(Number(info.lastInsertRowid));
  res.status(201).json({ token: signToken(user.id), user });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body ?? {};
  const row = typeof email === 'string'
    ? db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email.trim().toLowerCase())
    : null;
  // Same message whether the email or the password is wrong, so emails can't be enumerated.
  const ok = row && typeof password === 'string' && await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(row.id), user: getUserById(row.id) });
}));

export default router;
