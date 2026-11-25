import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { compatibility } from '../matching.js';
import {
  getMatchBetween, getOnboardedUsers, getUserById, isBlockedEitherWay, publicUser,
} from '../users.js';

const router = Router();

/**
 * Ranked candidates for the current user.
 * NOTE: scores every onboarded user on each request — O(N). Fine for a prototype
 * with hundreds/thousands of users; see README "Scaling" for what to do beyond that.
 */
router.get('/discover', requireAuth, (req, res) => {
  const me = getUserById(req.userId);
  if (!me?.onboarded) return res.status(400).json({ error: 'Complete your profile first' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const verifiedOnly = req.query.verifiedOnly === '1';

  const excluded = new Set(db.prepare(`
    SELECT to_id AS id FROM swipes WHERE from_id = ?
    UNION SELECT blocked_id FROM blocks WHERE blocker_id = ?
    UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?
  `).all(me.id, me.id, me.id).map((r) => r.id));

  const results = [];
  for (const other of getOnboardedUsers()) {
    if (other.id === me.id || excluded.has(other.id)) continue;
    if (verifiedOnly && !other.verified) continue;
    const comp = compatibility(me, other);
    if (!comp.eligible) continue;
    results.push({ user: publicUser(other), compatibility: comp });
  }
  results.sort((a, b) => b.compatibility.score - a.compatibility.score);
  res.json({ results: results.slice(0, limit), total: results.length });
});

router.get('/users/:id', requireAuth, (req, res) => {
  const otherId = Number(req.params.id);
  const me = getUserById(req.userId);
  const other = getUserById(otherId);
  if (!other || !other.onboarded || otherId === me.id || isBlockedEitherWay(me.id, otherId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const swipe = db.prepare('SELECT action FROM swipes WHERE from_id = ? AND to_id = ?').get(me.id, otherId);
  const match = getMatchBetween(me.id, otherId);
  const relation = match
    ? { status: 'matched', matchId: match.id }
    : { status: swipe ? (swipe.action === 'like' ? 'liked' : 'passed') : 'none' };
  res.json({ user: publicUser(other), compatibility: compatibility(me, other), relation });
});

export default router;
