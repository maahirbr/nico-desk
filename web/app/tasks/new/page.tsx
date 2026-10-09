import { Suspense } from "react";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Empty, Section } from "@/components/ui/Section";
import { getPersonOrRedirect, isLeadOf, pickTeam } from "@/lib/auth";
import { createTaskAction } from "@/lib/actions/tasks";
import { todayIST } from "@/lib/db/dates";
import { listProjects, roster } from "@/lib/views";

async function NewTask() {
  const person = await getPersonOrRedirect();
  const team = await pickTeam(person);
  if (!team) return <Section title="New task"><Empty>You are not on a team yet.</Empty></Section>;
  const [people, projects] = await Promise.all([roster(team.teamId), listProjects(team.teamId)]);
  return (
    <Section title="New task" right={team.teamName}>
      <ActionForm action={createTaskAction} className="max-w-xl">
        <input type="hidden" name="teamId" value={team.teamId} />
        <Field name="title" label="Title" required maxLength={200} />
        <Field name="ownerId" label="Owner" type="select" defaultValue={person.id} options={people.map((p) => ({ value: p.id, label: p.displayName }))} />
        <Field name="projectId" label="Project" type="select" options={[{ value: "", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
        <Field name="dueOn" label="Due date" type="date" min={todayIST()} required hint="This is also the first due date. It cannot be changed afterwards." />
        {isLeadOf(person, team.teamId) ? (
          <Field name="priority" label="Priority" type="select" options={[{ value: "", label: "Not set" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} />
        ) : null}
        <Field name="note" label="Note (200 characters)" type="textarea" maxLength={200} />
        <div><Button primary>Create the task</Button></div>
      </ActionForm>
    </Section>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={null}>
      <NewTask />
    </Suspense>
  );
}
