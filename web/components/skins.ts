// The skins. The server reads the cookie and sets data-skin on <html>; the tokens do the rest.
// Two are offered, at the PM's call (13 Oct): Warm (W, NicoWarm) and Cool (M, NicoOS). W is the default: with no
// cookie, or a value that is not listed (including the retired a, b, c and i), the server sets W.
export const SKINS = [
  { id: 'w', name: 'Warm' },
  { id: 'm', name: 'Cool' },
] as const;

export type SkinId = (typeof SKINS)[number]['id'];
export const SKIN_COOKIE = 'nd_skin';
export const DEFAULT_SKIN: SkinId = 'w';

// What the closed Appearance row says: "Default" on Warm and Light (the true default), else the skin picked.
export function appearanceLabel(skin: SkinId, theme: 'light' | 'dark'): string {
  if (skin === DEFAULT_SKIN && theme === 'light') return 'Default';
  return SKINS.find((s) => s.id === skin)?.name ?? 'Default';
}

// The name in the menu list, which marks the default skin.
export function skinMenuName(id: SkinId): string {
  const name = SKINS.find((s) => s.id === id)?.name ?? id;
  return id === DEFAULT_SKIN ? `${name} (Default)` : name;
}

export function skinOf(value: string | undefined | null): SkinId {
  return SKINS.some((s) => s.id === value) ? (value as SkinId) : DEFAULT_SKIN;
}
