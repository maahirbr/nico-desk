import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite reads its wasm files from disk, so the bundler must leave it alone.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
