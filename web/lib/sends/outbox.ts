// The v1 outbox. There is no email provider. "Sending" prints the message to the server console
// and appends it to .data/outbox.jsonl (gitignored). It is idempotent: one send id is written once.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderText, type Snapshot } from "./render";

// Hosted (Vercel) has a read-only disk outside the temp dir, so the outbox goes there and does not last.
const FILE =
  process.env.NICO_OUTBOX_FILE ??
  path.join(process.env.DATABASE_URL ? tmpdir() : path.join(process.cwd(), ".data"), "outbox.jsonl");

export type Delivery = { providerId: string; alreadyDelivered: boolean };

export function deliver(send: { id: string; kind: string; recipients: string[]; body: Snapshot }): Delivery {
  const providerId = `local-${send.id}`;
  mkdirSync(path.dirname(FILE), { recursive: true });
  if (existsSync(FILE) && readFileSync(FILE, "utf8").split("\n").some((l) => l.includes(`"providerId":"${providerId}"`))) {
    return { providerId, alreadyDelivered: true };
  }
  const text = renderText(send.body);
  appendFileSync(FILE, `${JSON.stringify({ providerId, kind: send.kind, recipients: send.recipients, at: new Date().toISOString(), text })}\n`);
  console.log(`[outbox] ${send.kind} to ${send.recipients.join(", ")}\n${text}`);
  return { providerId, alreadyDelivered: false };
}
