// Retakes the Guide's pictures and short clips (15 Nov) from a demo copy with ONLY the made-up fixture people: never a
// real roster, never live data. The repo is public.
//
// 1. Start a fresh demo copy with no roster file, on port 3104:
//      echo '{}' > /tmp/empty-roster.json
//      NICO_DATA_DIR=/tmp/guide-data NICO_ROSTER=/tmp/empty-roster.json NICO_TODAY=2026-10-09 NICO_DEV_SIGNIN=1 npx next start -p 3104
// 2. With Playwright installed somewhere (npm i playwright@1.63.0 in a scratch folder, then npx playwright install chromium):
//      NODE_PATH=<that folder>/node_modules node scripts/guide-shots.cjs
// Pictures land in public/guide/*.webp, clips in public/guide/*.webm. It signs in as a fixture person and changes the
// demo copy only (one pushed date, one note line made a task).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const sharp = require('sharp');

const BASE = process.env.GUIDE_BASE || 'http://localhost:3104';
const OUT = path.join(__dirname, '..', 'public', 'guide');
const WHO = 'per_cy'; // a fixture person who owns projects, so the pages have something on them
fs.mkdirSync(OUT, { recursive: true });

async function signIn(ctx) {
  const r = await ctx.request.post(`${BASE}/api/v1/session`, { data: { personId: WHO }, headers: { origin: BASE } });
  if (!r.ok()) throw new Error(`sign-in failed: ${r.status()}`);
  // Light, Warm: the default look.
  await ctx.addCookies([{ name: 'nd_skin', value: 'w', url: BASE }, { name: 'nd_theme', value: 'light', url: BASE }]);
}

async function save(buf, name, width = 1100) {
  await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
  console.log('picture', name);
}

// A picture of one thing on the page, with some room around it.
async function around(page, locator, name, pad = 16, width) {
  await locator.first().scrollIntoViewIfNeeded();
  const b = await locator.first().boundingBox();
  if (!b) throw new Error(`nothing to picture for ${name}`);
  const vp = page.viewportSize();
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  const clip = { x, y, width: Math.min(vp.width - x, b.width + pad * 2), height: Math.min(vp.height - y, b.height + pad * 2) };
  await save(await page.screenshot({ clip }), name, width);
}

async function settle(page) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(700); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await signIn(ctx);
  const page = await ctx.newPage();
  const api = (p, method, data) => ctx.request.fetch(`${BASE}/api/v1${p}`, { method, data, headers: { origin: BASE } });

  // A pushed date with a reason, so the push line has something to show.
  const mine = await (await api('/me/tasks', 'GET')).json();
  const list = Array.isArray(mine) ? mine : mine.tasks ?? mine.items ?? [];
  for (const t of list.filter((x) => x.statusCategory === 'open' && x.ownerId === WHO && x.projectId && !x.dateMoves)) {
    const r = await api(`/tasks/${t.id}/renegotiate`, 'POST', { version: t.version, newDueOn: '2026-10-20', reason: 'Waiting on the vendor’s new samples' });
    if (r.ok()) { console.log('pushed', t.id); break; }
  }

  // Home, without the one-off cards (What's new, the first-week welcome)
  await page.goto(`${BASE}/me`); await settle(page);
  const gotIt = page.getByRole('button', { name: 'Got it ✓' });
  if (await gotIt.count()) { await gotIt.first().click(); await page.waitForTimeout(300); }
  const closeWelcome = page.getByRole('button', { name: 'Close the welcome' });
  if (await closeWelcome.count()) { await closeWelcome.first().click(); await page.waitForTimeout(300); }
  await save(await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 760 } }), 'home');

  // Quick Add
  await page.locator('.head-new').first().click(); await page.waitForTimeout(400);
  const box = page.locator('[placeholder^="e.g."]');
  await box.fill('Kabir to send the fabric swatches by Friday');
  await page.waitForTimeout(500);
  { const b = await box.boundingBox(); // the box, its buttons and the line under it, not the whole form
    await save(await page.screenshot({ clip: { x: b.x - 24, y: b.y - 44, width: 580, height: 150 } }), 'quickadd', 900); }
  await page.keyboard.press('Escape');

  // A project
  const proj = { id: 'prj_shoot' }; // a fixture task board this person owns
  await page.goto(`${BASE}/projects/${proj.id}`); await settle(page);
  await save(await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 820 } }), 'project');
  // The status menu on a task
  await page.locator('table .st-pick').first().click(); await page.waitForTimeout(400);
  await around(page, page.locator('.st-menu').first(), 'status', 20, 520);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const pushed = page.locator('.pushed-line');
  if (await pushed.count()) await around(page, pushed.first().locator('xpath=ancestor::tr[1]'), 'pushed', 8, 1000);
  const imp = page.getByRole('button', { name: 'Import minutes' });
  if (await imp.count()) { await imp.first().click(); await page.waitForTimeout(500); await around(page, page.locator('.imp-panel'), 'minutes', 12, 900); }

  // Team
  await page.goto(`${BASE}/team`); await settle(page);
  await save(await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 760 } }), 'team');

  // Personal
  await page.goto(`${BASE}/me`); await settle(page);
  await page.locator('.my-project', { hasText: 'Personal' }).first().click(); await settle(page);
  const personalUrl = page.url();
  const personalId = personalUrl.split('/').pop();
  for (const [title, dueOn] of [['Book the tailor for Saturday', '2026-10-11'], ['Renew gym membership', '2026-10-15'], ['Read the brand book', '9999-12-31']]) {
    await api('/tasks', 'POST', { teamId: 'team_pilot', title, ownerId: WHO, dueOn, projectId: personalId });
  }
  await page.reload(); await settle(page);
  const ed = page.locator('.ProseMirror').first();
  await ed.click();
  await page.keyboard.type('Ideas for the festive window', { delay: 5 }); await page.keyboard.press('Enter');
  await page.keyboard.type('Gold and ivory, lots of brass', { delay: 5 }); await page.keyboard.press('Enter');
  await page.keyboard.type('Ask Kabir about the lamp supplier', { delay: 5 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.main')?.scrollTo(0, 0); }); await page.waitForTimeout(300);
  await save(await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 820 } }), 'personal');
  await ctx.close();

  // Two short clips, where a picture is not enough.
  const clip = async (name, run) => {
    const c = await browser.newContext({ viewport: { width: 1100, height: 640 }, recordVideo: { dir: OUT, size: { width: 1100, height: 640 } }, reducedMotion: 'no-preference' });
    await signIn(c);
    const p = await c.newPage();
    await run(p);
    const v = p.video();
    await c.close();
    const file = await v.path();
    fs.renameSync(file, path.join(OUT, `${name}.webm`));
    console.log('clip', name);
  };
  await clip('quickadd-clip', async (p) => {
    await p.goto(`${BASE}/me`); await settle(p);
    await p.locator('.head-new').first().click(); await p.waitForTimeout(500);
    await p.locator('[placeholder^="e.g."]').pressSequentially('Kabir to send the fabric swatches by Friday', { delay: 45 });
    await p.waitForTimeout(600);
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2200);
  });
  await clip('note-to-task-clip', async (p) => {
    await p.goto(personalUrl); await settle(p);
    const ed = p.locator('.ProseMirror').first();
    await ed.click(); await p.keyboard.press('End');
    await p.keyboard.press('Enter');
    await p.keyboard.type('Call the printer about the hang tags', { delay: 45 });
    await p.waitForTimeout(500);
    await p.getByRole('button', { name: /→ Task|Make the line you are on a task/ }).first().click();
    await p.waitForTimeout(2200);
  });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
