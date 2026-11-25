# Roomie — find a roommate you can actually live with

Most roommate platforms match on **rent and location**. Roommate arrangements usually fall apart over
**day-to-day habits**: sleep times, dishes, guests, noise, smoking, food, and how money is split.
Roomie matches people on those habits, explains every score, and only lets two people chat once
both have liked each other.

**Stack:** React 18 + Vite · Node.js + Express · SQLite (built into Node 22+, no install) · Socket.IO · JWT auth

---

## Quick start

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`). Tested on Node 24.

```bash
npm install        # installs server + client (npm workspaces)
npm run seed       # creates the database with 23 demo users (resets all data!)
npm run dev        # API on http://localhost:4100, app on http://localhost:5180
```

Open http://localhost:5180 and log in with the local demo account:
**`demo@roomie.test` / `demo1234`** (every seeded user has the same test password).
A few seeded users have already liked the demo user, so liking them back gives an instant match.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Matching-engine unit tests + API integration test (in-memory DB) |
| `npm run build` | Builds the React app to `client/dist` |
| `npm start` | Runs the API; it also serves `client/dist` if built (single-origin production mode) |

Configuration: copy `server/.env.example` → `server/.env`. **Set `JWT_SECRET` before deploying.**
The server refuses to start in production without it.

---

## Features

- **Sign up / log in** with bcrypt-hashed passwords and a JWT
- **Onboarding** in 7 steps: basics (city, budget, move-in, housing, gender preference) → bio and interests → 16 lifestyle questions in 5 categories
- Each question has your answer, **how much it matters** (4 levels), and an optional **dealbreaker**
- **Discover**: candidates ranked by compatibility, each card showing *why you'd get along* and *what to talk about first*
- **Full comparison** page: per-category bars and every answer side by side
- **Like / pass**; a **mutual like = match**, and the other person is notified in real time
- **Profiles** in a two-column layout: photo, gender, occupation and area on the left with a profile-strength checklist; basics, bio, interests, lifestyle answers, verification and settings on the right. People can hide their gender with a "Show my gender" switch (it is still used for "same gender only" matching), and "Prefer not to say" is never shown
- **Inbox** with the match list, chat and match details side by side on wide screens (separate screens on phones); unread markers are kept per device in localStorage
- **Real-time chat** (Socket.IO) with typing indicator, grouped messages, a growing message box (Enter sends, Shift+Enter adds a line), conversation starters built from the pair's biggest differences, and safety tips for meeting up
- **Roommate agreement** for every match: a draft set of house rules generated from both people's
  answers, which both can edit, agree to, and print or save as PDF (see below)
- **Profile photos** (up to 6) with a gallery on profile cards and photo avatars across the app
- **Verified badge** from a college or work email, plus a **"Verified people only"** filter in Discover
- **Unmatch** and **block**
- Responsive layout (bottom nav on mobile) and dark mode

---

## Photos and verification (trust features)

Strangers won't meet someone who has no face and no proof of who they are, so these two features
are about **trust**.

**Photos** (`server/src/routes/photos.js`, `client/src/components/PhotoManager.jsx`)
- The browser **resizes** each photo (max 1280px) and re-encodes it as JPEG. This also **strips EXIF
  metadata**, which on phone photos often contains the GPS location where the picture was taken.
- The server checks the file's **actual bytes** (JPEG, PNG and WebP signatures), not its name or the
  browser's claimed type. An HTML file renamed to `.png` is rejected.
- Stored files get **random names**, and they're served with `X-Content-Type-Options: nosniff`.
- Limits: 6 photos, 5 MB each. The first photo is the main one.

**Verification** (`server/src/verification.js`, `routes/verify.js`)
- The user enters a college or work email → the server emails a **6-digit code** → the user enters it
  → they get a badge: *Verified student · geu.ac.in* or *Verified work email · company.com*.
- Domains ending in `.ac.in`, `.edu`, `.edu.in`, `.ac.uk` and similar count as **student**. Personal
  providers (Gmail, Yahoo, Outlook…) are **refused**. Everything else counts as **work**.
- The code is stored only as an HMAC. It expires after 15 minutes, allows **5 attempts**, and can be
  resent after 60 seconds. One email can verify only **one account**.
- Others see the badge and the **domain**, never the email address.
- **Email delivery:** set `SMTP_URL` in `server/.env` to send real emails. Without it, the code is
  printed in the server console and shown in the app as "Development mode" (never in production).

**What the badge does *not* prove** (be honest about this in your evaluation):
- It proves the person can read mail at that domain, **not** that they currently study or work
  there. Alumni often keep their college email.
- Anyone can buy a domain, so a "work" badge from `myname-company.com` means little. That's why the
  domain is always shown.
- Stronger options for later: verifying with a college ID or a government ID through a KYC provider
  (adds cost and privacy obligations), or vouching by people who have already been roommates with them.

---

## How matching works (`server/src/matching.js`)

All questions are **ordinal**: options run from one extreme to the other, so the distance between two
answers means something. Questions describe *behaviour* ("your dishes have been in the sink since
lunch, you…") instead of asking for self-ratings ("how clean are you, 1–5"), because people rate
themselves too generously.

For viewer **A** and candidate **B**:

1. **Hard filters**: same city, overlapping budget ranges, gender preference respected **both ways**.
2. **Dealbreakers**: if either person marked a question as a dealbreaker and the answers are more than
   one step apart, the pair is hidden.
3. **Directional fit**: `fit(A→B) = Σ w_A·sim / Σ w_A`, where `sim = 1 − |a−b| / (options−1)` and the
   importance weights are `[0, 1, 3, 8]`. It measures how well B matches what *A* cares about.
4. **Lifestyle score** = `√(fit(A→B) · fit(B→A))`. The **geometric mean** is deliberate: a pairing that
   is perfect for A and terrible for B scores 0%, not 50%. (Tested in `matching.test.js`.)
5. **Final score** = `0.85 · lifestyle + 0.15 · interests`, where interests = shared interests ÷ 3, capped at 1.

### Assumptions you should test, not trust
The weights (`[0,1,3,8]`, 85/15, dealbreaker tolerance of 1 step) are **educated guesses**. Nobody has
yet checked that a high score predicts a good living arrangement. To validate:

- **Small study:** get 15–20 *existing* roommate pairs to fill in the questionnaire separately. Compare
  their scores with their own rating of how well living together works (1–5). If the correlation is
  weak, the questions or weights are wrong.
- **In-product metrics:** match → first message rate, match → "we moved in" rate, and whether people are
  **still living together after 3 months**. That last one is the real outcome; it needs a follow-up
  prompt in the app.
- **Baselines** to compare against: random ordering, and ranking by budget only. If the compatibility
  ranking doesn't beat these on match-to-chat rate, it isn't adding value.

---

## Roommate agreement (`server/src/agreement.js`)

Matching gets two people talking. The agreement is meant to stop the most common reason roommate
arrangements fail later: expectations that were never said out loud. Open it from any chat.

**How the draft is generated.** Each rule comes from one or more questions, and differences are
settled by a written rule of thumb that the user can see under "Why this rule?":

| Rule of thumb | Used for | Reason |
|---|---|---|
| **Stricter preference wins** | smoking, overnight guests, vegetarian kitchen, pets, alcohol, noise, chore structure, expense tracking | Affects health, consent or comfort at home; loosening a rule later is easier than tightening it |
| **Middle ground** | dishes, tidiness, how often day guests come | Matters of degree |
| **Earlier bedtime → later wake-up** | quiet hours | So both people can sleep |

Each rule is tagged *Same answers*, *Small difference* (one step apart) or *Big difference: talk it
through* (two or more steps). Four standard rules are always included: rent and deposit (with blanks
to fill in), privacy, raising problems, and moving out.

**Consistency rules.**
- Any edit increments the agreement's `version` and **clears both agreements**, so the two people
  always agree to the exact same text.
- Every write sends the version it was based on. If the other person changed the agreement in the
  meantime, the server returns **409** with the latest version instead of overwriting it.
- Only the title and text can be edited. The generated metadata (status, basis, rationale) stays on the server.
- The other person sees edits and agreements live (Socket.IO `agreement:updated`).

**Open questions for you to think about:** Is "stricter wins" fair in every case? It gives the
stricter person an effective veto. Would people use this more if it were offered *before* matching,
as a preview ("here's what living with this person would look like")? How would you measure whether
pairs who sign an agreement stay together longer than pairs who don't?

---

## "Try it now" (no sign-up)

Logged-out visitors can try the app on the landing page: they answer 4 habits (bedtime, dishes, guests,
smoking) and swipe through **real people** in a city, with a quick match % from those 4 answers (same
similarity formula as the full engine, without the importance weights). Liking someone opens sign-up.

Data comes from `GET /api/public/preview` (`server/src/routes/public.js`), which needs no login and is
deliberately limited:

- **Shown:** first name, age, occupation, area, budget, housing, verified *type* (student/work),
  up to 4 interests, and lifestyle answers used for tags.
- **Never shown:** photos, bio, surname, email, verified email/domain, internal user ids, importance
  settings or dealbreakers.
- Cities with fewer than 3 people aren't listed, so small groups can't be singled out.

`server/test/public.test.js` checks these rules. **Before launching for real**, add a profile setting
so people can opt out of appearing in the public preview, and mention it in your privacy policy.

---

## Landing page screenshots

The front page shows real screenshots of the website in browser-window frames (desktop captures,
`client/public/screens/*-desktop-light.webp` / `*-desktop-dark.webp`), plus one phone capture in the hero
(`*-light.webp` / `*-dark.webp`). Light captures use the default Home theme; dark captures use Evening and are shown in the Evening, Midnight and Neon themes. They are taken
automatically as the demo user. After changing the UI, regenerate them with the dev server running:

```bash
npm install --no-save puppeteer-core
node scripts/capture-screens.mjs .
```

The script reseeds the demo data before each theme and again at the end, so local test data is reset.

---

## Project structure

```
server/
  src/
    questions.js     the questionnaire (edit questions here; keep options ordered)
    matching.js      compatibility engine (pure functions, unit-tested)
    agreement.js     roommate agreement generator (pure functions, unit-tested)
    verification.js  email-domain classification + code hashing
    mailer.js        SMTP via nodemailer, or console output in development
    routes/          auth, me (profile), discover (+ user profile), social (swipes, matches, chat, blocks),
                     agreement, photos, verify
    socket.js        Socket.IO auth + per-user rooms + typing relay
    db.js            SQLite schema
    seed.js          demo data (5 lifestyle archetypes with random variation)
  test/              node:test unit + integration tests
client/
  src/
    pages/           Landing, Welcome, Onboarding, Discover, Matches (inbox), Chat, Agreement, Profile, UserProfile
    components/      ProfileCard, Breakdown, ScoreRing, MatchModal, Layout, Avatar
    context/         AuthContext (user + questionnaire metadata), SocketContext
```

**Design decisions:**
- Messages are **sent over REST** (validated and stored in one place) and **delivered over sockets**,
  which keeps the socket layer thin.
- Other users never see your email, the importance you gave each answer, or your dealbreakers. They
  only see your answers in the comparison.
- Swiped users drop out of Discover. Unmatching records a "pass" so the pair doesn't instantly re-match.

---

## Known limitations and next steps

**Security notes (fix before real users):**
- The JWT is stored in `localStorage`, which an XSS bug could read. Switch to an httpOnly, SameSite cookie.
- There is no rate limiting on login/register (add `express-rate-limit`), and no password reset. The
  login email itself isn't verified; only the optional college/work badge is.
- There is no report or moderation flow yet (block exists). Uploaded photos aren't reviewed, so a
  report button plus manual review is needed before launch.
- Photo URLs are unguessable but not private: anyone who has a link can open it.
- Photos are stored on the server's disk. On most hosting platforms the disk is wiped on redeploy,
  so production needs object storage (S3, Cloudinary, Supabase Storage).

**Scaling:** Discover scores every user in the database on each request (O(N)). That's fine for a few
thousand users. Beyond that, pre-filter in SQL by city and budget, cache scores, or precompute
candidate lists.

**Product ideas worth building next:**
1. **Agreement check-ins.** A monthly prompt asking "Is the agreement still working?", with an option
   to reopen specific rules. This also produces outcome data for validating the matching.
2. **Reviews from past roommates**, a stronger trust signal than an email domain.
3. **Listings**: photos and details for people who already have a place (`housing = have_room`).
4. **3-month check-in** prompt, which gives you the outcome data to validate the matching.

**Business model (still open):** freemium (boosts, see who liked you), verified badges, paid listings
for PG/flat owners, or partnerships with colleges for student housing. Decide this based on who gets
the most value. Usually that's whoever has a room to fill.
