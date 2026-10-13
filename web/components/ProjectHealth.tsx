'use client';

import { useState } from 'react';
import { Help } from './HelpMode';
import { useJev } from './jevFlag';
import { useReadOnly } from './readonly';
import { api } from './task-ui';

// A suggestion for the project's lead: how the last two weeks of updates and comments read. It sits beside the
// flags the app works out from the dates. It is never saved, and it never sets the project's status.
// Hidden while Jev is off. The lead asks for it; nothing runs when the page opens.

const NO: Record<string, string> = {
  few: 'Too few recent updates to say. At least three in two weeks are needed.',
  unsure: 'Jev was not sure enough to suggest anything.',
  unavailable: 'No suggestion right now.',
  off: 'No suggestion right now.',
};

type Out = { state: 'suggestion'; word: string; notes: number } | { state: 'few' | 'unsure' | 'unavailable' | 'off'; notes: number };

export function ProjectHealth({ projectId, late, blocked }: { projectId: string; late: number; blocked: number }) {
  const jev = useJev();
  const readOnly = useReadOnly();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  if (!jev || readOnly) return null;

  async function ask() {
    setBusy(true); setOut(null);
    try {
      const r = await api(`/projects/${projectId}/health`, 'POST');
      setOut(r?.health ?? { state: 'unavailable', notes: 0 });
    } catch { setOut({ state: 'unavailable', notes: 0 }); }
    finally { setBusy(false); }
  }

  const dates = `Dates say: ${late} late, ${blocked} blocked.`;
  return (
    <div className="health-hint">
      <Help term="jev_health"><span>{dates}</span></Help>
      {!out && <button type="button" className="mini-btn" disabled={busy} onClick={ask}>{busy ? 'Reading…' : 'Suggest how it is going'}</button>}
      {out?.state === 'suggestion' && (
        <>
          <span role="status">Suggested: <b>{out.word}</b>, from {out.notes} recent {out.notes === 1 ? 'note' : 'notes'}. Not saved.</span>
          <button type="button" className="mini-btn" onClick={() => setOut(null)}>Dismiss</button>
        </>
      )}
      {out && out.state !== 'suggestion' && (
        <>
          <span className="suggest-note" role="status">{NO[out.state]}</span>
          <button type="button" className="mini-btn" onClick={() => setOut(null)}>Close</button>
        </>
      )}
    </div>
  );
}
