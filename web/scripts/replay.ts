import { checkReplay, type EventLike } from "../lib/db/replay";
import { FIXTURES_DIR, missingFixtures, readFixture } from "../lib/db/fixtures";

const need = ["events.json", "tasks.json", "projects.json"];
const missing = missingFixtures().filter((m) => need.includes(m));
if (missing.length > 0) {
  console.error(`fixtures not ready: missing ${missing.join(", ")} in ${FIXTURES_DIR}`);
  process.exit(1);
}
const diffs = checkReplay(
  readFixture("events") as unknown as EventLike[],
  readFixture("tasks"),
  readFixture("projects"),
);
if (diffs.length === 0) {
  console.log("OK: replay matches");
} else {
  console.error(`FAIL: replay differs in ${diffs.length} place(s)`);
  for (const d of diffs) console.error(`  ${d}`);
  process.exit(1);
}
