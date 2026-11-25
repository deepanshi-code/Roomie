// Public landing-page preview: works without login and never leaks private fields.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DB_PATH = ':memory:';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roomie-public-'));
const { createServer } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const { QUESTIONS } = await import('../src/questions.js');

let server;
let base;
before(async () => {
  ({ server } = createServer());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise((r) => server.close(r)));

const call = async (p, opts = {}) => {
  const res = await fetch(base + p, { headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) }, method: opts.method ?? 'GET', body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: res.status, data: await res.json() };
};

async function makeUser(name, city) {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@test.dev`;
  const r = await call('/auth/register', { method: 'POST', body: { email, password: 'password1', name } });
  await call('/me', {
    method: 'PUT', token: r.data.token,
    body: {
      age: 22, gender: 'female', city, budgetMin: 5000, budgetMax: 9000, housing: 'either', genderPref: 'any',
      bio: 'SECRET BIO TEXT', interests: ['Music', 'Coding', 'Trekking', 'Yoga', 'Chess'],
      answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, { value: 1, importance: 3, dealbreaker: true }])),
    },
  });
  return r.data.user;
}

test('public preview: no login, limited fields, small cities hidden', async () => {
  for (const n of ['Asha Kapoor', 'Bela Singh', 'Chitra Rao']) await makeUser(n, 'Dehradun');
  const lonely = await makeUser('Dina Lone', 'Shimla'); // only one person there
  db.prepare("UPDATE users SET verified_email = 'asha@uni.ac.in', verified_type = 'student', verified_org = 'uni.ac.in' WHERE email = 'asha.kapoor@test.dev'").run();

  const r = await call('/public/preview');
  assert.equal(r.status, 200, 'works without a token');
  assert.equal(r.data.city, 'Dehradun');
  assert.deepEqual(r.data.cities.map((c) => c.city), ['Dehradun'], 'cities with fewer than 3 people are not listed');
  assert.equal(r.data.people.length, 3);

  const p = r.data.people.find((x) => x.firstName === 'Asha');
  assert.equal(p.verified, 'student');
  assert.equal(p.interests.length, 4, 'only a few interests');
  assert.equal(p.values.sleep, 1);

  const raw = JSON.stringify(r.data);
  for (const secret of ['Kapoor', 'SECRET BIO', '@test.dev', 'uni.ac.in', 'importance', 'dealbreaker', 'photos', '"id"']) {
    assert.equal(raw.includes(secret), false, `must not expose ${secret}`);
  }

  // Asking for a hidden city falls back to the default instead of revealing it.
  const shimla = await call('/public/preview?city=Shimla');
  assert.equal(shimla.data.city, 'Dehradun');
  assert.equal(JSON.stringify(shimla.data).includes(lonely.name.split(' ')[0]), false);
});
