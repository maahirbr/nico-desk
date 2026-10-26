// Sounds (workstream 7). Three short tones made with the Web Audio API, so there are no audio files. They are off:
// the Sounds switch left the account menu on 26 Oct (SOUNDS_OFF below). Turning SOUNDS_OFF to false and putting the
// switch back brings them back, with the nd_sound cookie as the switch. Nothing plays on page load: a tone follows a new notice, Done or a refused action.

export const SOUND_COOKIE = 'nd_sound';

// The cookie holds "1" when sounds are on. Anything else, or no cookie, means off.
export function soundOf(value: string | undefined | null): boolean {
  return value === '1';
}

// One cookie's value from a `document.cookie` string.
export function cookieValue(jar: string, name: string): string | undefined {
  for (const part of jar.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

// Each tone is under 200ms and quiet (gain 0.07 at most). Ping: new notice. Tick: Done. Low: a refused action.
const TONES = {
  ping: { hz: 880, ms: 140, gain: 0.05 },
  tick: { hz: 1320, ms: 60, gain: 0.04 },
  refused: { hz: 150, ms: 160, gain: 0.07 },
} as const;
export type Cue = keyof typeof TONES;

const SOUNDS_OFF = true;
let ctx: AudioContext | undefined;

export function play(cue: Cue): void {
  // The Sounds switch left the account menu (the PM's call, 26 Oct), so nothing plays, even for a cookie set before.
  if (SOUNDS_OFF || typeof document === 'undefined' || !soundOf(cookieValue(document.cookie, SOUND_COOKIE))) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctx ??= new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    const { hz, ms, gain } = TONES[cue];
    const t0 = ctx.currentTime;
    const end = t0 + ms / 1000;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = hz;
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(end + 0.02);
  } catch { /* no audio on this device: stay silent */ }
}

// Which tone an API call earns, from what was sent and whether it worked. Reads (GET) never sound. A refused write
// gets the low tone. A task closed as Done gets the tick.
export function cueFor(method: string, path: string, body: unknown, ok: boolean): Cue | null {
  if (method === 'GET') return null;
  if (!ok) return 'refused';
  const as = body && typeof body === 'object' ? (body as { as?: unknown }).as : undefined;
  return method === 'POST' && as === 'done' && /^\/tasks\/[^/]+\/close$/.test(path) ? 'tick' : null;
}

// Called by the fetch wrappers once a response is in.
export function playFor(method: string, path: string, body: unknown, ok: boolean): void {
  const cue = cueFor(method, path, body, ok);
  if (cue) play(cue);
}

// The ids in `latest` that `known` has not seen. Home calls this on each poll, so one notice pings once.
export function newNoticeIds(known: ReadonlySet<string>, latest: readonly { id: string }[]): string[] {
  return latest.map((n) => n.id).filter((id) => !known.has(id));
}
