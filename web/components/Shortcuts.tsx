'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isTyping } from './keys';
import { Modal } from './task-ui';

// Single-key shortcuts for the whole app. "/" and Ctrl/Cmd+K live in TopSearch, next to the box they focus.

const LIST: [string, string][] = [
  ['/ or Ctrl/Cmd K', 'Search'],
  ['n', 'New task'],
  ['?', 'This list'],
  ['Esc', 'Close a panel, a menu or the search'],
];

export function Shortcuts() {
  const router = useRouter();
  const path = usePathname();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const open = () => setHelp(true);
    window.addEventListener('nd:help', open);
    return () => window.removeEventListener('nd:help', open);
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === 'n' && path !== '/tasks/new') { e.preventDefault(); router.push('/tasks/new'); }
      if (e.key === '?') { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [path, router]);

  if (!help) return null;
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setHelp(false)}>
      <dl className="keylist">
        {LIST.map(([k, what]) => (<div key={k}><dt><kbd className="kbd-key">{k}</kbd></dt><dd>{what}</dd></div>))}
      </dl>
    </Modal>
  );
}
