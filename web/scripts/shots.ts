// Screen shots and checks for the v2 app. Run with `npm run shots` while a dev server is up.
// Opens every route as each allowed role at two widths, in light and dark, with reduced motion on and off.
// Saves each still to .shots/, tiles them into one contact sheet (.shots/sheet.png), writes .shots/report.json,
// and fails on any console or page error, any 4xx/5xx on a route that is not pending, and any text under WCAG contrast.
// It never starts a server. Flags: --only=<substring of a route>, --quick (light + no-preference only), --selftest.
// Synthetic data only: the roles are fixture people. Nothing is written to the app except the sign-in cookie.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright-core";

type Role = "member" | "lead" | "admin";

interface Route {
  path: string; // may end in a hash state: /week#ask-later/tsk_037, shape #<state>/<id>
  roles?: Role[]; // default: all three
  states?: string[]; // extra hash states to open, each becomes its own page: ["ask-later/tsk_037"]
  pending?: boolean; // a 404 here is reported, not a failure, while the redesign is in progress
}

// The routes to cover. Add a route here and it joins the matrix.
const ROUTES: Route[] = [
  { path: "/week", pending: true },
  { path: "/asks", pending: true },
  { path: "/team" },
  { path: "/team/record", pending: true },
  { path: "/commit", pending: true },
  { path: "/dev/act-as" },
];

const PEOPLE: Record<Role, { id: string; name: string }> = {
  member: { id: "per_fay", name: "Wren" },
  lead: { id: "per_ada", name: "Tamsin" },
  admin: { id: "per_cy", name: "Bexley" },
};
const WIDTHS = [1440, 375] as const;
const SCHEMES = ["light", "dark"] as const;
const MOTIONS = ["no-preference", "reduce"] as const;
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BASE = (process.env.SHOTS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(import.meta.dirname, "..", ".shots");

interface Offender {
  path: string;
  text: string;
  ratio: number;
  required: number;
  size: number;
  fg: string;
  bg: string;
}
interface ContrastResult {
  measured: number;
  skipped: number; // elements whose background could not be read (image or gradient behind the text)
  offenders: Offender[];
  all?: Offender[];
}
interface PageResult {
  role: Role;
  path: string;
  url: string;
  width: number;
  scheme: string;
  motion: string;
  file: string | null;
  status: number | null;
  pending: boolean;
  missing: boolean; // a pending route that answered 404
  consoleErrors: string[];
  contrast: ContrastResult | null;
  failures: string[];
}

// The contrast probe runs inside the page. It is a plain JS string, not a function, because tsx wraps named
// functions with a helper that does not exist in the page. Colours are resolved by the browser: a 1x1 canvas is
// filled on white and on black, and the two readbacks give exact RGB and alpha for rgb(), color(srgb), oklch(), lab().
const PROBE = `(all) => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  const resolve = (css) => {
    if (cache.has(css)) return cache.get(css);
    let out = null;
    const paint = (under) => {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = under; cx.fillRect(0, 0, 1, 1);
      cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
      return cx.getImageData(0, 0, 1, 1).data;
    };
    cx.fillStyle = "#010203"; const sentinel = cx.fillStyle; cx.fillStyle = css;
    if (css === "transparent" || css === "rgba(0, 0, 0, 0)") out = { r: 0, g: 0, b: 0, a: 0 };
    else if (cx.fillStyle !== sentinel || css === "#010203") {
      const w = paint("#ffffff"), k = paint("#000000");
      const a = Math.min(1, Math.max(0, 1 - (w[0] - k[0]) / 255));
      out = a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : { r: k[0] / a, g: k[1] / a, b: k[2] / a, a };
      if (a === 1) out = { r: w[0], g: w[1], b: w[2], a: 1 };
    }
    cache.set(css, out);
    return out;
  };
  const over = (top, under) => {
    const a = top.a + under.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const m = (t, u) => (t * top.a + u * under.a * (1 - top.a)) / a;
    return { r: m(top.r, under.r), g: m(top.g, under.g), b: m(top.b, under.b), a };
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const label = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e.nodeType === 1 && e !== document.documentElement && i < 4; e = e.parentElement, i++) {
      let s = e.tagName.toLowerCase();
      if (e.id) s += "#" + e.id;
      else if (typeof e.className === "string" && e.className.trim()) s += "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".");
      parts.unshift(s);
    }
    return parts.join(" > ");
  };
  // Canvas colour behind everything: the page default. Dark when the page asks for a dark colour scheme.
  const darkCanvas = getComputedStyle(document.documentElement).colorScheme.includes("dark") && matchMedia("(prefers-color-scheme: dark)").matches;
  const canvasBg = darkCanvas ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "TITLE", "META", "LINK", "OPTION"]);
  const offenders = [], every = [];
  let measured = 0, skipped = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (!el || el.nodeType !== 1 || SKIP.has(el.tagName)) continue;
    let text = "";
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) text += n.textContent.trim() + " ";
    text = text.trim();
    if (!text) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.matches(":disabled") || el.closest('[aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Opacity compounds down the tree. Zero anywhere means invisible. Collect the backgrounds on the way up.
    let opacity = 1, stack = [], blocked = false, hidden = false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const s = getComputedStyle(a);
      opacity *= parseFloat(s.opacity);
      if (parseFloat(s.opacity) === 0 || s.visibility === "hidden") { hidden = true; break; }
      const bg = resolve(s.backgroundColor);
      if (s.backgroundImage !== "none" && !(bg && bg.a === 1)) { blocked = true; break; }
      if (bg && bg.a > 0) { stack.push(bg); if (bg.a === 1) break; }
    }
    if (hidden) continue;
    if (blocked) { skipped++; continue; }
    let bg = canvasBg;
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
    const fgRaw = resolve(cs.color);
    if (!fgRaw || fgRaw.a === 0) continue;
    const fg = over({ ...fgRaw, a: fgRaw.a * opacity }, bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const required = large ? 3 : 4.5;
    const value = ratio(fg, bg);
    measured++;
    const row = { path: label(el), text: text.slice(0, 48), ratio: Math.round(value * 100) / 100, required, size, fg: hex(fg), bg: hex(bg) };
    if (all) every.push(row);
    if (value < required) offenders.push(row);
  }
  offenders.sort((x, y) => x.ratio - y.ratio);
  return { measured, skipped, offenders, all: all ? every : undefined };
}`;

async function reachable(): Promise<boolean> {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(4000), redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

async function contrastOf(page: import("playwright-core").Page, all = false): Promise<ContrastResult> {
  return (await page.evaluate(`(${PROBE})(${all})`)) as ContrastResult;
}

// File name: role-route-width-scheme-motion.png, slashes and hash marks turned into dashes.
function slug(p: string): string {
  const s = p.replace(/^\//, "").replace(/[^A-Za-z0-9_]+/g, "-").replace(/^-|-$/g, "");
  return s || "root";
}

// Every concrete page address: each route plus each extra hash state it lists.
function expandRoutes(): { path: string; roles: Role[]; pending: boolean }[] {
  const only = opt("only");
  const out: { path: string; roles: Role[]; pending: boolean }[] = [];
  for (const r of ROUTES) {
    if (only && !r.path.includes(only)) continue;
    const roles = r.roles ?? (["member", "lead", "admin"] as Role[]);
    out.push({ path: r.path, roles, pending: !!r.pending });
    for (const s of r.states ?? []) out.push({ path: `${r.path.split("#")[0]}#${s}`, roles, pending: !!r.pending });
  }
  return out;
}

async function visit(ctx: BrowserContext, role: Role, route: { path: string; pending: boolean }, width: number, scheme: string, motion: string): Promise<PageResult> {
  const name = `${role}-${slug(route.path)}-${width}-${scheme}-${motion}`;
  const res: PageResult = {
    role, path: route.path, url: BASE + route.path, width, scheme, motion, file: null, status: null,
    pending: route.pending, missing: false, consoleErrors: [], contrast: null, failures: [],
  };
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") res.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => res.consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  try {
    const resp = await page.goto(res.url, { waitUntil: "load", timeout: 60000 });
    res.status = resp?.status() ?? null;
    if (res.status === 404 && route.pending) {
      res.missing = true;
      res.consoleErrors = []; // the browser logs the missing resource, which is expected for a pending route
      return res;
    }
    if (res.status !== null && res.status >= 400) res.failures.push(`http ${res.status}`);
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    await page.evaluate("document.fonts.ready").catch(() => {});
    // Hide the Next dev badge so it is not in the stills or the contrast pass.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(250);
    res.contrast = await contrastOf(page);
    if (res.contrast.offenders.length) res.failures.push(`contrast: ${res.contrast.offenders.length} under threshold`);
    if (res.consoleErrors.length) res.failures.push(`console: ${res.consoleErrors.length} error(s)`);
    res.file = `${name}.png`;
    await page.screenshot({ path: path.join(OUT, res.file), fullPage: true });
  } catch (e) {
    res.failures.push(`script: ${(e as Error).message.split("\n")[0].slice(0, 200)}`);
  } finally {
    await page.close();
  }
  return res;
}

async function runMatrix(browser: Browser): Promise<PageResult[]> {
  const routes = expandRoutes();
  const schemes = flag("quick") ? SCHEMES.slice(0, 1) : SCHEMES;
  const motions = flag("quick") ? MOTIONS.slice(0, 1) : MOTIONS;
  // One job per (role, width, scheme, motion): a context signs in once and walks every route.
  const jobs: (() => Promise<PageResult[]>)[] = [];
  for (const role of ["member", "lead", "admin"] as Role[])
    for (const width of WIDTHS)
      for (const scheme of schemes)
        for (const motion of motions) {
          const mine = routes.filter((r) => r.roles.includes(role));
          if (!mine.length) continue;
          jobs.push(async () => {
            const ctx = await browser.newContext({
              viewport: { width, height: width === 375 ? 812 : 900 },
              hasTouch: width === 375,
              isMobile: false,
              colorScheme: scheme,
              reducedMotion: motion,
            });
            await ctx.addCookies([{ name: "nd_person", value: PEOPLE[role].id, url: BASE }]);
            const got: PageResult[] = [];
            for (const r of mine) {
              let one = await visit(ctx, role, r, width, scheme, motion);
              // The dev server can answer 5xx while it recompiles under an edit. Try once more before calling it a failure.
              if (one.status !== null && one.status >= 500) {
                await new Promise((ok) => setTimeout(ok, 2000));
                one = await visit(ctx, role, r, width, scheme, motion);
              }
              got.push(one);
            }
            await ctx.close();
            return got;
          });
        }
  const results: PageResult[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        results.push(...(await job()));
        process.stdout.write(".");
      }
    }),
  );
  process.stdout.write("\n");
  const order = (r: PageResult) => `${r.path}|${r.role}|${r.scheme}|${r.motion}|${String(r.width).padStart(5, "0")}`;
  return results.sort((a, b) => order(a).localeCompare(order(b)));
}

// The contact sheet: an HTML page of <img> tags opened in the same browser and screenshotted.
// Grouped by route. 1440 stills are drawn at 400px wide, 375 stills at 200px. Tall stills are cropped from the top.
async function makeSheet(browser: Browser, results: PageResult[]): Promise<void> {
  const shown = results.filter((r) => r.file);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const byRoute = new Map<string, PageResult[]>();
  for (const r of shown) byRoute.set(r.path, [...(byRoute.get(r.path) ?? []), r]);
  let html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;width:__W__px;background:#e8e6e1;font:13px/1.3 -apple-system,Helvetica,sans-serif;color:#1a1a1a}
    h2{margin:28px 0 10px;font-size:18px}
    .row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
    figure{margin:0}
    .w1440{width:400px}.w375{width:200px}
    .img{overflow:hidden;max-height:560px;background:#fff;border:1px solid #999}
    img{display:block;width:100%}
    figcaption{padding-top:3px;font-size:12px}
    .fail figcaption{color:#a00000;font-weight:700}
    .fail .img{border:2px solid #a00000}
  </style><body><h1 style="margin:0 0 4px">nico-desk shots</h1><div>${shown.length} stills, ${esc(new Date().toISOString())}</div>`;
  for (const [route, rs] of byRoute) {
    html += `<h2>${esc(route)}</h2><div class="row">`;
    for (const r of rs) {
      const bad = r.failures.length ? " fail" : "";
      const tag = r.failures.length ? ` FAIL ${r.failures.map((f) => f.split(":")[0]).join("+")}` : "";
      html += `<figure class="w${r.width}${bad}"><div class="img"><img src="${esc(r.file as string)}"></div><figcaption>${r.role} ${r.width} ${r.scheme} ${r.motion === "reduce" ? "reduced" : "motion"}${tag}</figcaption></figure>`;
    }
    html += `</div>`;
  }
  html += `</body>`;
  // The sheet is as wide as the widest route row, capped at 4800px so it stays under about 6000px with padding.
  const rowW = Math.max(...[...byRoute.values()].map((rs) => rs.reduce((n, r) => n + (r.width === 1440 ? 400 : 200) + 14, 0)), 600);
  const sheetW = Math.min(4800, rowW);
  html = html.replace("__W__", String(sheetW));
  writeFileSync(path.join(OUT, "sheet.html"), html);
  const ctx = await browser.newContext({ viewport: { width: sheetW + 48, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`file://${path.join(OUT, "sheet.html")}`);
  await page.evaluate("Promise.all([...document.images].map((i) => i.decode().catch(() => {})))");
  const h = (await page.evaluate("document.documentElement.scrollHeight")) as number;
  // Chromium caps a screenshot near 16k px tall; crop rather than fail.
  await page.screenshot({ path: path.join(OUT, "sheet.png"), fullPage: true, clip: { x: 0, y: 0, width: sheetW + 48, height: Math.min(h, 16000) } });
  await ctx.close();
}

// Checker self-test: known ratios must be caught or passed. Run with --selftest.
async function selftest(browser: Browser): Promise<boolean> {
  const cases: { id: string; style: string; fail: boolean }[] = [
    { id: "grey25", style: "color:#a0a0a0", fail: true }, // about 2.6:1 on white
    { id: "grey7", style: "color:#4d4d4d", fail: false }, // about 8.4:1
    { id: "alpha", style: "color:rgba(0,0,0,0.3)", fail: true }, // about 2.1:1 once composited
    { id: "srgb", style: "color:color(srgb 0.3 0.3 0.3)", fail: false },
    { id: "oklch", style: "color:oklch(0.78 0 0)", fail: true }, // light grey on white
    { id: "oklchdark", style: "color:oklch(0.3 0 0)", fail: false },
    { id: "large", style: "color:#8a8a8a;font-size:30px", fail: false }, // about 3.4:1, large text needs 3
    { id: "smallsame", style: "color:#8a8a8a;font-size:16px", fail: true }, // same colour, small text
    { id: "onbg", style: "color:#fff;background:#595959", fail: false }, // white on dark grey, about 7:1
    { id: "onbgbad", style: "color:#fff;background:#808080", fail: true }, // about 4.0:1
    { id: "opacity", style: "color:#a0a0a0;opacity:0.5", fail: true },
    { id: "hidden", style: "color:#fafafa;opacity:0", fail: false }, // skipped, not measured
  ];
  const html = `<!doctype html><body style="margin:0;background:#fff">${cases
    .map((c) => `<p id="${c.id}" style="font:16px sans-serif;margin:4px;${c.style}">sample ${c.id}</p>`)
    .join("")}</body>`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const out = await contrastOf(page, true);
  await ctx.close();
  let ok = true;
  for (const c of cases) {
    const row = (out.all ?? []).find((r) => r.path.endsWith(`p#${c.id}`));
    const flagged = !!row && row.ratio < row.required;
    const measuredOk = c.id === "hidden" ? !row : !!row;
    const pass = measuredOk && (c.id === "hidden" ? true : flagged === c.fail);
    if (!pass) ok = false;
    console.log(`${pass ? "ok  " : "FAIL"} ${c.id.padEnd(10)} ${row ? `${row.ratio}:1 need ${row.required} ${flagged ? "flagged" : "passes"}` : "not measured"}`);
  }
  console.log(ok ? "selftest: all checks behave" : "selftest: FAILED");
  return ok;
}

async function main() {
  const browser = await chromium.launch();
  try {
    if (flag("selftest")) {
      process.exitCode = (await selftest(browser)) ? 0 : 1;
      return;
    }
    if (!(await reachable())) {
      console.log(`Nothing answers at ${BASE}. Start the dev server (npm run dev) or set SHOTS_URL, then run this again.`);
      process.exitCode = 1;
      return;
    }
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    const results = await runMatrix(browser);
    await makeSheet(browser, results);
    writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, when: new Date().toISOString(), results }, null, 2));

    const checked = results.filter((r) => r.file);
    const contrastBad = checked.filter((r) => r.contrast?.offenders.length);
    const consoleBad = results.filter((r) => !r.missing && r.consoleErrors.length);
    const otherBad = results.filter((r) => r.failures.some((f) => f.startsWith("http") || f.startsWith("script")));
    const pendingMissing = [...new Set(results.filter((r) => r.missing).map((r) => r.path))];
    console.log("");
    console.log(`pages checked      ${checked.length}`);
    console.log(`contrast failures  ${contrastBad.length}`);
    console.log(`console failures   ${consoleBad.length}`);
    console.log(`http/script fails  ${otherBad.length}`);
    console.log(`pending (404)      ${pendingMissing.length}${pendingMissing.length ? `  ${pendingMissing.join(" ")}` : ""}`);

    // Worst contrast offenders, one line each, deduplicated by element and text across the matrix.
    const seen = new Map<string, { o: Offender; where: string; n: number }>();
    for (const r of contrastBad)
      for (const o of r.contrast!.offenders) {
        const k = `${r.path}|${o.path}|${o.text}`;
        const hit = seen.get(k);
        if (hit) hit.n++;
        else seen.set(k, { o, where: `${r.role} ${r.path} ${r.width} ${r.scheme}`, n: 1 });
      }
    const worst = [...seen.values()].sort((a, b) => a.o.ratio - b.o.ratio).slice(0, 8);
    if (worst.length) {
      console.log("\nworst contrast (ratio, need, where, element, text):");
      for (const w of worst) console.log(`  ${w.o.ratio}:1 need ${w.o.required} ${w.where} (x${w.n}) ${w.o.path} "${w.o.text}" ${w.o.fg} on ${w.o.bg}`);
    }
    for (const r of consoleBad.slice(0, 5)) console.log(`console ${r.role} ${r.path} ${r.width} ${r.scheme}: ${r.consoleErrors[0]}`);
    for (const r of otherBad.slice(0, 5)) console.log(`fail ${r.role} ${r.path} ${r.width} ${r.scheme}: ${r.failures.join(", ")}`);
    console.log(`\nsheet  ${path.join(OUT, "sheet.png")}`);
    process.exitCode = contrastBad.length || consoleBad.length || otherBad.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
