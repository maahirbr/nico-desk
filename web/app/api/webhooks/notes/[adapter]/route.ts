// POST /api/webhooks/notes/:adapter (FR-64, FR-65). It stores a note and answers at once.
// It never drafts inline. Order: adapter known, signature (401), rate limit (429), body checks (400).
import { getDb } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";
import { getAdapter } from "@/lib/model/adapters";

const LIMIT = 60;
const WINDOW_MS = 60_000;
const calls = new Map<string, number[]>();

// 60 calls a minute per adapter. Only signed calls count, so an unsigned flood cannot use up the budget.
function overLimit(adapter: string): boolean {
  const now = Date.now();
  const recent = (calls.get(adapter) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    calls.set(adapter, recent);
    return true;
  }
  recent.push(now);
  calls.set(adapter, recent);
  return false;
}

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

// No payload can set synthetic (FR-65). The key is refused wherever it appears at the top two levels.
function hasSyntheticKey(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if ("synthetic" in o) return true;
  return Object.values(o).some((x) => !!x && typeof x === "object" && !Array.isArray(x) && "synthetic" in (x as object));
}

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/notes/[adapter]">) {
  const { adapter: name } = await ctx.params;
  const adapter = getAdapter(name);
  if (!adapter) return json(404, { error: "unknown_adapter" });

  const raw = await request.text();
  if (!adapter.verify(request.headers, raw)) return json(401, { error: "bad_signature" });
  if (overLimit(name)) return json(429, { error: "rate_limited" });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (hasSyntheticKey(payload)) return json(400, { error: "synthetic_not_allowed" });

  const incoming = adapter.parse(payload);
  if (!incoming) return json(200, { ignored: true });

  const now = new Date().toISOString();
  const id = `ntn_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
  // Idempotent on (source_app, external_id): a repeat call stores nothing new.
  const [row] = await getDb()
    .insert(notes)
    .values({
      id,
      teamId: incoming.teamId,
      sourceApp: incoming.sourceApp,
      externalId: incoming.externalId,
      title: incoming.title.slice(0, 200),
      body: incoming.body,
      heldAt: incoming.heldAt,
      receivedAt: now,
      status: "received",
      synthetic: false,
    })
    .onConflictDoNothing()
    .returning({ id: notes.id });
  return json(row ? 201 : 200, { id: row?.id ?? null, status: "received", duplicate: !row });
}
