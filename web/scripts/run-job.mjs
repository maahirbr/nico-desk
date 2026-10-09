// Calls a job route on the local server with the job secret. Usage: node scripts/run-job.mjs reminders
import fs from 'node:fs';
import path from 'node:path';

const job = process.argv[2];
const dir = process.env.NICO_DATA_DIR || path.join(process.cwd(), '.data');
const file = path.join(dir, 'job-secret');
if (!process.env.NICO_JOB_SECRET && !fs.existsSync(file)) {
  console.error('No job secret yet. Start the server and open any page first.');
  process.exit(1);
}
const secret = process.env.NICO_JOB_SECRET || fs.readFileSync(file, 'utf8').trim();
const base = process.env.NICO_URL || 'http://localhost:3100';
const res = await fetch(`${base}/api/v1/jobs/${job}`, { method: 'POST', headers: { 'x-job-secret': secret } });
console.log(res.status, await res.text());
