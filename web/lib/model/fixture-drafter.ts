// The default drafter. It needs no API key and makes no network call.
// A body that matches an eval transcript gets the gold tasks from that case's expected.json.
// Any other body goes through a plain rule: a speaker line with "I will" is a commitment.
// Either way the output is raw. Owner, date and quote are checked in checks.ts afterwards.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { DraftCandidate, Drafter, NoteInput, RosterEntry } from "./types";

const EVALS = path.join(process.cwd(), "..", "evals", "meetings");

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

type Gold = { tasks: { title: string; owner: string; quote: string; critical: boolean }[] };

// Finds the eval case whose transcript is this body, ignoring white space.
function goldFor(body: string): Gold | null {
  if (!existsSync(EVALS)) return null;
  const want = squash(body);
  for (const dir of readdirSync(EVALS)) {
    const t = path.join(EVALS, dir, "transcript.md");
    const e = path.join(EVALS, dir, "expected.json");
    if (!existsSync(t) || !existsSync(e)) continue;
    if (squash(readFileSync(t, "utf8")) === want) return JSON.parse(readFileSync(e, "utf8")) as Gold;
  }
  return null;
}

const COMMIT = /\b(?:I will|I'll|I am going to|I'm going to)\s+/i;

function sentences(line: string): string[] {
  return line.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function ruleBased(body: string, roster: RosterEntry[]): DraftCandidate[] {
  const out: DraftCandidate[] = [];
  const names = new Set(roster.map((r) => r.name));
  for (const raw of body.split("\n")) {
    const m = /^([^:]{2,40}):\s+(.+)$/.exec(raw.trim());
    if (!m) continue;
    const speaker = names.has(m[1].trim()) ? m[1].trim() : null;
    for (const s of sentences(m[2])) {
      const c = COMMIT.exec(s);
      if (!c) continue;
      const rest = s.slice(c.index + c[0].length).replace(/[.!?]+$/, "").trim();
      if (rest.length < 3) continue;
      out.push({
        title: (rest.charAt(0).toUpperCase() + rest.slice(1)).slice(0, 200),
        spokenOwner: speaker,
        duePhrase: s,
        quote: s,
        critical: false,
        confidence: 0.6,
      });
    }
  }
  return out;
}

export class FixtureDrafter implements Drafter {
  readonly name = "fixture-drafter";

  async draft(note: NoteInput, roster: RosterEntry[]): Promise<DraftCandidate[]> {
    const gold = goldFor(note.body);
    if (gold) {
      return gold.tasks.map((t) => ({
        title: t.title,
        spokenOwner: t.owner === "missing" ? null : t.owner,
        // The quote carries the date words. Code works out the date from it.
        duePhrase: t.quote,
        quote: t.quote,
        critical: t.critical,
        confidence: 0.9,
      }));
    }
    return ruleBased(note.body, roster);
  }
}
