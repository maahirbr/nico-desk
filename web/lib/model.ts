type Env = Record<string, string | undefined>;

// The Anthropic model (minutes, a pasted chat, a typed sentence) is on only when keyed. Never against the hosted
// database unless NICO_MODEL_LIVE=1, because the live pilot holds real work text and nothing real goes to a third
// party without a yes. The same rule as jevOn in lib/jev.ts.
export function modelOn(env: Env = process.env): boolean {
  if (!env.ANTHROPIC_API_KEY) return false;
  if (env.DATABASE_URL && env.NICO_MODEL_LIVE !== '1') return false;
  return true;
}
