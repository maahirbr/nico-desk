// A screenshot shrunk in the browser before upload: the long side at most 1600px, WebP (JPEG where the browser has no
// WebP), stepping the quality down until it is under the server's cap. Nothing leaves the browser until it is small.
export const SHOT_MAX_BYTES = 600 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

export async function shrinkImage(file: Blob, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  for (const [type, q] of [['image/webp', 0.85], ['image/webp', 0.7], ['image/jpeg', 0.8], ['image/jpeg', 0.6], ['image/jpeg', 0.45]] as const) {
    const b = await toBlob(canvas, type, q);
    if (b && b.type === type && b.size <= SHOT_MAX_BYTES) return b;
  }
  throw new Error('That picture is too large even after shrinking. Try a smaller screenshot.');
}
