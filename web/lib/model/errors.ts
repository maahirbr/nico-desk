// One plain sentence for an error, shown next to the form. Unknown errors are logged, not shown.
import { AuthError } from "@/lib/auth";
import { DeskError } from "@/lib/db/mutations";

export function plainError(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof DeskError) return `${e.message.charAt(0).toUpperCase()}${e.message.slice(1)}.`;
  console.error(e);
  return "Something went wrong. Nothing was saved.";
}
