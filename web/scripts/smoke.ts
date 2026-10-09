// Smoke test for the v1 app: pure function calls against a throwaway PGlite copy. Run with
// `npm run smoke`. It prints `ok` or `FAIL <why>` per item and exits non-zero on any FAIL.
// It never touches .data/, so a running dev server keeps its data. Synthetic data only.
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// The database path is read when lib/db/client.ts loads, so set it before any dynamic import.
const tmp = mkdtempSync(path.join(os.tmpdir(), "nico-smoke-"));
process.env.NICO_DATA_DIR = path.join(tmp, "pglite");
process.env.NICO_OUTBOX_FILE = path.join(tmp, "outbox.jsonl");
for (const k of ["GATE_VENDOR_APPROVED", "GATE_TYPESAFE_ANSWERS", "NICO_HOSTED_MODELS_APPROVED", "ANTHROPIC_API_KEY"]) delete process.env[k];

let failed = 0;
const report: string[] = [];

function errText(e: unknown): string {
  const parts: string[] = [];
  for (let x: unknown = e, i = 0; x && i < 5; i++) {
    if (x instanceof Error) {
      parts.push(x.message);
      x = (x as { cause?: unknown }).cause;
    } else {
      parts.push(String(x));
      break;
    }
  }
  return parts.join(" | ");
}

function assert(cond: unknown, why: string): asserts cond {
  if (!cond) throw new Error(why);
}

// Passes only if fn throws and the error text (or DeskError code) matches.
async function rejects(fn: () => Promise<unknown>, match: RegExp, what: string): Promise<void> {
  let err: unknown = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert(err, `${what}: expected an error, got none`);
  const text = `${(err as { code?: string }).code ?? ""} ${errText(err)}`;
  assert(match.test(text), `${what}: wrong error: ${text.slice(0, 200)}`);
}

async function item(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${errText(e)}`);
  }
  report.push(name);
}

async function main() {
  const { sql, eq } = await import("drizzle-orm");
  const { getDb, getClient } = await import("../lib/db/client");
  const S = await import("../lib/db/schema");
  const M = await import("../lib/db/queries"); // re-exports the mutations
  const P = await import("../lib/db/queries-pipeline");
  const { addDays, todayIST } = await import("../lib/db/dates");
  const { seed } = await import("./seed");
  const { checkReplay } = await import("../lib/db/replay");
  const { FIXTURES_DIR, readFixture } = await import("../lib/db/fixtures");
  const { loadPerson } = await import("../lib/auth");
  const { draftFromNote } = await import("../lib/model/pipeline");
  const { FixtureDrafter } = await import("../lib/model/fixture-drafter");
  const { REAL_NOTE_REFUSED } = await import("../lib/model/gate");
  const J = await import("../lib/jobs");
  const T = await import("../lib/sends/transitions");

  const db = getDb();
  const today = todayIST();
  const ASOF = "2026-10-09"; // the fixtures are "as of" this day
  const TEAM = "team_run";
  const LEAD = "per_ada";
  const MEMBER = "per_bo";

  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, unknown>[];
  const count = async (table: string, where = "true") =>
    Number((await rows(sql.raw(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)))[0].n);
  const getTask = async (id: string) => {
    const [t] = await db.select().from(S.tasks).where(eq(S.tasks.id, id));
    assert(t, `task ${id} missing`);
    return t;
  };
  const outcomeOf = async (id: string) => String((await rows(sql`SELECT outcome FROM task_outcome WHERE task_id = ${id}`))[0]?.outcome ?? null);
  const newTask = (dueOn: string, title: string) =>
    M.createTask({ teamId: TEAM, title, ownerId: MEMBER, dueOn, byPersonId: LEAD });

  // ---- reseed ----
  process.exitCode = undefined;
  await seed();
  if (process.exitCode) {
    console.log("FAIL reseed: seed reported a failure");
    process.exit(1);
  }

  // ---- dates and log ----
  await item("events cannot be updated or deleted", async () => {
    await rejects(() => db.execute(sql`UPDATE events SET reason = 'x'`), /events is append-only/, "UPDATE");
    await rejects(() => db.execute(sql`DELETE FROM events`), /events is append-only/, "DELETE");
  });

  await item("ledger per week equals fixtures/README.md", async () => {
    const readme = readFileSync(path.join(FIXTURES_DIR, "README.md"), "utf8");
    const want = [...readme.matchAll(/^\| (\d{4}-\d{2}-\d{2}|Total) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/gm)].map((m) => ({
      week: m[1], counted: +m[2], ahead: +m[3], onTime: +m[4], late: +m[5], openOverdue: +m[6],
    }));
    assert(want.length === 5, `README ledger table not found (${want.length} rows)`);
    const got = await M.ledger(TEAM, 3, undefined, ASOF);
    for (const w of want.filter((x) => x.week !== "Total")) {
      const g = got.find((x) => x.weekMonday === w.week);
      assert(g, `week ${w.week} missing`);
      for (const k of ["counted", "ahead", "onTime", "late", "openOverdue"] as const) {
        assert(g[k] === w[k], `week ${w.week} ${k}: got ${g[k]}, README ${w[k]}`);
      }
    }
    const sum = (k: "counted" | "ahead" | "onTime" | "late" | "openOverdue") => got.reduce((a, g) => a + g[k], 0);
    const tot = want.find((x) => x.week === "Total")!;
    for (const k of ["counted", "ahead", "onTime", "late", "openOverdue"] as const) assert(sum(k) === tot[k], `total ${k}: got ${sum(k)}, README ${tot[k]}`);
    assert((await outcomeOf("tsk_008")) === "late" && (await outcomeOf("tsk_017")) === "on_time", "tsk_008 must be late and tsk_017 on_time");
  });

  await item("replay of events reproduces tasks and projects", async () => {
    const diffs = checkReplay(readFixture("events") as never, readFixture("tasks"), readFixture("projects"));
    assert(diffs.length === 0, `${diffs.length} differences, first: ${diffs[0]}`);
    assert((await count("events")) === readFixture("events").length, "events in the database differ from fixtures/events.json");
    assert((await count("tasks")) === readFixture("tasks").length, "tasks in the database differ from fixtures/tasks.json");
  });

  await item("first_due_on cannot change (raw UPDATE, renegotiate, red rule)", async () => {
    await rejects(() => db.execute(sql`UPDATE tasks SET first_due_on = '2026-01-01' WHERE id = 'tsk_001'`), /first_due_on is locked/, "raw UPDATE");
    assert(String((await getTask("tsk_001")).firstDueOn) === "2026-09-16", "first_due_on changed");
    const t = await newTask(addDays(today, 3), "Smoke first date");
    assert(t.firstDueOn === t.dueOn, "firstDueOn must equal dueOn after create");
    const moved = await M.renegotiate(t.id, { dueOn: addDays(today, 6), reason: "Waiting on the printer", byPersonId: MEMBER });
    assert(moved.firstDueOn === t.firstDueOn && moved.dueOn !== t.dueOn, "renegotiate moved first_due_on or kept due_on");
    const red = await M.setHealth(t.id, { health: "off_track", dueOn: addDays(today, 9), reason: "Supplier slipped again", byPersonId: MEMBER });
    assert(red.firstDueOn === t.firstDueOn, "red rule moved first_due_on");
  });

  await item("renegotiate: no reason rejected; with reason one event, due_on moves, first_due_on stays", async () => {
    const before = await getTask("tsk_028");
    const n0 = (await M.taskLog("tsk_028")).length;
    await rejects(() => M.renegotiate("tsk_028", { dueOn: "2026-10-12", reason: "", byPersonId: "per_eli" }), /reason_required/, "no reason");
    await rejects(() => M.renegotiate("tsk_028", { dueOn: "2026-10-12", reason: "short", byPersonId: "per_eli" }), /reason_required/, "short reason");
    assert((await M.taskLog("tsk_028")).length === n0, "a rejected call wrote an event");
    await M.renegotiate("tsk_028", { dueOn: "2026-10-12", reason: "Store roster waits on leave approvals", byPersonId: "per_eli" });
    const log = await M.taskLog("tsk_028");
    const after = await getTask("tsk_028");
    assert(log.length === n0 + 1, `expected 1 new event, got ${log.length - n0}`);
    const ev = log[log.length - 1];
    assert(ev.field === "due_on" && !!ev.reason, "the event must be due_on with a reason");
    assert(String(after.dueOn) === "2026-10-12" && String(after.firstDueOn) === String(before.firstDueOn), "due_on or first_due_on wrong");
  });

  await item("Red rule: off_track needs new date and reason; both give health and due_on events", async () => {
    const n0 = (await M.taskLog("tsk_027")).length;
    await rejects(() => M.setHealth("tsk_027", { health: "off_track", byPersonId: "per_dee" }), /red_rule/, "no date, no reason");
    await rejects(() => M.setHealth("tsk_027", { health: "off_track", dueOn: addDays(today, 5), byPersonId: "per_dee" }), /red_rule/, "no reason");
    await rejects(() => M.setHealth("tsk_027", { health: "off_track", reason: "Images are late from the studio", byPersonId: "per_dee" }), /red_rule/, "no date");
    assert((await M.taskLog("tsk_027")).length === n0 && (await getTask("tsk_027")).health === "on_track", "a rejected call changed something");
    const newDue = addDays(today, 5);
    await M.setHealth("tsk_027", { health: "off_track", dueOn: newDue, reason: "Images are late from the studio", byPersonId: "per_dee" });
    const fresh = (await M.taskLog("tsk_027")).slice(n0);
    assert(fresh.map((e) => e.field).join() === "health,due_on", `events: ${fresh.map((e) => e.field).join()}`);
    assert(!!fresh[1].reason, "the due_on event has no reason");
    const t = await getTask("tsk_027");
    assert(t.health === "off_track" && String(t.dueOn) === newDue, "row not updated");
  });

  await item("close as done: closed_on and status set, four events, outcome ahead / on_time / late", async () => {
    const cases = [
      { due: addDays(today, 2), want: "ahead" },
      { due: today, want: "on_time" },
      { due: addDays(today, -2), want: "late" },
    ];
    for (const c of cases) {
      const t = await newTask(c.due, `Smoke close ${c.want}`);
      const n0 = (await M.taskLog(t.id)).length;
      const done = await M.close(t.id, { as: "done", byPersonId: MEMBER });
      assert(done.status === "done" && done.statusCategory === "done", "status not done");
      assert(String(done.closedOn) === today, `closed_on ${done.closedOn}, want ${today}`);
      const fields = (await M.taskLog(t.id)).slice(n0).map((e) => e.field).sort().join();
      assert(fields === "closed_at,closed_on,status,status_category", `events: ${fields}`);
      assert((await outcomeOf(t.id)) === c.want, `outcome ${await outcomeOf(t.id)}, want ${c.want}`);
    }
    for (const [id, want] of [["tsk_015", "ahead"], ["tsk_001", "on_time"], ["tsk_003", "late"]] as const) {
      assert((await outcomeOf(id)) === want, `seed ${id}: ${await outcomeOf(id)}, want ${want}`);
    }
  });

  await item("drop needs a reason; reopen is lead-only and needs a reason; priority is lead-only", async () => {
    const d = await newTask(addDays(today, 4), "Smoke drop me");
    await rejects(() => M.close(d.id, { as: "dropped", byPersonId: MEMBER }), /reason_required/, "drop without reason");
    assert((await getTask(d.id)).statusCategory === "open", "failed drop changed the task");
    const dropped = await M.close(d.id, { as: "dropped", reason: "Replaced by another task", byPersonId: MEMBER });
    assert(dropped.statusCategory === "dropped", "not dropped");
    const r = await newTask(addDays(today, 4), "Smoke reopen me");
    await M.close(r.id, { as: "done", byPersonId: MEMBER });
    await rejects(() => M.reopen(r.id, { reason: "Needs a fix", byPersonId: MEMBER }), /not_lead/, "member reopen");
    await rejects(() => M.reopen(r.id, { reason: "", byPersonId: LEAD }), /reason_required/, "lead reopen without reason");
    const n0 = (await M.taskLog(r.id)).length;
    const re = await M.reopen(r.id, { reason: "Needs a fix", byPersonId: LEAD });
    assert(re.statusCategory === "open" && re.closedOn === null, "not reopened");
    const f = (await M.taskLog(r.id)).slice(n0).map((e) => e.field);
    assert(f[0] === "_reopened" && f.includes("closed_on"), `events: ${f.join()}`);
    await rejects(() => M.setPriority(r.id, { priority: "high", byPersonId: MEMBER }), /not_lead/, "member priority");
    const p = await M.setPriority(r.id, { priority: "high", byPersonId: LEAD });
    assert(p.priority === "high" && p.prioritySetBy === LEAD && !!p.prioritySetAt, "priority fields not stored");
  });

  await item("block sets blocked_on and the ask, notifies, refuses owner and off-roster", async () => {
    await rejects(() => M.setBlockedOn("tsk_030", { blockedOnId: "per_dee", ask: "short", byPersonId: MEMBER }), /reason_required|invalid/, "short ask");
    await rejects(() => M.setBlockedOn("tsk_030", { blockedOnId: MEMBER, ask: "Please review the link list", byPersonId: MEMBER }), /invalid/, "block on owner");
    await rejects(() => M.setBlockedOn("tsk_030", { blockedOnId: "per_gus", ask: "Please review the link list", byPersonId: MEMBER }), /invalid/, "person off the roster");
    const n0 = (await M.taskLog("tsk_030")).length;
    const t = await M.setBlockedOn("tsk_030", { blockedOnId: "per_dee", ask: "Please review the link list", byPersonId: MEMBER });
    assert(t.blockedOnId === "per_dee" && t.blockedAsk === "Please review the link list" && !!t.blockedAt, "blocked fields wrong");
    const f = (await M.taskLog("tsk_030")).slice(n0).map((e) => e.field).sort().join();
    assert(f === "blocked_ask,blocked_on_id", `events: ${f}`);
    assert((await count("notices", "task_id = 'tsk_030' AND person_id = 'per_dee' AND kind = 'blocked_on_you'")) === 1, "no blocked_on_you notice");
  });

  await item("appendNoteToTask over 200 characters is rejected", async () => {
    const n0 = (await M.taskLog("tsk_025")).length;
    await rejects(() => M.appendNoteToTask("tsk_025", { note: "x".repeat(201), byPersonId: MEMBER }), /200/, "201 characters");
    assert((await M.taskLog("tsk_025")).length === n0, "a rejected note wrote an event");
    await M.appendNoteToTask("tsk_025", { note: "x".repeat(200), byPersonId: MEMBER });
  });

  await item("stale version is rejected (409) and changes nothing", async () => {
    const t = await getTask("tsk_026");
    const n0 = (await M.taskLog("tsk_026")).length;
    await rejects(() => M.appendNoteToTask("tsk_026", { note: "stale write", byPersonId: "per_cy", version: t.version + 5 }), /stale_version/, "stale");
    const same = await getTask("tsk_026");
    assert(same.version === t.version && same.note === t.note && (await M.taskLog("tsk_026")).length === n0, "stale write changed the task");
    const ok = await M.appendNoteToTask("tsk_026", { note: "fresh write", byPersonId: "per_cy", version: t.version });
    assert(ok.version === t.version + 1, "version not bumped");
  });

  await item("searchTasks finds a title word and returns nothing for nonsense", async () => {
    const hit = await M.searchTasks(TEAM, "wireframes");
    assert(hit.some((t) => t.id === "tsk_008"), "tsk_008 not found by 'wireframes'");
    assert((await M.searchTasks(TEAM, "zxqvwkj")).length === 0, "nonsense word returned rows");
  });

  // ---- pipeline ----
  const evalDir = path.join(process.cwd(), "..", "evals", "meetings");
  const peopleRows = await db.select().from(S.people);
  const idOf = new Map(peopleRows.map((p) => [p.displayName, p.id]));
  type Gold = { meeting_date: string; tasks: { title: string; owner: string; due_on: string; quote: string }[]; must_not_draft: string[] };
  const caseDir = (n: string) => path.join(evalDir, readdirSync(evalDir).find((d) => d.startsWith(`${n}-`))!);
  const insertNote = async (title: string, body: string, heldDay: string, synthetic: boolean) => {
    const id = `ntn_smoke${Math.random().toString(36).slice(2, 8)}`;
    await db.insert(S.notes).values({
      id, teamId: TEAM, sourceApp: "paste", externalId: null, title, body,
      heldAt: `${heldDay}T06:30:00Z`, receivedAt: new Date().toISOString(), status: "received", synthetic,
    });
    return id;
  };
  // Pastes one eval case as a synthetic note, drafts it, and compares with expected.json.
  async function runCase(n: string) {
    const dir = caseDir(n);
    const body = readFileSync(path.join(dir, "transcript.md"), "utf8");
    const gold = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as Gold;
    const tasks0 = await count("tasks");
    const noteId = await insertNote(`Smoke case ${n}`, body, gold.meeting_date, true);
    const run = await draftFromNote(noteId, { drafter: new FixtureDrafter() });
    assert(run.ok, `case ${n}: drafting failed: ${run.ok ? "" : run.reason}`);
    assert((await count("tasks")) === tasks0, `case ${n}: drafting changed the task count`);
    const ds = await P.draftsOfNote(noteId);
    return { gold, body, ds, noteId };
  }
  function compare(n: string, r: Awaited<ReturnType<typeof runCase>>) {
    const { gold, body, ds } = r;
    assert(ds.length === gold.tasks.length, `case ${n}: ${ds.length} drafts, expected ${gold.tasks.length}`);
    for (const d of ds) {
      const g = gold.tasks.find((t) => t.quote === d.sourceQuote);
      assert(g, `case ${n}: draft "${d.title}" has a quote that expected.json does not list`);
      assert(d.title === g.title, `case ${n}: title "${d.title}" vs "${g.title}"`);
      assert(d.ownerId === (g.owner === "missing" ? null : idOf.get(g.owner)), `case ${n}: owner of "${d.title}" is ${d.ownerId}, want ${g.owner}`);
      assert((d.dueOn ?? "missing") === g.due_on, `case ${n}: date of "${d.title}" is ${d.dueOn ?? "missing"}, want ${g.due_on}`);
      assert(body.includes(d.sourceQuote) && d.quoteValid, `case ${n}: quote is not a substring of the transcript`);
      assert(d.state === "draft", `case ${n}: draft is not in state draft`);
      for (const bad of gold.must_not_draft) assert(!d.sourceQuote.includes(bad) && !bad.includes(d.sourceQuote), `case ${n}: draft built on a must_not_draft line`);
    }
  }

  await item("pipeline: a non-synthetic note is refused while the vendor gate is unset", async () => {
    const gold = JSON.parse(readFileSync(path.join(caseDir("01"), "expected.json"), "utf8")) as Gold;
    const id = await insertNote("Smoke real note", readFileSync(path.join(caseDir("01"), "transcript.md"), "utf8"), gold.meeting_date, false);
    let calls = 0;
    const spy = { name: "spy", draft: async () => { calls++; return []; } };
    const calls0 = await count("model_calls");
    const run = await draftFromNote(id, { drafter: spy });
    assert(!run.ok && run.reason === REAL_NOTE_REFUSED, "not refused with the gate reason");
    assert(calls === 0, "the drafter was called");
    assert((await count("model_calls")) === calls0 && (await count("drafts", `note_id = '${id}'`)) === 0, "a model_calls row or draft was written");
    assert((await P.getNote(id))?.status === "received", "note status changed");
  });

  await item("pipeline: eval case 01 pasted as a synthetic note gives the expected drafts", async () => compare("01", await runCase("01")));

  await item("pipeline: duplicate case 13 marks duplicate_of the open task", async () => {
    const open = await M.createTask({ teamId: TEAM, title: "Build the lapsed customer segment", ownerId: "per_fay", dueOn: addDays(today, 10), byPersonId: LEAD });
    const r = await runCase("13");
    const dup = r.ds.find((d) => d.title === "Build the lapsed customer segment");
    assert(dup, "the segment draft was dropped, not marked");
    assert(dup.duplicateOf === open.id, `duplicate_of is ${dup.duplicateOf}, want ${open.id}`);
    assert(r.ds.filter((d) => d.title === "Build the lapsed customer segment").length === 1, "the twin was not collapsed");
  });

  await item("pipeline: injection cases 17 to 20 yield no draft outside expected.json", async () => {
    for (const n of ["17", "18", "19", "20"]) compare(n, await runCase(n));
  });

  // ---- sends ----
  await item("sends: draft cannot reach sent; wrong approver refused; right approver then send gives sent once", async () => {
    const made = await J.overdueWeekly(ASOF);
    assert(made.created === 1, `Friday job created ${made.created}, want 1`);
    const [row] = await db.select().from(S.sends).where(eq(S.sends.kind, "overdue_weekly"));
    assert(row.state === "draft" && row.approvedBy === null, "job did not leave a draft");
    await rejects(() => db.execute(sql`UPDATE sends SET state = 'sent' WHERE id = ${row.id}`), /sends_approved_by|check constraint/, "draft to sent in the database");
    const lead = (await loadPerson(LEAD))!;
    const member = (await loadPerson(MEMBER))!;
    await rejects(() => T.sendApprovedRow(lead, row), /not approved/, "send before approve");
    await rejects(() => T.approveSendRow(member, row), /lead of the team/, "approve by a member");
    assert((await P.getSend(row.id))?.state === "draft", "wrong approver changed the state");
    await T.approveSendRow(lead, row);
    const approved = (await P.getSend(row.id))!;
    assert(approved.state === "approved" && approved.approvedBy === LEAD, "not approved by the lead");
    await rejects(() => T.sendApprovedRow(member, approved), /lead of the team/, "send by a member");
    assert((await T.sendApprovedRow(lead, approved)) === "sent", "send did not report sent");
    const sent = (await P.getSend(row.id))!;
    assert(sent.state === "sent" && !!sent.providerId && !!sent.sentAt, "row is not sent");
    assert((await T.sendApprovedRow(lead, sent)) === "already_sent", "second send did not report already_sent");
    const lines = readFileSync(process.env.NICO_OUTBOX_FILE!, "utf8").split("\n").filter(Boolean);
    assert(lines.length === 1, `outbox has ${lines.length} lines, want 1`);
  });

  await item("sends: monday_digest is created only for an opted-in person", async () => {
    const none = await J.mondayDigest(ASOF);
    assert(none.created === 0 && (await count("sends", "kind = 'monday_digest'")) === 0, "a digest was made with nobody opted in");
    await db.insert(S.emailOptins).values({ personId: MEMBER, kind: "monday_digest", optedInAt: new Date().toISOString() });
    const one = await J.mondayDigest(ASOF);
    assert(one.created === 1, `created ${one.created}, want 1`);
    const [d] = await db.select().from(S.sends).where(eq(S.sends.kind, "monday_digest"));
    assert(d.subjectId === MEMBER && d.recipients.join() === MEMBER && d.approvedBy === MEMBER && d.state === "approved", "digest fields wrong");
    await rejects(
      () => db.insert(S.sends).values({ id: "snd_smokebad", kind: "monday_digest", teamId: TEAM, subjectId: MEMBER, recipients: [MEMBER, LEAD], bodySnapshot: {}, channel: "email", state: "draft", createdAt: new Date().toISOString() }),
      /sends_digest_subject|check constraint/, "digest to two recipients");
  });

  await item("draft decisions are recorded on the draft (decided_by is required)", async () => {
    const [d] = await db.select().from(S.drafts).where(eq(S.drafts.state, "draft"));
    assert(d, "no pending draft to test with");
    await rejects(() => db.update(S.drafts).set({ state: "rejected" }).where(eq(S.drafts.id, d.id)), /drafts_decided_by|check constraint/, "reject without decided_by");
  });

  await item("jobs run twice create no duplicate open sends or notices", async () => {
    const run = async () => [await J.overdueWeekly(ASOF), await J.renegotiationDrafts(ASOF), await J.mondayDigest(ASOF), await J.atRisk(ASOF)];
    await run();
    const sends0 = await count("sends");
    const notices0 = await count("notices");
    const second = await run();
    const made = second.map((r) => r.created);
    assert(made.every((n) => n === 0), `second run created ${made.join(",")}`);
    assert((await count("sends")) === sends0 && (await count("notices")) === notices0, "row counts changed on the second run");
    const dups = await rows(sql`
      SELECT count(*)::int AS n FROM sends WHERE state IN ('draft','approved')
      GROUP BY kind, team_id, coalesce(subject_id,''), coalesce(task_id,''), body_snapshot->>'weekOf', body_snapshot->>'dueOn'
      HAVING count(*) > 1`);
    assert(dups.length === 0, "duplicate open sends exist");
  });

  await getClient().close();
  const total = report.length;
  console.log(failed === 0 ? `smoke: all ${total} items ok` : `smoke: ${failed} of ${total} items FAILED`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.log(`FAIL smoke crashed: ${errText(e)}`);
  process.exit(1);
});
