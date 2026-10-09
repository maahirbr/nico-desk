// Granola adapter. It reads Granola through its public API with an admin-made workspace key,
// never a personal key, the hosted MCP or local app data (FR-44).
//
// Config, all from the environment so no secret is in the repo:
//   GRANOLA_WEBHOOK_SECRET  the Standard Webhooks signing secret ("whsec_" plus base64). Unset means every call is refused.
//   GRANOLA_SPACES          JSON map of Granola space id to team id, for example {"space_1":"team_run"}.
//                           Only listed spaces are processed (FR-45).
//
// ASSUMPTION: the payload field names below (type, data.id, data.title, data.space_id,
// data.created_at, data.transcript or data.summary) are a best guess. Check them against the
// Granola public API docs before the first real call. Only parse() needs to change.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingNote, NoteAdapter } from "./index";

const TOLERANCE_S = 5 * 60;

function secretBytes(): Buffer | null {
  const raw = process.env.GRANOLA_WEBHOOK_SECRET;
  if (!raw) return null;
  return Buffer.from(raw.startsWith("whsec_") ? raw.slice(6) : raw, "base64");
}

// Standard Webhooks: signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), sent as "v1,<sig>".
function verify(headers: Headers, rawBody: string): boolean {
  const key = secretBytes();
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigs = headers.get("webhook-signature");
  if (!key || !id || !ts || !sigs) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > TOLERANCE_S) return false;
  const want = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sigs.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

function spaces(): Record<string, string> {
  try {
    return JSON.parse(process.env.GRANOLA_SPACES ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

function parse(json: unknown): IncomingNote | null {
  const j = json as { type?: unknown; data?: Record<string, unknown> } | null;
  if (!j || (j.type !== "note.generated" && j.type !== "note.edited") || !j.data) return null;
  const d = j.data;
  const externalId = str(d.id);
  const spaceId = str(d.space_id);
  const body = str(d.transcript) ?? str(d.summary);
  const teamId = spaceId ? (spaces()[spaceId] ?? null) : null;
  if (!externalId || !body || !teamId) return null;
  const held = str(d.created_at);
  const heldAt = held && !Number.isNaN(Date.parse(held)) ? new Date(held).toISOString() : new Date().toISOString();
  return { sourceApp: "granola", externalId, teamId, title: str(d.title) ?? "Untitled meeting", body, heldAt };
}

export const granola: NoteAdapter = { name: "granola", verify, parse };
