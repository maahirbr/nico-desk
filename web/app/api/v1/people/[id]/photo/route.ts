import { notFound } from '@/lib/errors';
import { route } from '@/lib/http';
import { getPhoto } from '@/lib/service';

// An uploaded photo goes only to a signed-in teammate of its owner. The version is the upload time, so the
// address changes when the photo does and the browser can keep its copy (private: never a shared cache).
export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  const photo = await getPhoto(db, me.team.id, params.id);
  if (!photo) throw notFound('No photo.');
  const etag = `"${photo.version}"`;
  const headers = { 'Cache-Control': 'private, max-age=3600', ETag: etag, 'X-Content-Type-Options': 'nosniff' };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(photo.bytes as BodyInit, { status: 200, headers: { ...headers, 'Content-Type': photo.mime, 'Content-Length': String(photo.bytes.length) } });
});
