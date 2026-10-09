"use client";
// Runs a server action and shows its plain error or its done line next to the form. No optimistic UI.
import { useActionState, type ReactNode } from "react";

export type ActionResult = { error?: string; ok?: string } | null;
type Act = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

export function ActionForm({ action, children, className = "" }: { action: Act; children: ReactNode; className?: string }) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className={`flex flex-col gap-4 ${className}`.trim()}>
      {children}
      {state?.error ? (
        <p role="alert" className="font-medium" style={{ color: "var(--ink)", borderLeft: "2px solid var(--ink)", paddingLeft: 10 }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="alt-meta">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
