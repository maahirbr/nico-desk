'use client';

import Link from 'next/link';
import { DitherArt } from '@/components/DitherArt';

// Shown when a page fails while it draws. The message from the error is not shown, since it can hold internal detail.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="lost" role="alert">
      <DitherArt field="bands" cols={56} rows={14} className="dither-lost" />
      <h1>Something went wrong</h1>
      <p className="lede">This page did not load. Try again. If it keeps happening, tell the team admin.</p>
      <div className="lost-actions">
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
        <Link className="btn ghost" href="/me">Go to Home</Link>
      </div>
    </div>
  );
}
