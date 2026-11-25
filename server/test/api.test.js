import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
const { createServer } = await import('../src/app.js');
const { QUESTIONS } = await import('../src/questions.js');

let server;
let base;

before(async () => {
  ({ server } = createServer());
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise((resolve) => server.close(resolve)));

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const fullAnswers = () => Object.fromEntries(QUESTIONS.map((q) => [q.id, { value: 0, importance: 2 }]));
const profile = {
  age: 21, gender: 'female', city: 'Dehradun', budgetMin: 5000, budgetMax: 9000,
  housing: 'either', genderPref: 'any', interests: ['Music'], answers: fullAnswers(),
};

test('register → onboard → discover → mutual like → chat', async () => {
  const a = await call('/auth/register', { method: 'POST', body: { email: 'a@test.dev', password: 'password1', name: 'A' } });
  const b = await call('/auth/register', { method: 'POST', body: { email: 'b@test.dev', password: 'password1', name: 'B' } });
  assert.equal(a.status, 201);
  assert.equal(a.data.user.onboarded, false);

  const dup = await call('/auth/register', { method: 'POST', body: { email: 'A@test.dev', password: 'password1', name: 'A2' } });
  assert.equal(dup.status, 409, 'emails are case-insensitive');

  const badLogin = await call('/auth/login', { method: 'POST', body: { email: 'a@test.dev', password: 'nope' } });
  assert.equal(badLogin.status, 401);

  const ta = a.data.token;
  const tb = b.data.token;
  assert.equal((await call('/discover', { token: ta })).status, 400, 'must onboard first');

  const upd = await call('/me', { method: 'PUT', token: ta, body: profile });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.user.onboarded, true);
  await call('/me', { method: 'PUT', token: tb, body: profile });

  const disc = await call('/discover', { token: ta });
  assert.equal(disc.data.results.length, 1);
  assert.equal(disc.data.results[0].user.id, b.data.user.id);
  assert.equal(disc.data.results[0].user.email, undefined, 'email must not leak');
  assert.equal(disc.data.results[0].user.answers, undefined, 'raw answers must not leak');

  const like1 = await call('/swipes', { method: 'POST', token: ta, body: { toId: b.data.user.id, action: 'like' } });
  assert.equal(like1.data.matched, false);
  assert.equal((await call('/discover', { token: ta })).data.results.length, 0, 'swiped users disappear');

  const like2 = await call('/swipes', { method: 'POST', token: tb, body: { toId: a.data.user.id, action: 'like' } });
  assert.equal(like2.data.matched, true);
  const { matchId } = like2.data;

  const sent = await call(`/matches/${matchId}/messages`, { method: 'POST', token: ta, body: { body: '  Hi!  ' } });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.message.body, 'Hi!');

  const msgs = await call(`/matches/${matchId}/messages`, { token: tb });
  assert.deepEqual(msgs.data.messages.map((m) => m.body), ['Hi!']);

  const list = await call('/matches', { token: tb });
  assert.equal(list.data.matches[0].lastMessage.body, 'Hi!');

  // A third user cannot read the chat.
  const c = await call('/auth/register', { method: 'POST', body: { email: 'c@test.dev', password: 'password1', name: 'C' } });
  assert.equal((await call(`/matches/${matchId}/messages`, { token: c.data.token })).status, 404);

  // Blocking removes the match.
  assert.equal((await call('/blocks', { method: 'POST', token: tb, body: { userId: a.data.user.id } })).status, 200);
  assert.equal((await call('/matches', { token: ta })).data.matches.length, 0);
  assert.equal((await call(`/users/${b.data.user.id}`, { token: ta })).status, 404);
});

test('roommate agreement: generate → edit resets → both agree → stale version rejected', async () => {
  const mk = async (email) => {
    const r = await call('/auth/register', { method: 'POST', body: { email, password: 'password1', name: email[0].toUpperCase() } });
    await call('/me', { method: 'PUT', token: r.data.token, body: profile });
    return r.data;
  };
  const x = await mk('x@test.dev');
  const y = await mk('y@test.dev');
  await call('/swipes', { method: 'POST', token: x.token, body: { toId: y.user.id, action: 'like' } });
  const { data: { matchId } } = await call('/swipes', { method: 'POST', token: y.token, body: { toId: x.user.id, action: 'like' } });

  const first = (await call(`/matches/${matchId}/agreement`, { token: x.token })).data.agreement;
  assert.ok(first.clauses.length >= 10);
  assert.equal(first.version, 1);
  assert.equal(first.agreedByMe, null);

  // X agrees; Y sees it as "agreed by them".
  await call(`/matches/${matchId}/agreement/agree`, { method: 'POST', token: x.token, body: { version: 1 } });
  const yView = (await call(`/matches/${matchId}/agreement`, { token: y.token })).data.agreement;
  assert.ok(yView.agreedByThem);
  assert.equal(yView.agreedByMe, null);

  // Y edits one clause, removes one, adds a custom rule → version bumps and X's agreement is cleared.
  const edited = yView.clauses.slice(1).map((c) => (c.id === 'dishes' ? { ...c, text: 'Dishes done before bed.' } : c));
  edited.push({ id: null, title: 'Plants', text: 'We take turns watering the plants.' });
  const put = await call(`/matches/${matchId}/agreement`, { method: 'PUT', token: y.token, body: { version: 1, clauses: edited } });
  assert.equal(put.status, 200);
  const v2 = put.data.agreement;
  assert.equal(v2.version, 2);
  assert.equal(v2.agreedByThem, null, 'edits clear earlier agreements');
  assert.equal(v2.clauses.length, yView.clauses.length);
  assert.equal(v2.clauses.find((c) => c.id === 'dishes').edited, true);
  assert.equal(v2.clauses.at(-1).status, 'custom');

  // X tries to agree to the old version → 409 with the latest version attached.
  const stale = await call(`/matches/${matchId}/agreement/agree`, { method: 'POST', token: x.token, body: { version: 1 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.agreement.version, 2);

  await call(`/matches/${matchId}/agreement/agree`, { method: 'POST', token: x.token, body: { version: 2 } });
  const done = (await call(`/matches/${matchId}/agreement/agree`, { method: 'POST', token: y.token, body: { version: 2 } })).data.agreement;
  assert.ok(done.agreedByMe && done.agreedByThem);

  // Validation + access control.
  const bad = await call(`/matches/${matchId}/agreement`, { method: 'PUT', token: y.token, body: { version: 2, clauses: [{ title: '', text: 'x' }] } });
  assert.equal(bad.status, 400);
  const outsider = await mk('z@test.dev');
  assert.equal((await call(`/matches/${matchId}/agreement`, { token: outsider.token })).status, 404);
});

test('profile validation rejects bad input', async () => {
  const r = await call('/auth/register', { method: 'POST', body: { email: 'v@test.dev', password: 'password1', name: 'V' } });
  const res = await call('/me', { method: 'PUT', token: r.data.token, body: { age: 12, budgetMin: 9000, budgetMax: 100 } });
  assert.equal(res.status, 400);
  assert.ok(res.data.errors.length >= 2);
  assert.equal((await call('/me', { token: 'garbage' })).status, 401);
});

test('hidden gender is never sent to others but still used for matching', async () => {
  const mk = async (email) => {
    const r = await call('/auth/register', { method: 'POST', body: { email, password: 'password1', name: email[0].toUpperCase() } });
    return { id: r.data.user.id, token: r.data.token };
  };
  const h = await mk('hide@test.dev');
  const s = await mk('same@test.dev');
  await call('/me', { method: 'PUT', token: h.token, body: { ...profile, gender: 'female' } });
  await call('/me', { method: 'PUT', token: s.token, body: { ...profile, gender: 'female', genderPref: 'same' } });

  assert.equal((await call('/me', { method: 'PUT', token: h.token, body: { showGender: 'no' } })).status, 400);
  const hidden = await call('/me', { method: 'PUT', token: h.token, body: { showGender: false } });
  assert.equal(hidden.data.user.showGender, false);
  assert.equal(hidden.data.user.gender, 'female', 'you still see your own gender');

  const disc = await call('/discover', { token: s.token });
  const card = disc.data.results.find((r) => r.user.id === h.id);
  assert.ok(card, '"same gender only" still matches on the hidden gender');
  assert.equal(card.user.gender, null);
  assert.equal(card.user.showGender, undefined, 'the setting itself is private');
  assert.equal((await call(`/users/${h.id}`, { token: s.token })).data.user.gender, null);

  await call('/swipes', { method: 'POST', token: h.token, body: { toId: s.id, action: 'like' } });
  const like = await call('/swipes', { method: 'POST', token: s.token, body: { toId: h.id, action: 'like' } });
  assert.equal(like.data.matched, true);
  assert.equal((await call('/matches', { token: s.token })).data.matches[0].user.gender, null);
  assert.equal((await call(`/matches/${like.data.matchId}`, { token: s.token })).data.user.gender, null);

  await call('/me', { method: 'PUT', token: h.token, body: { showGender: true } });
  assert.equal((await call(`/users/${h.id}`, { token: s.token })).data.user.gender, 'female');
});
