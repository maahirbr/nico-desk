'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isTyping, mapFocusFrom, SHORTCUTS } from './keys';
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
      const modal = document.querySelector('[aria-modal="true"]');
      // "t" also works with the task drawer open, where it maps that task. Any other panel keeps the keys to itself.
      if (e.key === 't' && !e.shiftKey && (!modal || modal.getAttribute('aria-label') === 'Task')) {
        const to = mapFocusFrom(path, window.location.search);
        if (to) { e.preventDefault(); router.push(to); }
        return;
      }
      if (modal) return;
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
