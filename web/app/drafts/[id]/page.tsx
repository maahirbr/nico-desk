import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Pair, Row } from "@/components/ui/Row";
import { Empty, Section } from "@/components/ui/Section";
import { getPersonOrRedirect, isLeadOf } from "@/lib/auth";
import { getDraft } from "@/lib/db/queries-pipeline";
import { fmtDay } from "@/lib/format";
import { approveDraftAction, mergeDraftAction, rejectDraftAction } from "@/lib/actions/drafts";
import { getTask, listProjects, roster } from "@/lib/views";
import type { CheckResult } from "@/lib/model/types";

const PASS = (c: CheckResult) => (c.pass === null ? "Did not run" : c.pass ? "Pass" : "Fail");

async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await getPersonOrRedirect();
  const d = await getDraft(id);
  if (!d || !isLeadOf(person, d.note.teamId)) notFound();
  const [team, projects, dup] = await Promise.all([roster(d.note.teamId), listProjects(d.note.teamId), d.duplicateOf ? getTask(d.duplicateOf) : null]);
  const checks = Array.isArray(d.checks) ? (d.checks as CheckResult[]) : [];
  const open = d.state === "draft";
  return (
    <>
      <Section title="Draft" right={<Link href={`/notes/${d.noteId}`} className="underline">{d.note.title}</Link>}>
        <h1 className="mb-4 text-(length:--text-xl) font-medium">{d.title}</h1>
        <dl>
          <Pair label="State">{d.state === "draft" ? "Waiting for you" : d.state === "approved" ? "Approved" : "Rejected"}{d.decisionNote ? <span className="alt-meta ml-2">{d.decisionNote}</span> : null}</Pair>
          <Pair label="Said by">{d.spokenOwner ?? "Nobody named"}</Pair>
          <Pair label="Date words">{d.duePhrase ?? "None said"}{d.dueOn ? <span className="alt-meta ml-2">{fmtDay(d.dueOn)}, {d.dueKind}</span> : <span className="alt-meta ml-2">No date worked out</span>}</Pair>
          <Pair label="Critical">{d.critical ? "Yes" : "No"}</Pair>
          <Pair label="Confidence">{Math.round(d.confidence * 100)}%</Pair>
          <Pair label="Quote">
            <blockquote className="whitespace-pre-wrap">{d.sourceQuote}</blockquote>
            <span className="alt-meta">{d.quoteValid ? "Found in the note." : "Not found in the note. Do not trust this draft."}</span>
          </Pair>
          {d.taskId ? <Pair label="Task"><Link href={`/tasks/${d.taskId}`} className="underline">Open the task</Link></Pair> : null}
        </dl>
      </Section>
      <Section title="Checks">
        {checks.length === 0 ? (
          <Empty>No checks were recorded.</Empty>
        ) : (
          checks.map((c) => (
            <Row key={c.name} className="block!">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{c.name}</span>
                <span className="text-(--ink-74)">{PASS(c)}</span>
              </div>
              <p className="alt-meta mt-1">{c.detail}</p>
            </Row>
          ))
        )}
      </Section>
      {open ? (
        <>
          <Section title="Approve">
            <ActionForm action={approveDraftAction}>
              <input type="hidden" name="draftId" value={d.id} />
              <Field label="Title" name="title" defaultValue={d.title} required maxLength={200} />
              <Field
                label="Owner"
                name="ownerId"
                type="select"
                required
                defaultValue={d.ownerId ?? ""}
                options={[{ value: "", label: "Choose an owner" }, ...team.map((p) => ({ value: p.id, label: p.displayName }))]}
                hint={d.ownerId ? undefined : "No owner could be matched. You choose one."}
              />
              <Field label="Due date" name="dueOn" type="date" required defaultValue={d.dueOn ?? ""} hint={d.dueOn ? undefined : "No date was worked out. You choose one."} />
              <Field
                label="Project"
                name="projectId"
                type="select"
                options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
              />
              <div>
                <Button primary>Approve and make the task</Button>
              </div>
            </ActionForm>
          </Section>
          {dup ? (
            <Section title="May repeat an open task">
              <p className="mb-3">
                <Link href={`/tasks/${dup.id}`} className="underline">{dup.title}</Link> <span className="alt-meta">is already open.</span>
              </p>
              <ActionForm action={mergeDraftAction}>
                <input type="hidden" name="draftId" value={d.id} />
                <div>
                  <Button>Merge into that task</Button>
                </div>
              </ActionForm>
            </Section>
          ) : null}
          <Section title="Reject">
            <ActionForm action={rejectDraftAction}>
              <input type="hidden" name="draftId" value={d.id} />
              <Field label="Reason" name="reason" type="textarea" maxLength={280} hint="Optional. Saved on the draft." />
              <div>
                <Button>Reject</Button>
              </div>
            </ActionForm>
          </Section>
        </>
      ) : null}
    </>
  );
}

export default function DraftRoute({ params }: PageProps<"/drafts/[id]">) {
  return (
    <Suspense fallback={null}>
      <DraftPage params={params} />
    </Suspense>
  );
}
