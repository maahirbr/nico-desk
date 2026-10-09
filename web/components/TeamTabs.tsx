// The four team views as tabs. Each tab is its own route; ?team= carries across.
import Link from "next/link";
import { teamQuery, type TeamSearch } from "@/lib/views";

const TABS = [
  ["week", "Week"],
  ["by-status", "By status"],
  ["ledger", "Ledger"],
  ["load", "Load"],
] as const;

export function TeamTabs({ active, q, teamName }: { active: string; q: TeamSearch; teamName: string }) {
  return (
    <div className="px-[14px] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-(length:--text-xl) font-medium">{teamName}</h1>
        <nav role="tablist" aria-label="Team views" className="flex gap-6">
          {TABS.map(([slug, label]) => (
            <Link key={slug} role="tab" aria-selected={slug === active} href={`/team/${slug}${teamQuery(q)}`} className="alt-tab">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
