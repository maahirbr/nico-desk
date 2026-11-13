import { notFound } from '@/lib/errors';
import { route } from '@/lib/http';
import { getFile } from '@/lib/notes';

// GET: one of my files, to its owner only. A picture shows in place; any other file downloads, never runs.
export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  const f = await getFile(db, me, params.id);
  if (!f) throw notFound('No such file.');
  const name = encodeURIComponent(f.name);
  return new Response(f.bytes as BodyInit, { status: 200, headers: {
    'Content-Type': f.mime, 'Content-Length': String(f.bytes.length), 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${f.image ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`, 'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
});
