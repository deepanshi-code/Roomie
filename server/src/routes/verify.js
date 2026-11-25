import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, wrap } from '../auth.js';
import { IS_PROD } from '../config.js';
import { isConsoleMailer, sendMail } from '../mailer.js';
import { getUserById } from '../users.js';
import {
  CODE_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, classifyEmail, codeMatches, generateCode, hashCode,
} from '../verification.js';

const router = Router();

/** Step 1: send a 6-digit code to a college/work email. */
router.post('/me/verify/start', requireAuth, wrap(async (req, res) => {
  const result = classifyEmail(req.body?.email);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const taken = db.prepare('SELECT 1 FROM users WHERE verified_email = ? AND id != ?').get(result.email, req.userId);
  if (taken) return res.status(409).json({ error: 'This email already verifies another account' });

  const now = Date.now();
  const pending = db.prepare('SELECT sent_at FROM email_verifications WHERE user_id = ?').get(req.userId);
  if (pending && now - pending.sent_at < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - pending.sent_at)) / 1000);
    return res.status(429).json({ error: `Please wait ${wait}s before requesting another code`, retryAfter: wait });
  }

  const code = generateCode();
  db.prepare(`
    INSERT INTO email_verifications (user_id, email, code_hash, expires_at, sent_at, attempts)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT (user_id) DO UPDATE SET email = excluded.email, code_hash = excluded.code_hash,
      expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = 0
  `).run(req.userId, result.email, hashCode(req.userId, code), now + CODE_TTL_MS, now);

  await sendMail({
    to: result.email,
    subject: `Your Roomie verification code: ${code}`,
    text: `Your code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, you can ignore this email.`,
  });

  res.json({
    sentTo: result.email,
    type: result.type,
    org: result.org,
    expiresInMinutes: CODE_TTL_MS / 60000,
    resendInSeconds: RESEND_COOLDOWN_MS / 1000,
    // Local development only: there is no real mail server, so show the code in the app.
    ...(isConsoleMailer && !IS_PROD ? { devCode: code } : {}),
  });
}));

/** Step 2: confirm the code. */
router.post('/me/verify/confirm', requireAuth, (req, res) => {
  const pending = db.prepare('SELECT * FROM email_verifications WHERE user_id = ?').get(req.userId);
  if (!pending) return res.status(400).json({ error: 'Request a code first' });
  if (Date.now() > pending.expires_at) return res.status(400).json({ error: 'This code has expired. Request a new one.' });
  if (pending.attempts >= MAX_ATTEMPTS) return res.status(400).json({ error: 'Too many wrong attempts. Request a new code.' });

  if (!codeMatches(req.userId, req.body?.code, pending.code_hash)) {
    db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = ?').run(req.userId);
    const left = MAX_ATTEMPTS - pending.attempts - 1;
    return res.status(400).json({ error: left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong attempts. Request a new code.' });
  }

  const info = classifyEmail(pending.email);
  try {
    db.prepare(`UPDATE users SET verified_email = ?, verified_type = ?, verified_org = ?,
                verified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(info.email, info.type, info.org, req.userId);
  } catch {
    // Unique index: someone else verified this address between start and confirm.
    return res.status(409).json({ error: 'This email already verifies another account' });
  }
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(req.userId);
  res.json({ user: getUserById(req.userId) });
});

/** Remove the badge (e.g. after leaving a college or job). */
router.delete('/me/verify', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET verified_email = NULL, verified_type = NULL, verified_org = NULL, verified_at = NULL WHERE id = ?')
    .run(req.userId);
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(req.userId);
  res.json({ user: getUserById(req.userId) });
});

export default router;
