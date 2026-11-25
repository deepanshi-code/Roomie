import { Router } from 'express';
import { db } from '../db.js';
import { emitToUser, requireAuth } from '../auth.js';
import { generateClauses } from '../agreement.js';
import { getMatchForUser, getUserById } from '../users.js';

const router = Router();
const MAX_CLAUSES = 30;
const MAX_TITLE = 80;
const MAX_TEXT = 600;
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function load(match) {
  let row = db.prepare('SELECT * FROM agreements WHERE match_id = ?').get(match.id);
  if (!row) {
    const clauses = generateClauses(getUserById(match.user_a), getUserById(match.user_b));
    db.prepare('INSERT INTO agreements (match_id, clauses) VALUES (?, ?)').run(match.id, JSON.stringify(clauses));
    row = db.prepare('SELECT * FROM agreements WHERE match_id = ?').get(match.id);
  }
  return row;
}

function dto(row, match, userId) {
  const iAmA = match.user_a === userId;
  return {
    matchId: match.id,
    clauses: JSON.parse(row.clauses),
    version: row.version,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    agreedByMe: iAmA ? row.agreed_a : row.agreed_b,
    agreedByThem: iAmA ? row.agreed_b : row.agreed_a,
  };
}

/** Loads the match + agreement and checks optimistic-concurrency version. Sends the response on failure. */
function prepare(req, res, { checkVersion = true } = {}) {
  const match = getMatchForUser(Number(req.params.id), req.userId);
  if (!match) { res.status(404).json({ error: 'Match not found' }); return null; }
  const row = load(match);
  if (checkVersion && Number(req.body?.version) !== row.version) {
    res.status(409).json({
      error: 'Your roommate changed the agreement while you were looking. Review the latest version.',
      agreement: dto(row, match, req.userId),
    });
    return null;
  }
  return { match, row };
}

function respond(req, res, match) {
  const row = db.prepare('SELECT * FROM agreements WHERE match_id = ?').get(match.id);
  emitToUser(req, match.otherId, 'agreement:updated', { matchId: match.id });
  res.json({ agreement: dto(row, match, req.userId) });
}

router.get('/matches/:id/agreement', requireAuth, (req, res) => {
  const ctx = prepare(req, res, { checkVersion: false });
  if (ctx) res.json({ agreement: dto(ctx.row, ctx.match, req.userId) });
});

/** Replace the clause list (edit / add / remove / reorder). Clears both agreements. */
router.put('/matches/:id/agreement', requireAuth, (req, res) => {
  const ctx = prepare(req, res);
  if (!ctx) return;
  const incoming = req.body?.clauses;
  if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > MAX_CLAUSES) {
    return res.status(400).json({ error: `An agreement needs 1–${MAX_CLAUSES} rules` });
  }

  const existing = new Map(JSON.parse(ctx.row.clauses).map((c) => [c.id, c]));
  const seen = new Set();
  const clauses = [];
  for (const [i, c] of incoming.entries()) {
    const title = typeof c?.title === 'string' ? c.title.trim() : '';
    const text = typeof c?.text === 'string' ? c.text.trim() : '';
    if (!title || title.length > MAX_TITLE) return res.status(400).json({ error: `Rule ${i + 1}: title must be 1–${MAX_TITLE} characters` });
    if (!text || text.length > MAX_TEXT) return res.status(400).json({ error: `Rule "${title}": text must be 1–${MAX_TEXT} characters` });

    const prev = existing.get(c.id);
    if (prev && !seen.has(prev.id)) {
      seen.add(prev.id);
      // Server keeps ownership of generated metadata (status, basis, rationale); only wording is editable.
      clauses.push({ ...prev, title, text, edited: prev.edited || title !== prev.title || text !== prev.text });
    } else {
      clauses.push({
        id: `custom-${ctx.row.version}-${i}`, topic: 'Your own rules', title, text,
        rationale: 'Added by one of you.', status: 'custom', basis: [], edited: true,
      });
    }
  }

  db.prepare(`UPDATE agreements SET clauses = ?, version = version + 1, agreed_a = NULL, agreed_b = NULL,
              updated_by = ?, updated_at = ${NOW} WHERE match_id = ?`)
    .run(JSON.stringify(clauses), req.userId, ctx.match.id);
  respond(req, res, ctx.match);
});

/** Agree to the current version. */
router.post('/matches/:id/agreement/agree', requireAuth, (req, res) => {
  const ctx = prepare(req, res);
  if (!ctx) return;
  const col = ctx.match.user_a === req.userId ? 'agreed_a' : 'agreed_b';
  db.prepare(`UPDATE agreements SET ${col} = COALESCE(${col}, ${NOW}) WHERE match_id = ?`).run(ctx.match.id);
  respond(req, res, ctx.match);
});

/** Throw away edits and rebuild the draft from both people's current answers. */
router.post('/matches/:id/agreement/regenerate', requireAuth, (req, res) => {
  const ctx = prepare(req, res);
  if (!ctx) return;
  const clauses = generateClauses(getUserById(ctx.match.user_a), getUserById(ctx.match.user_b));
  db.prepare(`UPDATE agreements SET clauses = ?, version = version + 1, agreed_a = NULL, agreed_b = NULL,
              updated_by = ?, updated_at = ${NOW} WHERE match_id = ?`)
    .run(JSON.stringify(clauses), req.userId, ctx.match.id);
  respond(req, res, ctx.match);
});

export default router;
