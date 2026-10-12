// "Remember my view": the pure parts. A page keeps its last filter, sort and tab in this browser. What was
// kept may be stale (a person left, a pillar was renamed), so every value is checked against what the page
// offers now, and anything that does not fit falls back to the default.

// Parses the stored text into a plain object, or null if it is missing, broken or not an object.
export function parseStored(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch { return null; }
}

// A value that must be one of the allowed words, or the fallback.
export function oneOf<T extends string | null>(raw: unknown, allowed: readonly string[], fallback: T): string | T {
  return typeof raw === 'string' && allowed.includes(raw) ? raw : fallback;
}

// The storage key: per person, so a shared computer keeps each person's views apart.
export function viewKey(meId: string, page: string): string {
  return `nd_view_${meId.replace(/[^A-Za-z0-9_-]/g, '')}_${page.replace(/[^A-Za-z0-9_:-]/g, '')}`;
}
