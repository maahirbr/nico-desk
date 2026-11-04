'use client';

import { useEffect, useRef, useState } from 'react';
import { pickHeard } from '@/lib/quickadd';

// The mic: what is said goes into a box, through the browser's own speech service. Quick Add reads it when the person
// stops; SayBox adds it to a longer box and leaves it there to edit. Nothing is posted or saved by speaking.

type Speech = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
const speechApi = (): (new () => Speech) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

// How long a silence ends a spoken take. Long enough to stop and think mid-sentence.
const QUIET_MS = 2500;

// Each failure says what to do, since "blocked" covers several different causes.
const PROBLEM: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Allow it from the icon left of the address bar, then reload. On a Mac, also turn on your browser under System Settings, Privacy & Security, Microphone.',
  'service-not-allowed': 'This browser cannot turn speech into text (Brave and Arc often cannot). Try Chrome or Safari, or type instead.',
  network: 'Speech to text needs the internet, because the browser sends it to its speech service. Check your connection and try again.',
  'audio-capture': 'No microphone was found. Check one is connected and chosen in your sound settings.',
  'no-speech': 'Nothing was heard. Tap the mic and try again, a little closer.',
  'language-not-supported': 'This browser cannot take English (India) speech. Try Chrome, or type instead.',
};

export function useSpeech(opts: { names?: string[]; heard: (all: string) => void; stopped?: (all: string) => void; problem: (say: string) => void }) {
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const rec = useRef<Speech | null>(null);
  const said = useRef('');
  const quiet = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const now = useRef(opts);
  useEffect(() => { now.current = opts; });

  // Ends the take and throws away anything still on its way.
  function drop() {
    const r = rec.current;
    if (!r) return;
    clearTimeout(quiet.current);
    r.onresult = null; said.current = '';
    r.stop();
  }
  useEffect(() => {
    setCanSpeak(!!speechApi());
    return () => { if (rec.current) rec.current.onend = null; drop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- drop only reads refs

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const Api = speechApi();
    if (!Api) return;
    const r = new Api();
    // Continuous, so a pause to think does not end the take: the browser alone stops at the first short gap.
    // We stop once nothing new is heard for QUIET_MS, or when the mic is tapped.
    // Three guesses per stretch of speech: the one that has a teammate's or project's name in it wins (lib/quickadd.ts pickHeard).
    r.lang = 'en-IN'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 3;
    said.current = '';
    r.onresult = (e) => {
      const all = Array.from(e.results).map((x) => pickHeard(Array.from(x).map((a) => a.transcript), now.current.names ?? [])).join(' ').replace(/\s+/g, ' ').trim();
      said.current = all; now.current.heard(all);
      clearTimeout(quiet.current); quiet.current = setTimeout(() => r.stop(), QUIET_MS);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') now.current.problem(PROBLEM[e.error] ?? `The microphone stopped (${e.error}). Try again, or type instead.`);
    };
    r.onend = () => { clearTimeout(quiet.current); setListening(false); rec.current = null; if (said.current) now.current.stopped?.(said.current); };
    rec.current = r; setListening(true);
    try { r.start(); } catch { setListening(false); rec.current = null; now.current.problem('The microphone could not start. Reload the page and try again, or type instead.'); }
  }

  return { canSpeak, listening, toggle, drop };
}

export function SpeechButton({ listening, stopLabel = 'Stop', onClick }: { listening: boolean; stopLabel?: string; onClick: () => void }) {
  return (
    <button type="button" className={`btn ghost say-mic${listening ? ' on' : ''}`} aria-pressed={listening}
      aria-label={listening ? stopLabel : 'Say it'} title={listening ? 'Stop' : 'Say it'} onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
      </svg>
    </button>
  );
}

// What a take adds to what the box already held, within the box's limit.
export function joinSaid(before: string, said: string, max: number): string {
  const gap = before && !/\s$/.test(before) ? ' ' : '';
  return `${before}${gap}${said}`.slice(0, max);
}

// A longer box with the mic in its top corner, clear of the resize handle and of what a writing extension adds at the
// bottom. Typing, or the box being emptied by a send, ends the take, so late words never come back into it.
export function SayBox({ value, onChange, max, names, children }: { value: string; onChange: (v: string) => void; max: number; names?: string[]; children: React.ReactNode }) {
  const [note, setNote] = useState<string | null>(null);
  const before = useRef('');
  const wrote = useRef(new Set<string>());
  const mic = useSpeech({ names, problem: setNote, heard: (all) => {
    const next = joinSaid(before.current, all, max);
    wrote.current.add(next);
    onChange(next);
    if (next.length >= max) { setNote(`This box holds ${max} characters. The rest was not added.`); mic.drop(); }
  } });
  useEffect(() => { if (mic.listening && !wrote.current.has(value)) mic.drop(); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps -- only a change of text ends a take
  const press = () => {
    if (!mic.listening) { before.current = value; wrote.current = new Set(); }
    setNote(null);
    mic.toggle();
  };
  const shown = note ?? (mic.listening ? 'Listening. Pause as long as you need. Tap the mic to stop.' : null);
  return (
    <span className={`say-box${mic.canSpeak ? ' can' : ''}`}>
      {children}
      {mic.canSpeak && <SpeechButton listening={mic.listening} onClick={press} />}
      {shown && <span className="say-note" role="status">{shown}</span>}
    </span>
  );
}
