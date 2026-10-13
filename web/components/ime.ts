// Dictation and IME rules, in one place so every field follows them.
// 1. Enter that confirms a composition (Japanese, Chinese, Korean, or a dictation app) is not a submit.
//    Chrome and Firefox set isComposing. Safari sends keyCode 229 on that Enter and may already have cleared isComposing.
// 2. A box with a maxLength cuts what is typed or pasted past the limit without a word. cutBy() says how much was cut,
//    and LimitNotice tells the person.

type KeyLike = { isComposing?: boolean; keyCode?: number; nativeEvent?: { isComposing?: boolean; keyCode?: number } };

export function composing(e: KeyLike): boolean {
  const n = e.nativeEvent ?? e;
  return !!(n.isComposing || e.isComposing || n.keyCode === 229 || e.keyCode === 229);
}

// True for an Enter that is a real Enter: the person meant it, not the dictation or IME confirm.
export function isRealEnter(e: KeyLike & { key: string }): boolean {
  return e.key === 'Enter' && !composing(e);
}

// How many characters the browser will drop when `insert` replaces value[start..end] in a box limited to `max`.
export function cutBy(value: string, start: number, end: number, insert: string, max: number): number {
  if (!(max >= 0)) return 0;
  const s = Math.min(start, end), e = Math.max(start, end);
  const after = value.length - (e - s) + insert.length;
  return Math.max(0, after - max);
}
