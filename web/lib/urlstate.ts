// Links and filters in the address: the pure parts. A filter, tab or sort the page keeps in React state is also
// written to the address (`?who=p_ana&tile=late`), so the view can be shared and opened in a new tab. A value
// that equals the default is left out, so a plain visit keeps a clean address.

// An unmodified left click. Anything else (middle, Cmd, Ctrl, Shift, Alt) is left to the browser, so
// "open in new tab" works on every link that also has an in-page click.
export function isPlainClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export const taskHref = (id: string) => `/tasks/${id}`;

// The chosen keys in the address, as strings. Null if none is there, so the caller can fall back to the kept view.
export function readUrlState(params: { get(name: string): string | null }, keys: readonly string[]): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const k of keys) { const v = params.get(k); if (v !== null && v !== '') out[k] = v; }
  return Object.keys(out).length ? out : null;
}

// The new query string ("?a=b" or ""): the chosen keys follow `state`, a default is dropped, every other
// part (the open task, the week) stays as it was.
export function writeUrlState(search: string, state: Record<string, unknown>, initial: Record<string, unknown>, keys: readonly string[]): string {
  const q = new URLSearchParams(search);
  for (const k of keys) {
    const v = state[k];
    if (v === null || v === undefined || v === '' || v === initial[k]) q.delete(k); else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
