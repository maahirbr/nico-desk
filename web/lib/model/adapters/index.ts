// The notetaker adapter interface (FR-62). Whatever the adapter, it hands over the same shape,
// and the route writes the same notes row. Adding an adapter changes no drafter code and no column.
import { granola } from "./granola";

export type IncomingNote = {
  sourceApp: string; // "granola", never "paste": paste has no external id
  externalId: string;
  teamId: string;
  title: string;
  body: string;
  heldAt: string; // ISO timestamp
};

export interface NoteAdapter {
  readonly name: string;
  // True only for a correctly signed call. Unsigned or badly signed is false.
  verify(headers: Headers, rawBody: string): boolean;
  // null means "a valid call we do not process" (another event type, or a space not listed).
  parse(json: unknown): IncomingNote | null;
  // The poller (FR-44): notes missed by the webhook. Not built in v1 for any adapter.
  poll?(sinceIso: string): Promise<IncomingNote[]>;
}

const registry: Record<string, NoteAdapter> = { granola };

export function getAdapter(name: string): NoteAdapter | null {
  return Object.hasOwn(registry, name) ? registry[name] : null;
}
