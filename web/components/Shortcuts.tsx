'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isTyping, SHORTCUTS } from './keys';
import { Modal } from './task-ui';

// Single-key shortcuts for the whole app. "/" and Ctrl/Cmd+K live in TopSearch, next to the box they focus.

export function Shortcuts() {
  const router = useRouter();
  const path = usePathname();
  const [help, setHelp] = useState(false);

  // The list opens from the account menu and from the help bar, which both send this event.
  useEffect(() => {
    const open = () => setHelp(true);
    window.addEventListener('nd:shortcuts', open);
    return () => window.removeEventListener('nd:shortcuts', open);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === 'n' && path !== '/tasks/new') { e.preventDefault(); router.push('/tasks/new'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [path, router]);

  if (!help) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setHelp(false)}>
      <dl className="keylist">
        {SHORTCUTS.map(([k, what]) => (<div key={k}><dt><kbd className="kbd-key">{k}</kbd></dt><dd>{what}</dd></div>))}
      </dl>
    </Modal>
  );
}
