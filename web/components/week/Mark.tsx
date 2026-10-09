// A mark: an 8px square plus its word. Filled means judged, hollow means still open. Colour is set by m-green, m-amber, m-red or m-grey.
import type { MarkSpec } from "./lines";

export function Mark({ tone, word, open }: MarkSpec) {
  return (
    <span className={`mark m-${tone}${open ? " open" : ""}`}>
      <i aria-hidden />
      {word}
    </span>
  );
}
