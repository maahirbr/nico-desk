// Every drafter and checker call writes one model_calls row (FR-73, NFR-11).
// The row holds a hash of the input and the output, never the input text.
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { modelCalls } from "@/lib/db/schema";

type Step = (typeof modelCalls.$inferInsert)["step"];

export function hashInput(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// Price per million tokens, in USD, for the cost estimate. Output is free for Jev.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5-5": { in: 3, out: 15 },
  "jev-latest": { in: 0.042, out: 0 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE[model];
  if (!p) return 0;
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}

export async function logModelCall(call: {
  step: Step;
  model: string;
  input: unknown;
  output: unknown;
  confidence?: number | null;
  latencyMs: number;
  cost?: number;
}): Promise<void> {
  await getDb()
    .insert(modelCalls)
    .values({
      id: `mcl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      step: call.step,
      model: call.model,
      inputHash: hashInput(call.input),
      output: (call.output ?? null) as never,
      confidence: call.confidence ?? null,
      latencyMs: Math.max(0, Math.round(call.latencyMs)),
      cost: call.cost ?? 0,
      createdAt: new Date().toISOString(),
    });
}
