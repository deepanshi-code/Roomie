/**
 * Email-domain verification.
 *
 * WHAT IT PROVES: the user can read mail sent to an address at that domain.
 * WHAT IT DOESN'T PROVE: that they currently study/work there, or that a "work" domain
 * is a real company (anyone can buy a domain). That's why the badge always shows the
 * domain, so people can judge it themselves, and why personal mail providers are refused.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { JWT_SECRET } from './config.js';

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@([a-z0-9-]+(\.[a-z0-9-]+)+)$/i;

// Personal mailbox providers: an address here says nothing about a college or employer.
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'rediffmail.com', 'zoho.com', 'zohomail.in',
  'yandex.com', 'gmx.com', 'mail.com', 'tutanota.com', 'fastmail.com',
]);

// Academic domains: *.ac.in, *.edu, *.edu.in, *.ac.uk, *.edu.au, …
const ACADEMIC_RE = /\.(ac|edu)(\.[a-z]{2})?$/i;

/** Returns { ok: true, email, type: 'student'|'work', org } or { ok: false, error }. */
export function classifyEmail(input) {
  const email = String(input ?? '').trim().toLowerCase();
  const m = EMAIL_RE.exec(email);
  if (!m || email.length > 254) return { ok: false, error: 'Enter a valid email address' };
  const domain = m[1];
  if (PERSONAL_DOMAINS.has(domain)) {
    return { ok: false, error: 'Use your college or work email. Personal addresses like Gmail can\'t verify where you study or work.' };
  }
  return { ok: true, email, type: ACADEMIC_RE.test(domain) ? 'student' : 'work', org: domain };
}

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Codes are stored as an HMAC (keyed with the server secret), never in plain text. */
export const hashCode = (userId, code) => createHmac('sha256', JWT_SECRET).update(`${userId}:${code}`).digest('hex');

export function codeMatches(userId, code, storedHash) {
  const a = Buffer.from(hashCode(userId, String(code ?? '').trim()), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
