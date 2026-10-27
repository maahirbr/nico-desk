import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  // The fixtures sit above web/, so trace from the repo root and ship them with every function
  // (the PGlite fallback seeds from them on a cold start).
  outputFileTracingRoot: path.join(import.meta.dirname, '..'),
  outputFileTracingIncludes: { '/*': ['../fixtures/*.json'] },
  // Security headers (audit 13 Oct). The CSP is report-only until it is checked in a browser; framing is
  // refused outright, since a framed page could trick a lead into a click.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; img-src 'self' data: blob: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      ],
    }];
  },
};

export default config;
