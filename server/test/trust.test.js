// Photos + email verification ("trust" features).
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roomie-uploads-'));
process.env.DB_PATH = ':memory:';
process.env.UPLOAD_DIR = uploadDir;
const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const { QUESTIONS } = await import('../src/questions.js');
const { classifyEmail } = await import('../src/verification.js');
const { sniffImage } = await import('../src/routes/photos.js');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

let server;
let base;
before(async () => {
  ({ server } = createServer());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

async function call(p, { method = 'GET', body, token, form } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { /* binary */ }
  return { status: res.status, data, headers: res.headers };
}
const upload = (token, buf, name = 'x.png', type = 'image/png') => {
  const form = new FormData();
  form.append('photo', new Blob([buf], { type }), name);
  return call('/api/me/photos', { method: 'POST', token, form });
};
async function register(email) {
  const r = await call('/api/auth/register', { method: 'POST', body: { email, password: 'password1', name: email.split('@')[0] } });
  return r.data;
}

/* ------------------------------- unit tests ------------------------------- */

test('classifyEmail: academic vs work vs personal', () => {
  assert.deepEqual(classifyEmail(' Student@GEU.ac.in '), { ok: true, email: 'student@geu.ac.in', type: 'student', org: 'geu.ac.in' });
  assert.equal(classifyEmail('a@mit.edu').type, 'student');
  assert.equal(classifyEmail('a@cs.ox.ac.uk').type, 'student');
  assert.equal(classifyEmail('a@infosys.com').type, 'work');
  assert.equal(classifyEmail('a@gmail.com').ok, false);
  assert.equal(classifyEmail('a@yahoo.co.in').ok, false);
  assert.equal(classifyEmail('not-an-email').ok, false);
  assert.equal(classifyEmail('a@education.com').type, 'work', '"edu" must be a domain label, not a substring');
});

test('sniffImage trusts bytes, not names', () => {
  assert.equal(sniffImage(PNG), 'png');
  assert.equal(sniffImage(JPG), 'jpg');
  assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'webp');
  assert.equal(sniffImage(HTML), null);
});

/* ------------------------------- photo API -------------------------------- */

test('photos: upload, type check, limit, reorder, delete, ownership', async () => {
  const a = await register('photo-a@test.dev');
  const b = await register('photo-b@test.dev');

  const fake = await upload(a.token, HTML, 'evil.png', 'image/png');
  assert.equal(fake.status, 400, 'HTML renamed to .png is rejected');

  const first = await upload(a.token, PNG);
  assert.equal(first.status, 201);
  const url = first.data.photos[0].url;
  assert.match(url, /^\/uploads\/[0-9a-f-]{36}\.png$/, 'random server-side filename');

  const served = await call(url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');

  for (let i = 0; i < 5; i += 1) await upload(a.token, JPG, 'p.jpg', 'image/jpeg');
  const seventh = await upload(a.token, PNG);
  assert.equal(seventh.status, 400, 'max 6 photos');

  const me = (await call('/api/me', { token: a.token })).data.user;
  assert.equal(me.photos.length, 6);
  const ids = me.photos.map((p) => p.id);
  const reordered = await call('/api/me/photos/order', { method: 'PUT', token: a.token, body: { ids: [...ids].reverse() } });
  assert.deepEqual(reordered.data.photos.map((p) => p.id), [...ids].reverse());
  assert.equal((await call('/api/me/photos/order', { method: 'PUT', token: a.token, body: { ids: ids.slice(1) } })).status, 400);

  assert.equal((await call(`/api/me/photos/${ids[0]}`, { method: 'DELETE', token: b.token })).status, 404, "can't delete someone else's photo");
  const del = await call(`/api/me/photos/${ids[0]}`, { method: 'DELETE', token: a.token });
  assert.equal(del.data.photos.length, 5);
  assert.equal((await call(url)).status, 404, 'file removed from disk');

  // Path traversal must never serve server files. (With a built client, unknown paths fall back to
  // index.html with 200, so check the content rather than the status code.)
  for (const p of ['/api/uploads/../../package.json', '/uploads/..%2f..%2fpackage.json', '/uploads/%2e%2e/%2e%2e/package.json']) {
    const r = await call(p);
    assert.notEqual(r.data.name, 'roomie-server', `traversal leaked package.json via ${p}`);
  }
});

/* ---------------------------- verification API ---------------------------- */

test('verification: code flow, wrong codes, cooldown, expiry, uniqueness, privacy', async () => {
  const a = await register('ver-a@test.dev');
  const b = await register('ver-b@test.dev');

  assert.equal((await call('/api/me/verify/start', { method: 'POST', token: a.token, body: { email: 'me@gmail.com' } })).status, 400);

  const start = await call('/api/me/verify/start', { method: 'POST', token: a.token, body: { email: 'A.Student@Uni.ac.in' } });
  assert.equal(start.status, 200);
  assert.equal(start.data.type, 'student');
  assert.match(start.data.devCode, /^\d{6}$/, 'dev mode shows the code (no SMTP configured)');
  const stored = db.prepare('SELECT code_hash FROM email_verifications WHERE user_id = ?').get(a.user.id);
  assert.notEqual(stored.code_hash, start.data.devCode, 'code is not stored in plain text');

  const again = await call('/api/me/verify/start', { method: 'POST', token: a.token, body: { email: 'a.student@uni.ac.in' } });
  assert.equal(again.status, 429, 'resend cooldown');

  const wrong = start.data.devCode === '000000' ? '111111' : '000000';
  const bad = await call('/api/me/verify/confirm', { method: 'POST', token: a.token, body: { code: wrong } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /4 tries left/);

  const ok = await call('/api/me/verify/confirm', { method: 'POST', token: a.token, body: { code: start.data.devCode } });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.data.user.verified.type, ok.data.user.verified.org], ['student', 'uni.ac.in']);

  // Other users see the badge but not the address.
  await call('/api/me', { method: 'PUT', token: a.token, body: onboarding() });
  await call('/api/me', { method: 'PUT', token: b.token, body: onboarding() });
  const disc = await call('/api/discover?verifiedOnly=1', { token: b.token });
  const seen = disc.data.results.find((r) => r.user.id === a.user.id).user;
  assert.equal(seen.verified.org, 'uni.ac.in');
  assert.equal(seen.verifiedEmail, undefined);
  assert.equal(JSON.stringify(disc.data).includes('a.student@uni.ac.in'), false);
  assert.equal((await call('/api/discover?verifiedOnly=1', { token: a.token })).data.results.length, 0, 'b is not verified');

  // Same address can't verify a second account.
  const dup = await call('/api/me/verify/start', { method: 'POST', token: b.token, body: { email: 'a.student@uni.ac.in' } });
  assert.equal(dup.status, 409);

  // Expiry and attempt limit.
  const s2 = await call('/api/me/verify/start', { method: 'POST', token: b.token, body: { email: 'b@company.com' } });
  db.prepare('UPDATE email_verifications SET expires_at = 0 WHERE user_id = ?').run(b.user.id);
  const expired = await call('/api/me/verify/confirm', { method: 'POST', token: b.token, body: { code: s2.data.devCode } });
  assert.match(expired.data.error, /expired/);
  db.prepare('UPDATE email_verifications SET expires_at = ?, attempts = 5 WHERE user_id = ?').run(Date.now() + 60000, b.user.id);
  const locked = await call('/api/me/verify/confirm', { method: 'POST', token: b.token, body: { code: s2.data.devCode } });
  assert.match(locked.data.error, /Too many/, 'even the right code is refused after 5 misses');

  // Removing the badge.
  const removed = await call('/api/me/verify', { method: 'DELETE', token: a.token });
  assert.equal(removed.data.user.verified, null);
});

function onboarding() {
  return {
    age: 21, gender: 'female', city: 'Dehradun', budgetMin: 5000, budgetMax: 9000, housing: 'either', genderPref: 'any',
    answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, { value: 0, importance: 2 }])),
  };
}
