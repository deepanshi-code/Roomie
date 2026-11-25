// Captures real screenshots of the running Roomie app for the landing page.
// Usage (from the project folder, with the dev server running):
//   npm install --no-save puppeteer-core
//   node scripts/capture-screens.mjs .
// Uses the Microsoft Edge that ships with Windows; change EDGE below for another browser.
//
// Output (client/public/screens/):
//   <screen>-light.webp / <screen>-dark.webp                  phone size (390×844 @2x)
//   <screen>-desktop-light.webp / <screen>-desktop-dark.webp  desktop browser (1280×800 @1.5x)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PROJECT = path.resolve(process.argv[2] ?? '.');
const OUT = path.join(PROJECT, 'client', 'public', 'screens');
const BASE = 'http://localhost:5180';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { suffix: '', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { suffix: '-desktop', viewport: { width: 1280, height: 800, deviceScaleFactor: 1.5 }, extra: ['profile'] },
];

const FREEZE_CSS = `
  *, *::before, *::after { animation-duration: 0.001s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; transition: none !important; caret-color: transparent !important; }
  .reveal { opacity: 1 !important; transform: none !important; }
  ::-webkit-scrollbar { display: none; }
  .nudge { display: none !important; }
`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reseed = () => execSync('npm run seed', { cwd: PROJECT, stdio: 'ignore' });

async function prepare(page, theme) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(async (t) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@roomie.test', password: 'demo1234' }),
    }).then((res) => res.json());
    localStorage.setItem('roomie_token', r.token);
    localStorage.setItem('roomie_tour_done_1', '1');
    localStorage.setItem('roomie_theme', t);
    localStorage.setItem('roomie_verified_only', '0');
    sessionStorage.setItem('roomie_welcomed', '1');
  }, theme);
}

async function open(page, url, waitFor) {
  await page.goto(BASE + url, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.waitForSelector(waitFor, { timeout: 10000 });
  await sleep(700);
}

async function captureSet(browser, theme, device) {
  reseed(); // the match screenshot changes data, so start each set from clean demo data
  const page = await browser.newPage();
  await page.setViewport(device.viewport);
  await prepare(page, theme);

  const shot = async (name) => {
    const file = path.join(OUT, `${name}${device.suffix}-${theme === 'evening' ? 'dark' : 'light'}.webp`);
    await page.screenshot({ path: file, type: 'webp', quality: 82 });
    console.log('saved', path.basename(file), Math.round(fs.statSync(file).size / 1024) + 'KB');
  };
  const scrollToTop = async () => { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); };

  await open(page, '/discover', '.dv-card');
  await shot('discover');

  await open(page, '/users/5', '.bd-stats');
  await page.evaluate(() => {
    const el = document.querySelector('.bd-head');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70);
  });
  await sleep(400);
  await shot('compare');

  await open(page, '/chat/1', '.bubble');
  await scrollToTop();
  await shot('chat');

  await open(page, '/agreement/1', '.ag-clause');
  await shot('agreement');

  await open(page, '/profile/edit', '.ob2-steps');
  await page.evaluate(() => [...document.querySelectorAll('.ob2-step')].find((b) => b.textContent.includes('Cleanliness')).click());
  await sleep(700);
  await scrollToTop();
  await shot('onboarding');

  if (device.extra?.includes('profile')) {
    await open(page, '/profile', '.pf-id');
    await scrollToTop();
    await shot('profile');
  }

  // Match pop-up: Kabir (id 5) has already liked the demo user, so liking him back creates a match.
  await open(page, '/users/5', '.pf-cta');
  await page.evaluate(() => [...document.querySelectorAll('.pf-cta .btn-primary')].find((b) => b.textContent.includes('Like')).click());
  await page.waitForSelector('.match-modal', { timeout: 10000 });
  await sleep(900);
  await shot('match');

  await page.close();
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--hide-scrollbars'] });
try {
  for (const device of DEVICES) {
    for (const theme of ['home', 'evening']) await captureSet(browser, theme, device);
  }
} finally {
  await browser.close();
  reseed(); // leave clean demo data behind
}
