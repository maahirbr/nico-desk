// The forms on a task page. The page decides who sees which; the server action checks the role again.
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { blockAction, closeAction, healthAction, noteAction, priorityAction, renegotiateAction, reopenAction } from "@/lib/actions/tasks";
import { todayIST } from "@/lib/db/dates";
import type { Person } from "@/lib/db/queries";
import type { TaskRow } from "@/lib/views";

type Can = { owner: boolean; lead: boolean; clearBlock: boolean };
const Hidden = ({ t }: { t: TaskRow }) => (
  <>
    <input type="hidden" name="taskId" value={t.id} />
    <input type="hidden" name="version" value={t.version} />
  </>
);
const HEALTH = [["not_started", "Not started"], ["on_track", "On track"], ["ahead", "Ahead"], ["off_track", "Off track"]].map(([value, label]) => ({ value, label }));
const PRIORITY = [["high", "High"], ["normal", "Normal"], ["low", "Low"]].map(([value, label]) => ({ value, label }));

export function TaskActions({ t, can, team }: { t: TaskRow; can: Can; team: Person[] }) {
  const today = todayIST();
  const others = team.filter((p) => p.id !== t.ownerId).map((p) => ({ value: p.id, label: p.displayName }));
  if (t.origin === "sheet") return <Section title="Actions"><p className="alt-meta">This task comes from a Sheet. Change it there.</p></Section>;
  if (t.statusCategory !== "open") {
    return can.lead ? (
      <Section title="Reopen">
        <ActionForm action={reopenAction}><Hidden t={t} />
          <Field name="reason" label="Why reopen it" type="textarea" required maxLength={280} />
          <div><Button primary>Reopen</Button></div>
        </ActionForm>
      </Section>
    ) : <Section title="Actions"><p className="alt-meta">This task is closed. Ask a lead to reopen it.</p></Section>;
  }
  const forms = (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
      {(can.owner || can.lead) && (
        <ActionForm action={renegotiateAction}><Hidden t={t} />
          <Field name="dueOn" label="New due date" type="date" min={today} required hint="The first date stays on record." />
          <Field name="reason" label="Why the date moves (10 to 280 characters)" type="textarea" required maxLength={280} />
          <div><Button primary>Move the date</Button></div>
        </ActionForm>
      )}
      {(can.owner || can.lead) && (
        <ActionForm action={healthAction}><Hidden t={t} />
          <Field name="health" label="Health" type="select" options={HEALTH} defaultValue={t.health ?? "not_started"} />
          <Field name="dueOn" label="New due date (Off track only)" type="date" min={today} hint="Off track needs a new date and a reason, in this form." />
          <Field name="reason" label="Why (Off track only, 10 to 280 characters)" type="textarea" maxLength={280} />
          <div><Button primary>Save health</Button></div>
        </ActionForm>
      )}
      {(can.owner || can.lead) && (
        <ActionForm action={noteAction}><Hidden t={t} />
          <Field name="note" label="Note (200 characters)" type="textarea" required maxLength={200} defaultValue={t.note ?? ""} />
          <div><Button>Save the note</Button></div>
        </ActionForm>
      )}
      {can.lead && (
        <ActionForm action={priorityAction}><Hidden t={t} />
          <Field name="priority" label="Priority" type="select" options={PRIORITY} defaultValue={t.priority ?? "normal"} />
          <div><Button>Set priority</Button></div>
        </ActionForm>
      )}
      {can.owner && !t.blockedOnId && (
        <ActionForm action={blockAction}><Hidden t={t} />
          <Field name="blockedOnId" label="Blocked on" type="select" options={others} />
          <Field name="ask" label="What you need from them (10 to 280 characters)" type="textarea" required maxLength={280} />
          <div><Button>Raise a block</Button></div>
        </ActionForm>
      )}
      {t.blockedOnId && can.clearBlock && (
        <ActionForm action={blockAction}><Hidden t={t} />
          <input type="hidden" name="mode" value="clear" />
          <Field name="note" label="Note (optional)" type="textarea" maxLength={280} />
          <div><Button>Clear the block</Button></div>
        </ActionForm>
      )}
    </div>
  );
  return (
    <>
      <Section title="Change this task">{forms}</Section>
      {(can.owner || can.lead) && (
        <Section title="Close this task">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            <ActionForm action={closeAction}><Hidden t={t} /><input type="hidden" name="as" value="done" /><div><Button primary>Close as done</Button></div></ActionForm>
            <ActionForm action={closeAction}><Hidden t={t} /><input type="hidden" name="as" value="dropped" />
              <Field name="reason" label="Why drop it" type="textarea" required maxLength={280} />
              <div><Button>Drop with reason</Button></div>
            </ActionForm>
          </div>
        </Section>
      )}
    </>
  );
}
