// The skins. The server reads the cookie and sets data-skin on <html>; the tokens do the rest.
// W is the default: with no cookie, or a value that is not listed, the server sets W. A has no token block
// (it is the base values), so it needs its own cookie value to override the default.
export const SKINS = [
  { id: 'w', name: 'Warm' },
  { id: 'a', name: 'Plain and familiar' },
  { id: 'b', name: 'Calm and precise' },
  { id: 'c', name: 'Soft and warm' },
] as const;

export type SkinId = (typeof SKINS)[number]['id'];
export const SKIN_COOKIE = 'nd_skin';
export const DEFAULT_SKIN: SkinId = 'w';

export function skinOf(value: string | undefined | null): SkinId {
  return SKINS.some((s) => s.id === value) ? (value as SkinId) : DEFAULT_SKIN;
}
