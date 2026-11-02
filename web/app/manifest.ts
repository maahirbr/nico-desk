import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest. Colours are skin W day tokens (app/tokens.css): canvas for the
// splash background and the browser bar, so the app opens without a flash of another colour.
const MANIFEST_CANVAS = '#f5f2ec';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NicoDesk',
    short_name: 'NicoDesk',
    description: 'Where a Nicobar team runs its week.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: MANIFEST_CANVAS,
    theme_color: MANIFEST_CANVAS,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
