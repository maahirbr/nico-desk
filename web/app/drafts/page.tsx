import Link from "next/link";
import { Suspense } from "react";
import { Empty, Section } from "@/components/ui/Section";
import { Row } from "@/components/ui/Row";
import { getPersonOrRedirect } from "@/lib/auth";
import { istDay } from "@/lib/db/dates";
import { listDrafts } from "@/lib/db/queries-pipeline";
import { fmtDay } from "@/lib/format";
import type { CheckResult } from "@/lib/model/types";

const missing = (d: { ownerId: string | null; dueOn: string | null }) => [d.ownerId ? null : "no owner", d.dueOn ? null : "no date"].filter(Boolean);
const failed = (checks: unknown) => (Array.isArray(checks) ? (checks as CheckResult[]).filter((c) => c.pass === false).length : 0);

async function Drafts() {
  const person = await getPersonOrRedirect();
  const leadOf = person.memberships.filter((m) => m.appRole === "lead").map((m) => m.teamId);
  if (leadOf.length === 0) {
    return (
      <Section title="Drafts">
        <Empty>Only a team lead reviews drafts.</Empty>
      </Section>
    );
  }
  const [pending, decided] = await Promise.all([listDrafts(leadOf, "pending"), listDrafts(leadOf, "decided")]);
  return (
    <>
      <Section title="Waiting for you" right={`${pending.length} drafts`}>
        {pending.length === 0 ? (
          <Empty>Nothing is waiting. Drafts from new notes will show here.</Empty>
        ) : (
          pending.map((d) => (
            <Row key={d.id} className="block!">
              <div className="flex items-baseline justify-between gap-4">
                <Link href={`/drafts/${d.id}`} className="font-medium hover:underline">
                  {d.title}
                </Link>
                <span className="text-(--ink-74)">{d.critical ? "Critical" : "Normal"}</span>
              </div>
              <p className="alt-meta mt-1">
                {[
                  d.noteTitle,
                  `Confidence ${Math.round(d.confidence * 100)}%`,
                  ...missing(d),
                  d.duplicateOf ? "May repeat an open task" : null,
                  failed(d.checks) ? `${failed(d.checks)} check failed` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Row>
          ))
        )}
      </Section>
      <Section title="Decided">
        {decided.length === 0 ? (
          <Empty>No draft has been decided yet.</Empty>
        ) : (
          decided.slice(0, 50).map((d) => (
            <Row key={d.id} className="block!">
              <div className="flex items-baseline justify-between gap-4">
                <Link href={`/drafts/${d.id}`} className="font-medium hover:underline">
                  {d.title}
                </Link>
                <span className="text-(--ink-74)">{d.state === "approved" ? "Approved" : "Rejected"}</span>
              </div>
              <p className="alt-meta mt-1">
                {[d.noteTitle, d.decidedAt ? fmtDay(istDay(d.decidedAt)) : null, d.decisionNote].filter(Boolean).join(" · ")}
              </p>
            </Row>
          ))
        )}
      </Section>
    </>
  );
}

export default function DraftsPage() {
  return (
    <Suspense fallback={null}>
      <Drafts />
    </Suspense>
  );
}
