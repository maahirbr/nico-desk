// Paste to tasks, step 1: read a pasted chat or an exported WhatsApp .txt into messages. Pure text work: no database,
// no network, nothing stored. SERVER and browser safe.
//
// Formats it reads:
//   iOS       [13/10/26, 9:41:02 AM] Name: text
//   iOS web   [9:41 am, 13/10/2026] Name: text
//   Android   13/10/26, 9:41 am - Name: text      (12h or 24h, comma optional)
//   plain     any lines with no header: each non-empty line is one message with no sender and no date
// A line with no header, inside an exported chat, continues the message above it.
// System lines (encryption notice, "<Media omitted>", joined, left, added, removed, deleted) are dropped and counted.

export type ChatMessage = {
  index: number; // 0-based, after system lines are dropped. The model and the review screen point at messages by this number.
  sender: string | null;
  date: string | null; // YYYY-MM-DD when the header gave a date that reads as one
  time: string | null; // HH:MM, 24 hour
  text: string;
};

export type ParsedChat = {
  messages: ChatMessage[];
  format: 'ios' | 'android' | 'plain';
  dropped: number; // system lines and media placeholders left out
};

const D = String.raw`(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})`;
const T = String.raw`(\d{1,2}[:.]\d{2}(?::\d{2})?(?:\s?[AaPp]\.?[Mm]\.?)?)`;
const IOS = new RegExp(`^\\[${D},?\\s+${T}\\]\\s?(.*)$`);
const IOS_WEB = new RegExp(`^\\[${T},?\\s+${D}\\]\\s?(.*)$`);
const ANDROID = new RegExp(`^${D},?\\s+${T}\\s+[-–]\\s(.*)$`);

// Text that is not a message from a person.
const MEDIA = /^(?:<\s*(?:media|image|video|audio|sticker|gif|document|contact card|location)\s+omitted\s*>|(?:media|image|video|audio|sticker|gif|document)\s+omitted|<attached:[^>]*>|[^\n]*\(file attached\))$/i;
const NOTICE = /end-to-end encrypted|^this message was deleted\.?$|^you deleted this message\.?$|^waiting for this message/i;
// Group events that carry a name before the verb. Used where a colon could make the line look like "Name: text".
const EVENT = /\b(?:joined (?:using this group|via)|was added|were added|added you|removed you|created group|changed (?:the|this) (?:group|subject|icon)|security code changed)/i;

function clean(line: string): string {
  return line
    .replace(/[‎‏‪-‮﻿]/g, '') // direction marks WhatsApp puts in front of names and system lines
    .replace(/[  ]/g, ' '); // newer iOS puts a narrow no-break space before AM and PM
}

function to24(t: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s?([AaPp])\.?[Mm]\.?)?$/.exec(t.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  const ap = m[3]?.toLowerCase();
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'p' && h !== 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// Day first (India, UK) unless the chat proves month first: some date has a second part above 12 and none has a first part above 12.
function monthFirst(dates: string[]): boolean {
  let firstOver = false;
  let secondOver = false;
  for (const d of dates) {
    const [a, b] = d.split(/[/.\-]/).map(Number);
    if (a > 12) firstOver = true;
    if (b > 12) secondOver = true;
  }
  return secondOver && !firstOver;
}

function toIso(d: string, mf: boolean): string | null {
  const p = d.split(/[/.\-]/).map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  const [a, b, y0] = p;
  const y = y0 < 100 ? 2000 + y0 : y0;
  const day = mf ? b : a;
  const month = mf ? a : b;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(y).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const back = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(back.getTime()) || back.getUTCDate() !== day ? null : iso;
}

type Raw = { date: string | null; time: string | null; sender: string | null; text: string; system: boolean };

function header(line: string): { date: string; time: string; rest: string; kind: 'ios' | 'android' } | null {
  let m = IOS.exec(line);
  if (m) return { date: m[1], time: m[2], rest: m[3], kind: 'ios' };
  m = IOS_WEB.exec(line);
  if (m) return { date: m[2], time: m[1], rest: m[3], kind: 'ios' };
  m = ANDROID.exec(line);
  if (m) return { date: m[1], time: m[2], rest: m[3], kind: 'android' };
  return null;
}

// "Name: text". The name is the part before the first colon that is followed by a space (or ends the line).
function splitSender(rest: string): { sender: string; text: string } | null {
  const m = /^([^:\n]{1,80}?):(?:\s([\s\S]*))?$/.exec(rest);
  if (!m) return null;
  const sender = m[1].replace(/^~\s*/, '').trim();
  return sender ? { sender, text: m[2] ?? '' } : null;
}

export function parseChat(input: string): ParsedChat {
  const lines = clean(input).replace(/\r\n?/g, '\n').split('\n');
  const raws: Raw[] = [];
  let kind: 'ios' | 'android' | null = null;
  let cur: Raw | null = null;
  let headed = false;

  for (const line of lines) {
    const h = header(line);
    if (h) {
      headed = true;
      kind ??= h.kind;
      // No sender, the encryption notice, or a group event: a system line, dropped. A headed line is never a person's words without a name.
      const sp = NOTICE.test(h.rest) || EVENT.test(h.rest.split(/:\s/)[0]) ? null : splitSender(h.rest);
      if (!sp) cur = { date: h.date, time: h.time, sender: null, text: h.rest, system: true };
      else cur = { date: h.date, time: h.time, sender: sp.sender, text: sp.text, system: false };
      raws.push(cur);
      continue;
    }
    // A line with no header inside an exported chat continues the message above, even a dropped one.
    if (cur && headed) {
      cur.text += `\n${line}`;
      continue;
    }
    // Before any header, or in a chat with no headers at all: one message per non-empty line.
    if (line.trim()) raws.push({ date: null, time: null, sender: null, text: line.trim(), system: false });
  }

  const mf = monthFirst(raws.filter((r) => r.date).map((r) => r.date as string));
  const messages: ChatMessage[] = [];
  for (const r of raws) {
    const text = r.text.trim();
    if (r.system || !text || (r.sender !== null && (MEDIA.test(text) || NOTICE.test(text)))) continue;
    messages.push({ index: messages.length, sender: r.sender, date: r.date ? toIso(r.date, mf) : null, time: r.time ? to24(r.time) : null, text });
  }
  return { messages, format: headed ? (kind ?? 'ios') : 'plain', dropped: raws.length - messages.length };
}
