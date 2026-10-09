import { Suspense } from "react";
import { connection } from "next/server";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Empty, Section } from "@/components/ui/Section";
import { Row, Table } from "@/components/ui/Row";
import { sendCounts } from "@/lib/db/queries-pipeline";
import { JOBS } from "@/lib/jobs";
import { runJobAction } from "./actions";

async function Jobs() {
  await connection();
  const counts = await sendCounts();
  return (
    <>
      <Section title="Jobs" right="Local only. No schedule: press a button.">
        {Object.entries(JOBS).map(([name, j]) => (
          <Row key={name} className="block!">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{j.title}</span>
              <ActionForm action={runJobAction} className="flex-row! items-baseline">
                <input type="hidden" name="job" value={name} />
                <Button primary>Run</Button>
              </ActionForm>
            </div>
            <p className="alt-meta mt-1">{j.note}</p>
          </Row>
        ))}
      </Section>
      <Section title="Sends by kind and state">
        {counts.length === 0 ? (
          <Empty>No sends yet.</Empty>
        ) : (
          <Table head={["Kind", "State", "Count"]}>
            {counts.map((c) => (
              <tr key={`${c.kind}-${c.state}`}>
                <td>{c.kind}</td>
                <td>{c.state}</td>
                <td>{c.n}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <Jobs />
    </Suspense>
  );
}
