// One task as a ruled row: title and health on the first line, the facts under it.
import Link from "next/link";
import { Mark } from "@/components/ui/Mark";
import { Row } from "@/components/ui/Row";
import { PRIORITY_WORD, dateLine, lateBy, outcomeOf, outcomeWord, relDays } from "@/lib/format";
import { istDay } from "@/lib/db/dates";
import type { TaskRow } from "@/lib/views";

export function TaskLine({ t, today, showOwner = false }: { t: TaskRow; today: string; showOwner?: boolean }) {
  const open = t.statusCategory === "open";
  const late = open && t.dueOn < today ? lateBy(t.firstDueOn, today) : null;
  const outcome = t.statusCategory === "done" && t.closedOn ? outcomeOf(t.closedOn, t.firstDueOn) : null;
  const facts = [
    showOwner ? t.ownerName : null,
    t.projectName,
    dateLine(t.dueOn, t.firstDueOn, t.moves),
    t.priority ? `Priority ${PRIORITY_WORD[t.priority].toLowerCase()}` : null,
    t.blockedOnName ? `Blocked on ${t.blockedOnName}${t.blockedAsk ? `: ${t.blockedAsk}` : ""}` : null,
    t.lastAt ? `Updated ${relDays(istDay(t.lastAt), today)}` : null,
    t.origin === "sheet" ? "From Sheet" : null,
  ].filter(Boolean);
  return (
    <Row className="block!">
      <div className="flex items-baseline justify-between gap-4">
        <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">
          {t.title}
        </Link>
        <span className="flex items-baseline gap-4 text-(--ink-74)">
          {late ? <span className="font-medium">{late}</span> : null}
          {outcome ? <Mark kind={outcome} word={outcomeWord(outcome)} /> : <Mark kind={t.health} />}
        </span>
      </div>
      <p className="alt-meta mt-1">{facts.join(" · ")}</p>
    </Row>
  );
}
