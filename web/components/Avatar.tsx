'use client';

import { createContext, useContext, useState } from 'react';
import type { PhotoInfo } from '@/lib/service';

// A person's mark: the uploaded photo if there is one, else Google's photo, else initials on a coloured disc.
// The layout hands every teammate's photo info down once (PhotoProvider), so the places that draw a mark
// only need the person's id. No id, or a photo that fails to load, falls back to initials.

const Photos = createContext<Record<string, PhotoInfo>>({});

export function PhotoProvider({ photos, children }: { photos: Record<string, PhotoInfo>; children: React.ReactNode }) {
  return <Photos.Provider value={photos}>{children}</Photos.Provider>;
}

export function photoSrc(id: string, info: PhotoInfo | undefined): string | null {
  if (!info) return null;
  if (info.v != null) return `/api/v1/people/${encodeURIComponent(id)}/photo?v=${info.v}`;
  return info.url ?? null;
}

export function Avatar({ name, id, lg = false, you = false }: { name: string; id?: string | null; lg?: boolean; you?: boolean }) {
  const photos = useContext(Photos);
  const src = id ? photoSrc(id, photos[id]) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const showPhoto = !!src && failed !== src;
  const px = lg ? 36 : 28;
  return (
    <span className={`av${lg ? ' lg' : ''}${you ? ' you' : ''}${showPhoto ? ' has-photo' : ''}`} style={{ '--h': h } as React.CSSProperties} aria-hidden>
      {showPhoto
        // eslint-disable-next-line @next/next/no-img-element -- a 256px member photo, served by our own route or by Google
        ? <img src={src} alt="" width={px} height={px} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} />
        : initials}
    </span>
  );
}
