import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './db';

export function jobSecret(): string {
  if (process.env.NICO_JOB_SECRET) return process.env.NICO_JOB_SECRET;
  const file = path.join(dataDir(), 'job-secret');
  fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}
