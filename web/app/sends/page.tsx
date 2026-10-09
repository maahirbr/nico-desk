import { Suspense } from "react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Row } from "@/components/ui/Row";
import { Empty, Section } from "@/components/ui/Section";
import { getPersonOrRedirect } from "@/lib/auth";
import { isOptedIn, listSends } from "@/lib/db/queries-pipeline";
import { fmtStamp } from "@/lib/format";
import { approveSendAction, digestOptInAction, discardSendAction, sendSendAction } from "@/lib/actions/sends";
import { KIND_WORD, STATE_WORD, mayAct, type SendKind } from "@/lib/sends/kinds";
import { asSnapshot, renderText } from "@/lib/sends/render";

const idField = (id: string) => <input type="hidden" name="sendId" value={id} />;

async function Sends() {
  const person = await getPersonOrRedirect();
  const [all, opted] = await Promise.all([listSends(person.memberships.map((m) => m.teamId)), isOptedIn(person.id)]);
  // Only sends this person may act on. The server checks the same rule again on every action.
  const mine = all.filter((s) =>
    mayAct(person, { kind: s.kind as SendKind, teamId: s.teamId, subjectId: s.subjectId, taskOwnerId: s.taskOwnerId }),
  );
  const waiting = mine.filter((s) => s.state === "draft" || s.state === "approved");
  const history = mine.filter((s) => s.state !== "draft" && s.state !== "approved");
  return (
    <>
      <Section title="Monday digest" right={opted ? "On" : "Off"}>
        <p className="alt-meta mb-3">
          {opted
            ? "You get a Monday digest of your own tasks. Your opt-in is the approval. You still press send."
            : "Turn this on to get a Monday digest of your own tasks. Nobody else can turn it on for you."}
        </p>
        <ActionForm action={digestOptInAction}>
          <input type="hidden" name="on" value={opted ? "0" : "1"} />
          <div>
            <Button primary={!opted}>{opted ? "Turn off the digest" : "Turn on the digest"}</Button>
          </div>
        </ActionForm>
      </Section>
      <Section title="Waiting for you" right={`${waiting.length} messages`}>
        {waiting.length === 0 ? (
          <Empty>Nothing is waiting. Messages from the jobs show here when they are made.</Empty>
        ) : (
          waiting.map((s) => {
            const snap = asSnapshot(s.bodySnapshot);
            return (
              <Row key={s.id} className="block!">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{snap.subject}</span>
                  <span className="text-(--ink-74)">{KIND_WORD[s.kind as SendKind]}, {STATE_WORD[s.state]}</span>
                </div>
                <p className="alt-meta mt-1">To {s.recipients.length} {s.recipients.length === 1 ? "person" : "people"} · Made {fmtStamp(s.createdAt)}</p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-sm">{renderText(snap)}</pre>
                {s.state === "draft" ? (
                  <ActionForm action={approveSendAction} className="mt-3">
                    {idField(s.id)}
                    {s.kind === "overdue_weekly" ? (
                      <Field label="Covering text" name="coveringText" type="textarea" defaultValue={snap.covering} maxLength={1000} hint="You can change this before you approve." />
                    ) : null}
                    <div>
                      <Button primary>Approve</Button>
                    </div>
                  </ActionForm>
                ) : (
                  <ActionForm action={sendSendAction} className="mt-3">
                    {idField(s.id)}
                    <div>
                      <Button primary>Send</Button>
                    </div>
                  </ActionForm>
                )}
                <ActionForm action={discardSendAction} className="mt-2">
                  {idField(s.id)}
                  <div>
                    <Button>Discard</Button>
                  </div>
                </ActionForm>
              </Row>
            );
          })
        )}
      </Section>
      <Section title="History">
        {history.length === 0 ? (
          <Empty>Nothing has been sent or discarded yet.</Empty>
        ) : (
          history.slice(0, 50).map((s) => (
            <Row key={s.id} className="block!">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{asSnapshot(s.bodySnapshot).subject}</span>
                <span className="text-(--ink-74)">{STATE_WORD[s.state]}</span>
              </div>
              <p className="alt-meta mt-1">{[KIND_WORD[s.kind as SendKind], s.sentAt ? fmtStamp(s.sentAt) : null, s.providerId].filter(Boolean).join(" · ")}</p>
            </Row>
          ))
        )}
      </Section>
    </>
  );
}

export default function SendsPage() {
  return (
    <Suspense fallback={null}>
      <Sends />
    </Suspense>
  );
}
