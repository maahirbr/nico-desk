import { notFound } from '@/lib/errors';
import { getReplyImage } from '@/lib/feedback';
import { route } from '@/lib/http';

// GET: a reply's picture (23 Nov), for a signed-in teammate only. Private cache: never a shared one.
export const GET = route<{ id: string; rid: string; n: string }>(async ({ params, me, db }) => {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1 || n > 3) throw notFound('No such picture.');
  const img = await getReplyImage(db, me, params.id, params.rid, n);
  if (!img) throw notFound('No such picture.');
  return new Response(img.bytes as BodyInit, { status: 200, headers: { 'Content-Type': img.mime, 'Content-Length': String(img.bytes.length), 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
});
