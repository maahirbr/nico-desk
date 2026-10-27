'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { MyProfile } from '@/lib/service';
import { Avatar } from './Avatar';
import { useReadOnly } from './readonly';
import { notify } from './toast';

// Your profile (/me/profile): your name, a nickname, a phone number and a photo. The nickname shows in place of the name
// everywhere in the app. The browser crops the picture to a centred square and shrinks it to 256px before it leaves the
// device, so the server only ever stores a small image. Read-only under View as.

const SIZE = 256;
const LIMIT = 200 * 1024; // the server's limit (PHOTO_MAX_BYTES)

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

// Centre-crop to a square, draw at 256px, encode as WebP (JPEG where the browser cannot), and step quality down until it fits.
export async function squarePhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize photos.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  for (const [type, q] of [['image/webp', 0.85], ['image/webp', 0.7], ['image/jpeg', 0.8], ['image/jpeg', 0.6]] as const) {
    const b = await toBlob(canvas, type, q);
    if (b && b.type === type && b.size <= LIMIT) return b;
  }
  throw new Error('That photo is too large even after resizing. Try another.');
}

export function ProfileForm({ personId, profile }: { personId: string; profile: MyProfile }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [name, setName] = useState(profile.name);
  const [nick, setNick] = useState(profile.nickname ?? '');
  const [num, setNum] = useState(profile.phone ?? '');
  const [picked, setPicked] = useState<{ blob: Blob; url: string } | null>(null);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  const hasPhoto = profile.hasPhoto;
  const shown = nick.trim() || name.trim() || profile.name;

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    try {
      const blob = await squarePhoto(f);
      setPicked({ blob, url: URL.createObjectURL(blob) });
      setRemove(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read that photo.');
    }
  };

  const send = async (path: string, init: RequestInit) => {
    const res = await fetch(`/api/v1${path}`, init);
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `Request failed (${res.status}).`);
  };

  return (
    <form className="card form-card stack" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const changed = {
          ...(name.trim() !== profile.name ? { name } : {}),
          ...(nick.trim() !== (profile.nickname ?? '') ? { nickname: nick } : {}),
          ...(num.trim() !== (profile.phone ?? '') ? { phone: num } : {}),
        };
        if (Object.keys(changed).length) await send('/me/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changed) });
        if (picked) await send('/me/photo', { method: 'PUT', headers: { 'content-type': picked.blob.type }, body: picked.blob });
        else if (remove) await send('/me/photo', { method: 'DELETE' });
        setPicked(null); setRemove(false);
        notify('Profile saved');
        router.refresh();
      } catch (x) {
        setErr(x instanceof Error ? x.message : 'Could not save.');
      }
      setBusy(false);
    }}>
      <fieldset className="stack" disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="ep-photo">
          {picked
            // eslint-disable-next-line @next/next/no-img-element -- a local preview of the cropped photo
            ? <span className="av lg has-photo ep-av"><img src={picked.url} alt="" width={96} height={96} /></span>
            : remove ? <span className="av lg ep-av" aria-hidden>{shown.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
            : <span className="ep-av"><Avatar id={personId} name={shown} lg /></span>}
          <div className="ep-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="row">
              <button className="mini-btn" type="button" onClick={() => fileRef.current?.click()}>{hasPhoto || picked ? 'Change photo' : 'Upload photo'}</button>
              {(hasPhoto || picked) && !remove && (
                <button className="mini-btn" type="button" onClick={() => { setPicked(null); setRemove(hasPhoto); }}>Remove photo</button>
              )}
            </div>
            <p className="hint" style={{ margin: 0 }}>It is cropped to a square and shrunk on your device. Teammates can see it.</p>
          </div>
        </div>
        <label className="f"><span>Name</span>
          <input required minLength={2} maxLength={80} autoComplete="name" enterKeyHint="next" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="f"><span>Nickname (optional)</span>
          <input maxLength={40} autoComplete="nickname" enterKeyHint="next" value={nick} onChange={(e) => setNick(e.target.value)} />
        </label>
        <p className="hint" style={{ margin: 0 }}>Set a nickname and the app shows it in place of your name. The Roster shows both.</p>
        <label className="f"><span>Phone (optional)</span>
          <input type="tel" inputMode="tel" enterKeyHint="done" autoComplete="tel" maxLength={20} value={num} placeholder="+91 90000 00000"
            onChange={(e) => setNum(e.target.value)} />
        </label>
        <p className="hint" style={{ margin: 0 }}>Only people on your team can see your phone number.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" disabled={busy}>Save</button>
        </div>
      </fieldset>
    </form>
  );
}
