'use client';

import type { EndedSort } from '@/lib/derive';
import { Select } from './Select';

// The sort picker beside a finished list. Newest finished first is the default everywhere.
export function SortPick({ value, onChange, dueLabel = 'Due date' }: { value: EndedSort; onChange: (v: EndedSort) => void; dueLabel?: string }) {
  return (
    <Select className="sort-pick" aria-label="Sort" value={value} onChange={(v) => onChange(v as EndedSort)}>
      <option value="recent">Newest finished first</option>
      <option value="oldest">Oldest finished first</option>
      <option value="due">{dueLabel}</option>
    </Select>
  );
}
