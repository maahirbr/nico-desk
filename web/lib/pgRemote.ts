import postgres from 'postgres';
import { parsers, type Db, type Tx } from './db';

// postgres-js behind the Db/Tx interface, for Supabase's transaction pooler (port 6543).
// Values are parsed as PGlite parses them (see parsers in db.ts), so rows look the same in both modes:
// int8 is a number, numeric stays a string, json is parsed, date stays 'YYYY-MM-DD', timestamptz is ISO.
// Array params (entity_id = ANY($1)) need postgres-js to learn the array types, so fetch_types stays on.
// The pooler shares sessions between clients, so nothing here relies on session state (no SET).

const toDb = (x: unknown) => (x instanceof Date ? x.toISOString() : String(x));
const types = {
  dateOnly: { to: 1082, from: [1082], serialize: toDb, parse: parsers[1082] },
  timestamptz: { to: 1184, from: [1184], serialize: toDb, parse: parsers[1184] },
  int8: {
    to: 20,
    from: [20],
    serialize: (x: unknown) => String(x),
    parse: (v: string) => {
      const n = BigInt(v);
      return n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER ? n : Number(n);
    },
  },
  // A string already holding JSON goes through as is (service.ts passes JSON.stringify output to ::jsonb).
  json: { to: 114, from: [114, 3802], serialize: (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x)), parse: (v: string) => JSON.parse(v) },
};

function wrap(sql: Pick<postgres.Sql<any>, 'unsafe'>): Tx {
  return {
    async query<T = any>(text: string, params: any[] = []) {
      const res = await sql.unsafe(text, params.map((v) => (v === undefined ? null : v)));
      // PGlite reports 0 affected rows for a SELECT; postgres-js reports the row count.
      return { rows: [...res] as T[], affectedRows: res.command === 'SELECT' ? 0 : (res.count ?? 0) };
    },
    exec: (text) => sql.unsafe(text).simple(),
  };
}

export type RemoteDb = Db & { end(): Promise<void> };

export function openRemote(url: string): RemoteDb {
  const host = new URL(url).hostname;
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  const sql = postgres(url, {
    prepare: false, // the transaction pooler cannot keep named prepared statements
    max: 3,
    idle_timeout: 20,
    ...(local || url.includes('sslmode=') ? {} : { ssl: 'require' as const }),
    onnotice: () => {}, // DROP ... IF EXISTS and similar send NOTICEs; postgres-js would print each
    types,
  });
  return {
    ...wrap(sql),
    transaction: <T>(fn: (tx: Tx) => Promise<T>) => sql.begin((t) => fn(wrap(t))) as Promise<T>,
    end: () => sql.end(),
  };
}
