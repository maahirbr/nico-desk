import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../app/manifest';

// Install on a phone (13 Oct): the manifest, the icons, the layout tags and the service worker's caching rules.
// The rule that matters most: the worker never caches /api/ or a page, so private data never sits in a cache.

const pub = (p: string) => new URL(`../public/${p}`, import.meta.url);
const SW = readFileSync(pub('sw.js'), 'utf8');

type Handler = (e: unknown) => void;
// Runs sw.js against a fake worker scope, and returns the handlers it registered plus what it cached.
function boot(cacheKeys: string[] = []) {
  const handlers: Record<string, Handler> = {};
  const puts: string[] = [];
  const deleted: string[] = [];
  const store: Record<string, unknown> = {};
  const cache = { addAll: vi.fn(async () => {}), put: vi.fn(async (r: { url: string }) => { puts.push(new URL(r.url).pathname); }) };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (r: { url?: string } | string) => store[typeof r === 'string' ? r : r.url ?? ''] ?? undefined),
    keys: vi.fn(async () => cacheKeys),
    delete: vi.fn(async (k: string) => { deleted.push(k); return true; }),
  };
  const fetched: string[] = [];
  const fetchFn = vi.fn(async (r: { url: string }) => { fetched.push(new URL(r.url).pathname); return { ok: true, clone() { return this; } }; });
  const self = {
    location: { origin: 'https://desk.test' },
    addEventListener: (t: string, h: Handler) => { handlers[t] = h; },
    skipWaiting: vi.fn(), clients: { claim: vi.fn(async () => {}) },
  };
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function('self', 'caches', 'fetch', 'module', SW)(self, caches, fetchFn, mod);
  const run = async (method: string, path: string, mode = 'cors') => {
    let responded: Promise<unknown> | null = null;
    handlers.fetch({ request: { method, url: `https://desk.test${path}`, mode }, respondWith: (p: Promise<unknown>) => { responded = p; } });
    if (responded) await responded;
    await Promise.resolve();
    return { handled: responded !== null };
  };
  return { handlers, puts, deleted, fetched, cache, caches, mod, run };
}

describe('the service worker', () => {
  it('never touches an /api/ request: not a read, not a write, and nothing is cached', async () => {
    const w = boot();
    for (const [m, p] of [['GET', '/api/v1/tasks'], ['GET', '/api/v1/me'], ['GET', '/api/auth/google'], ['POST', '/api/v1/tasks'], ['PATCH', '/api/v1/feedback/x'], ['DELETE', '/api/v1/session']]) {
      expect((await w.run(m, p)).handled, `${m} ${p}`).toBe(false);
    }
    // Even an /api/ path that looks like a static one, or a navigation to an /api/ path, is left alone.
    expect((await w.run('GET', '/api/v1/x', 'navigate')).handled).toBe(false);
    expect(w.puts).toEqual([]);
    expect(w.fetched).toEqual([]);
  });

  it('does not decide on any non-GET request or another origin', async () => {
    const w = boot();
    expect((await w.run('POST', '/icons/icon-192.png')).handled).toBe(false);
    let called = false;
    w.handlers.fetch({ request: { method: 'GET', url: 'https://elsewhere.test/_next/static/a.js', mode: 'cors' }, respondWith: () => { called = true; } });
    expect(called).toBe(false);
  });

  it('serves a page from the network and caches nothing, falling back to the offline page', async () => {
    const w = boot();
    const out = await w.run('GET', '/team', 'navigate');
    expect(out.handled).toBe(true);
    expect(w.puts).toEqual([]);
    expect(w.fetched).toEqual(['/team']);
  });

  it('caches static assets only', async () => {
    const w = boot();
    await w.run('GET', '/_next/static/chunks/app.js');
    await w.run('GET', '/icons/icon-192.png');
    expect(w.puts).toEqual(['/_next/static/chunks/app.js', '/icons/icon-192.png']);
    expect((await w.run('GET', '/team.json')).handled).toBe(false); // a plain fetch of anything else is not handled
  });

  it('exposes one matcher that says no to /api/ and to pages, yes to static files', () => {
    const { isStaticAsset } = boot().mod.exports as { isStaticAsset: (u: URL) => boolean };
    const u = (p: string) => new URL(`https://desk.test${p}`);
    for (const p of ['/api/v1/tasks', '/api/v1/_next/static/x.js', '/team', '/me', '/projects/prj_1', '/']) expect(isStaticAsset(u(p)), p).toBe(false);
    for (const p of ['/_next/static/css/a.css', '/icons/maskable-512.png', '/manifest.webmanifest', '/offline.html']) expect(isStaticAsset(u(p)), p).toBe(true);
  });

  it('has a versioned cache name, precaches the offline page, and deletes old caches on activate', async () => {
    const w = boot(['nico-desk-static-v0', 'nico-desk-static-v1', 'something-else']);
    const { VERSION, CACHE, OFFLINE_URL } = w.mod.exports as { VERSION: string; CACHE: string; OFFLINE_URL: string };
    expect(CACHE).toBe(`nico-desk-static-${VERSION}`);
    let installed: Promise<unknown> | null = null;
    w.handlers.install({ waitUntil: (p: Promise<unknown>) => { installed = p; } });
    await installed;
    expect(w.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining([OFFLINE_URL]));
    let activated: Promise<unknown> | null = null;
    w.handlers.activate({ waitUntil: (p: Promise<unknown>) => { activated = p; } });
    await activated;
    expect(w.deleted).toEqual(['nico-desk-static-v0']); // the current cache and other apps' caches stay
  });

  it('has an offline page that works without the app', () => {
    const html = readFileSync(pub('offline.html'), 'utf8');
    expect(html).toContain('You are offline');
    expect(html).not.toMatch(/<script\s+src=|<link[^>]+href="https?:/);
    expect(html).not.toMatch(/[—–]/);
  });

  it('is registered in production only', () => {
    const src = readFileSync(new URL('../components/ServiceWorker.tsx', import.meta.url), 'utf8');
    expect(src).toContain("process.env.NODE_ENV !== 'production'");
    expect(src).toContain("register('/sw.js'");
    expect(readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8')).toContain('<ServiceWorker />');
  });
});

describe('the web app manifest', () => {
  const m = manifest();
  it('names the app and opens it standalone from the start page', () => {
    expect(m).toMatchObject({ name: 'Nico Desk', short_name: 'Nico Desk', start_url: '/', display: 'standalone' });
    expect((m.short_name ?? '').length).toBeLessThanOrEqual(12);
  });

  it('uses the skin W day canvas for the splash and the bar', () => {
    const tokens = readFileSync(new URL('../app/tokens.css', import.meta.url), 'utf8');
    for (const c of [m.background_color, m.theme_color]) {
      expect(c).toBe('#f5f2ec');
      expect(tokens.toLowerCase()).toContain(String(c));
    }
  });

  it('lists the 192 and 512 icons and a maskable one, and every file exists at that size', () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => `${i.sizes}:${i.purpose}`).sort()).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const i of icons) {
      const png = readFileSync(pub(i.src!.slice(1)));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
      expect(size, i.src).toBe(i.sizes);
    }
  });

  it('ships a 180 apple touch icon, linked from the layout with the standalone tags and both bar colours', () => {
    const png = readFileSync(pub('icons/apple-touch-icon.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
    const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toContain("apple: '/icons/apple-touch-icon.png'");
    expect(layout).toContain('appleWebApp');
    expect(layout).toMatch(/prefers-color-scheme: light.*#f5f2ec/);
    expect(layout).toMatch(/prefers-color-scheme: dark.*#12110f/);
  });

  it('is not behind a proxy: the app has no middleware that could block the manifest, the worker or the icons', () => {
    for (const f of ['../middleware.ts', '../proxy.ts', '../src/middleware.ts']) {
      expect(() => readFileSync(new URL(f, import.meta.url)), f).toThrow();
    }
  });
});
