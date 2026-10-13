'use client';

// The status nudge (Jev, use case 9). It only offers. Nothing changes until the person clicks the first button,
// and that click goes through the same status calls as the status buttons. No text field here.
export function StatusNudge({ word, onAccept, onDismiss, busy }: { word: string; onAccept: () => void; onDismiss: () => void; busy: boolean }) {
  return (
    <div className="banner status-nudge" role="status">
      <span>Sounds {word.toLowerCase()}. Mark as {word}?</span>{' '}
      <button className="mini-btn" type="button" disabled={busy} onClick={onAccept}>Mark as {word}</button>{' '}
      <button className="mini-btn" type="button" onClick={onDismiss}>Leave it</button>
    </div>
  );
}
