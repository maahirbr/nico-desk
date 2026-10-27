// Deletes the local database so the next start reseeds it from ../fixtures. Stop the server first.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.env.NICO_DATA_DIR || path.join(process.cwd(), '.data'), 'pg');
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}. It reseeds on the next start.`);
