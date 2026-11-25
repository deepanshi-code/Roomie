import { Router } from 'express';
import { db, transaction } from '../db.js';
import { emitToUser, requireAuth } from '../auth.js';
import { compatibility } from '../matching.js';
import {
  getMatchBetween, getMatchForUser, getUserById, isBlockedEitherWay, publicUser,
} from '../users.js';

const router = Router();
const MAX_MESSAGE = 2000;

const messageDto = (m) => ({
  id: m.id, matchId: m.match_id, senderId: m.sender_id, body: m.body, createdAt: m.created_at,
});

/* ---------------------------------- Swipes --------------------------------- */

router.post('/swipes', requireAuth, (req, res) => {
  const me = req.userId;
  const toId = Number(req.body?.toId);
  const action = req.body?.action;
  if (!Number.isInteger(toId) || toId === me) return res.status(400).json({ error: 'Invalid user' });
  if (action !== 'like' && action !== 'pass') return res.status(400).json({ error: 'Action must be like or pass' });

  const target = getUserById(toId);
  if (!target?.onboarded || isBlockedEitherWay(me, toId)) return res.status(404).json({ error: 'Profile not found' });

  const matchId = transaction(() => {
    db.prepare(`
      INSERT INTO swipes (from_id, to_id, action) VALUES (?, ?, ?)
      ON CONFLICT (from_id, to_id) DO UPDATE SET action = excluded.action
    `).run(me, toId, action);

    if (action !== 'like') return null;
    const reciprocal = db.prepare(
      "SELECT 1 FROM swipes WHERE from_id = ? AND to_id = ? AND action = 'like'",
    ).get(toId, me);
    if (!reciprocal) return null;

    const [a, b] = me < toId ? [me, toId] : [toId, me];
    db.prepare('INSERT OR IGNORE INTO matches (user_a, user_b) VALUES (?, ?)').run(a, b);
    return getMatchBetween(a, b).id;
  });

  if (matchId) {
    // The swiper learns about the match from this response; notify the other person live.
    const meUser = getUserById(me);
    emitToUser(req, toId, 'match:new', {
      matchId, user: publicUser(meUser), score: compatibility(target, meUser).score,
    });
  }
  res.json({ matched: !!matchId, matchId });
});

/* --------------------------------- Matches --------------------------------- */

router.get('/matches', requireAuth, (req, res) => {
  const me = getUserById(req.userId);
  const rows = db.prepare(`
    SELECT m.id, m.created_at,
           CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END AS other_id,
           (SELECT body       FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_body,
           (SELECT sender_id  FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_sender,
           (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_at
    FROM matches m
    WHERE m.user_a = ? OR m.user_b = ?
  `).all(me.id, me.id, me.id);

  const matches = rows.map((r) => {
    const other = getUserById(r.other_id);
    return {
      id: r.id,
      createdAt: r.created_at,
      user: publicUser(other),
      score: compatibility(me, other).score,
      lastMessage: r.last_body ? { body: r.last_body, senderId: r.last_sender, createdAt: r.last_at } : null,
    };
  });
  matches.sort((x, y) => (y.lastMessage?.createdAt ?? y.createdAt).localeCompare(x.lastMessage?.createdAt ?? x.createdAt));
  res.json({ matches });
});

router.get('/matches/:id', requireAuth, (req, res) => {
  const match = getMatchForUser(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const me = getUserById(req.userId);
  const other = getUserById(match.otherId);
  res.json({
    match: { id: match.id, createdAt: match.created_at },
    user: publicUser(other),
    compatibility: compatibility(me, other),
  });
});

router.get('/matches/:id/messages', requireAuth, (req, res) => {
  const match = getMatchForUser(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const rows = db.prepare(`
    SELECT * FROM (SELECT * FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 200) ORDER BY id ASC
  `).all(match.id);
  res.json({ messages: rows.map(messageDto) });
});

router.post('/matches/:id/messages', requireAuth, (req, res) => {
  const match = getMatchForUser(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
  if (body.length > MAX_MESSAGE) return res.status(400).json({ error: `Message must be under ${MAX_MESSAGE} characters` });

  const info = db.prepare('INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)')
    .run(match.id, req.userId, body);
  const message = messageDto(db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid)));
  emitToUser(req, match.otherId, 'message:new', message);
  emitToUser(req, req.userId, 'message:new', message); // sync the sender's other tabs
  res.status(201).json({ message });
});

/** Unmatch: removes the match and its chat, and records a pass so they don't re-match instantly. */
router.delete('/matches/:id', requireAuth, (req, res) => {
  const match = getMatchForUser(Number(req.params.id), req.userId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  transaction(() => {
    db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
    db.prepare(`
      INSERT INTO swipes (from_id, to_id, action) VALUES (?, ?, 'pass')
      ON CONFLICT (from_id, to_id) DO UPDATE SET action = 'pass'
    `).run(req.userId, match.otherId);
  });
  emitToUser(req, match.otherId, 'match:removed', { matchId: match.id });
  res.json({ ok: true });
});

/* --------------------------------- Safety ---------------------------------- */

router.post('/blocks', requireAuth, (req, res) => {
  const otherId = Number(req.body?.userId);
  if (!Number.isInteger(otherId) || otherId === req.userId || !getUserById(otherId)) {
    return res.status(400).json({ error: 'Invalid user' });
  }
  const match = getMatchBetween(req.userId, otherId);
  transaction(() => {
    db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(req.userId, otherId);
    if (match) db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
  });
  if (match) emitToUser(req, otherId, 'match:removed', { matchId: match.id });
  res.json({ ok: true });
});

export default router;
