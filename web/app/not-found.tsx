import Link from 'next/link';
import { DitherArt } from '@/components/DitherArt';

// Shown for any unknown address, and when a task, project or person page calls notFound().
export default function NotFound() {
  return (
    <div className="lost">
      <DitherArt field="hill" cols={56} rows={14} className="dither-lost" />
      <h1>This page is not here</h1>
      <p className="lede">The link may be old, or the page may have moved. Go back to Home, or search for what you need.</p>
      <div className="lost-actions">
        <Link className="btn" href="/me">Go to Home</Link>
        <Link className="btn ghost" href="/search">Search</Link>
      </div>
    </div>
  );
}
