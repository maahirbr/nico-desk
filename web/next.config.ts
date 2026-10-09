import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  // The fixtures sit above web/, so trace from the repo root and ship them with every function
  // (the PGlite fallback seeds from them on a cold start).
  outputFileTracingRoot: path.join(import.meta.dirname, '..'),
  outputFileTracingIncludes: { '/*': ['../fixtures/*.json'] },
};

export default config;
