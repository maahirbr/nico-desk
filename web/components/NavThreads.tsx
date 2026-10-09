"use client";
// The foot list as threads: each link is a rule that breathes. STATIC and reduced motion remove the breathing.
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  ["/me", "Me"],
  ["/team", "Team"],
  ["/notes", "Notes"],
  ["/drafts", "Drafts"],
  ["/sends", "Sends"],
  ["/search", "Search"],
  ["/dev/jobs", "Jobs"],
] as const;

// children is the short person line. It shows in the row only on a phone, where the header has no room for it.
export function NavThreads({ children }: { children?: ReactNode }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="nav-row">
      {NAV.map(([href, label], i) => {
        const on = path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            style={{ ["--thread-i" as string]: i }}
            className={`thread-row caps py-2 ${on ? "" : "text-(--ink-65)"}`}
          >
            <span className="t-shift inline-block">{label}</span>
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
