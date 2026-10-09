// The three skins. The server reads the cookie and sets data-skin on <html>; the tokens do the rest.
export const SKINS = [
  { id: 'a', name: 'Plain and familiar' },
  { id: 'b', name: 'Calm and precise' },
  { id: 'c', name: 'Soft and warm' },
] as const;

export type SkinId = (typeof SKINS)[number]['id'];
export const SKIN_COOKIE = 'nd_skin';

export function skinOf(value: string | undefined | null): SkinId {
  return SKINS.some((s) => s.id === value) ? (value as SkinId) : 'a';
}
