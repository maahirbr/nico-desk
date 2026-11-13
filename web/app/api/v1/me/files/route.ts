import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { addFile, FILE_MAX } from '@/lib/notes';

// POST: a picture or file for my running notes (11 Nov). The body is the file's bytes; Content-Type says its kind and
// X-File-Name its name (encoded). Read in chunks and refused once past the limit, as content-length can be missing.
export const POST = route(async ({ req, me, db }) => {
  if (Number(req.headers.get('content-length') ?? '0') > FILE_MAX) throw new ApiError(413, 'file_too_big', 'A file must be under 5 MB.', 'file');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  let name = 'file';
  try { name = decodeURIComponent(req.headers.get('x-file-name') ?? 'file'); } catch { /* keep the default */ }
  const reader = req.body?.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  if (reader) for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > FILE_MAX) { await reader.cancel(); throw new ApiError(413, 'file_too_big', 'A file must be under 5 MB.', 'file'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  return addFile(db, me, name, mime, bytes);
});
