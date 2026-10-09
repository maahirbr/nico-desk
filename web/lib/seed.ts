import fs from 'node:fs';
import path from 'node:path';
import type { Tx } from './db';
import { seedAsks } from './seedAsks';
import { today } from './time';

// Loads the synthetic fixtures into the SPEC.md schema. Fills the fields the fixtures predate
// (SPEC.md 3.6): one pilot team, first_due_on from each task's _created event, health from the
// fixture status word, and reasons on the events that now require one.

export const TEAM_ID = 'team_pilot';

const LEADS = ['per_ada'];
const ADMINS = ['per_fay'];

const FIXTURE_REASONS: Record<string, string> = {
  tsk_008: 'Proofs arrived two days late from the printer.',
  tsk_017: 'Pulled in a day to fit the shoot schedule.',
};

type Row = Record<string, any>;

// A local roster overlay, kept out of git (roster.local.json): real names on a local run while the
// public repo keeps synthetic ones. Keys are fixture person ids.
export type RosterOverlay = Record<string, { display_name?: string; role?: string; department?: string; email?: string; contact_email?: string; never_remind?: boolean; roles?: ('lead' | 'admin')[]; merged_into?: string }>;

// The desk owner on a local run ("me" in roster.local.json): sign-in offers them first.
export function localOwnerId(file: string): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const me = JSON.parse(fs.readFileSync(file, 'utf8')).me;
  return typeof me === 'string' ? me : undefined;
}

export function loadRosterOverlay(file: string): RosterOverlay | undefined {
  if (!fs.existsSync(file)) return undefined;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (raw.people ?? raw) as RosterOverlay;
}

function load(dir: string, name: string): Row[] {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
}

const j = (v: unknown) => (v === null || v === undefined ? null : JSON.stringify(v));

export async function seed(tx: Tx, dir: string, overlay?: RosterOverlay, local?: LocalProjects): Promise<void> {
  const people: Row[] = load(dir, 'people.json').map((p) => ({ ...p, ...(overlay?.[p.id] ?? {}) }));
  const projects = load(dir, 'projects.json');
  const tasks = load(dir, 'tasks.json');
  const events = load(dir, 'events.json');

  await tx.query(`INSERT INTO teams VALUES ($1, $2, 'run')`, [TEAM_ID, 'Pilot team (synthetic)']);
  for (const p of people) {
    await tx.query(`INSERT INTO people (id, display_name, role, department, email, contact_email, never_remind) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      p.id, p.display_name, p.role, p.department, p.email, p.contact_email ?? null, !!p.never_remind,
    ]);
    await tx.query(`INSERT INTO team_members VALUES ($1, $2, 'member')`, [TEAM_ID, p.id]);
    const roles: string[] = p.roles ?? [...(LEADS.includes(p.id) ? ['lead'] : []), ...(ADMINS.includes(p.id) ? ['admin'] : [])];
    for (const r of roles) await tx.query(`INSERT INTO team_members VALUES ($1, $2, $3)`, [TEAM_ID, p.id, r]);
  }
  for (const p of projects) {
    await tx.query(
      `INSERT INTO projects (id, team_id, name, department, owner_id, status, status_note, status_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.id, TEAM_ID, p.name, p.department, p.owner_id, p.status, p.status_note, p.status_at],
    );
  }

  const created = new Map<string, Row>();
  for (const e of events) if (e.entity_type === 'task' && e.field === '_created') created.set(e.entity_id, e);

  for (const t of tasks) {
    const c = created.get(t.id);
    if (!c) throw new Error(`fixture task ${t.id} has no _created event`);
    const health =
      t.status_category !== 'open' || t.origin === 'sheet' ? null : t.status === 'todo' ? 'not_started' : 'on_track';
    await tx.query(
      `INSERT INTO tasks (id, team_id, title, owner_id, project_id, first_due_on, due_on, health, status, status_category,
         origin, origin_ref, created_by, created_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        t.id, TEAM_ID, t.title, t.owner_id, t.project_id, c.after.due_on, t.due_on, health, t.status,
        t.status_category, t.origin, t.origin_ref, c.actor_id, t.created_at, t.closed_at,
      ],
    );
  }

  for (const e of events) {
    let reason: string | null = e.reason ?? null;
    if (!reason && e.field === 'due_on') reason = FIXTURE_REASONS[e.entity_id] ?? 'Date moved (fixture).';
    if (!reason && e.field === 'status_category' && e.after === 'dropped') reason = 'No longer needed (fixture).';
    await tx.query(
      `INSERT INTO events (id, entity_type, entity_id, field, before, after, reason, actor_id, origin, at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10)`,
      [e.id, e.entity_type, e.entity_id, e.field, j(e.before), j(e.after), reason, e.actor_id, e.origin, e.at],
    );
  }

  await seedPlan(tx, dir, people, !!local?.drop_sample_plan);
  if (local) await seedLocalProjects(tx, local, people);
  // v2 demo asks: synthetic, so never on a run with a real roster or real projects.
  if (!overlay && !local) await seedAsks(tx, TEAM_ID, today());
  // A smaller local team: a person marked merged_into hands their work to that person and leaves
  // the team. Their history stays, under their name.
  for (const [id, o] of Object.entries(overlay ?? {})) {
    if (!o.merged_into) continue;
    const to = o.merged_into;
    await tx.query(`UPDATE tasks SET owner_id = $2 WHERE owner_id = $1`, [id, to]);
    await tx.query(`UPDATE tasks SET blocked_on_id = $2 WHERE blocked_on_id = $1`, [id, to]);
    await tx.query(`UPDATE projects SET owner_id = $2 WHERE owner_id = $1`, [id, to]);
    await tx.query(`UPDATE plan_lines SET owner_id = $2 WHERE owner_id = $1`, [id, to]);
    await tx.query(`DELETE FROM team_members WHERE person_id = $1`, [id]);
    await tx.query(`UPDATE people SET active = false WHERE id = $1`, [id]);
  }
}

// Real projects on a local run (projects.local.json, git-ignored): extra people, task boards and
// plans. Never used by the tests or the public fixtures.
export type LocalProjects = { team_name?: string; people?: Row[]; drop_sample_plan?: boolean; task_projects?: Row[]; plan_projects?: Row[]; reminders?: Row[] };

export function loadLocalProjects(file: string): LocalProjects | undefined {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
}

async function seedLocalProjects(tx: Tx, local: LocalProjects, people: Row[]): Promise<void> {
  if (local.team_name) await tx.query(`UPDATE teams SET name = $2 WHERE id = $1`, [TEAM_ID, local.team_name]);
  const all = [...people];
  for (const p of local.people ?? []) {
    await tx.query(`INSERT INTO people (id, display_name, role, department, email, contact_email, never_remind) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, p.display_name, p.role, p.department, p.email, p.contact_email ?? null, !!p.never_remind]);
    await tx.query(`INSERT INTO team_members VALUES ($1, $2, 'member')`, [TEAM_ID, p.id]);
    for (const r of p.roles ?? []) await tx.query(`INSERT INTO team_members VALUES ($1, $2, $3)`, [TEAM_ID, p.id, r]);
    all.push(p);
  }
  for (const p of local.task_projects ?? []) {
    await tx.query(
      `INSERT INTO projects (id, team_id, name, department, owner_id, status, status_note, status_at, eyebrow, phase, intro, launch_on, pills, workstreams)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)`,
      [p.id, TEAM_ID, p.name, p.department, p.owner_id, p.status, p.status_note ?? null, p.status_at, p.eyebrow ?? null, p.phase ?? null,
        p.intro ?? null, p.launch_on ?? null, j(p.pills ?? []), j(p.workstreams ?? [])],
    );
    for (const t of p.tasks ?? []) {
      // status: not_started | on_track | done | dropped. history: dates moved, oldest first.
      const done = t.status === 'done';
      const dropped = t.status === 'dropped';
      const history: { from: string; to: string; at?: string }[] = t.history ?? [];
      const first = history[0]?.from ?? t.due_on;
      await tx.query(
        `INSERT INTO tasks (id, team_id, title, owner_id, project_id, workstream, first_due_on, due_on, note, health, status, status_category,
           origin, created_by, created_at, closed_at, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'app',$13,$14,$15,$16)`,
        [t.id, TEAM_ID, t.title, t.owner_id, p.id, t.workstream ?? null, first, t.due_on, t.note || null,
          done || dropped ? null : t.status, done ? 'done' : dropped ? 'dropped' : t.status === 'not_started' ? 'todo' : 'doing',
          done ? 'done' : dropped ? 'dropped' : 'open', t.owner_id, t.created_at, done ? t.closed_at : null, t.description ?? null],
      );
      const ev = (n: string, field: string, before: unknown, after: unknown, at: string, reason: string | null = null) =>
        tx.query(`INSERT INTO events (id, entity_type, entity_id, field, before, after, reason, actor_id, origin, at) VALUES ($1,'task',$2,$3,$4::jsonb,$5::jsonb,$6,$7,'app',$8)`,
          [`${t.id}_${n}`, t.id, field, j(before), j(after), reason, t.owner_id, at]);
      await ev('c', '_created', null, { title: t.title, owner_id: t.owner_id, due_on: first }, t.created_at);
      for (const [i, h] of history.entries()) {
        await ev(`m${i}`, 'due_on', h.from, h.to, h.at ?? t.updated_at ?? t.created_at, t.move_reason ?? 'Date moved in the source tracker before import.');
      }
      if (done) await ev('d', 'status_category', 'open', 'done', t.closed_at);
      if (dropped) await ev('x', 'status_category', 'open', 'dropped', t.dropped_at ?? t.created_at, (t.drop_reason ?? 'Removed in the source tracker.').slice(0, 280));
    }
  }
  for (const plan of local.plan_projects ?? []) await seedPlanData(tx, plan, all);
  for (const p of [...(local.task_projects ?? []), ...(local.plan_projects ?? []).map((x) => x.plan_project)]) {
    if (p.target_label) await tx.query(`UPDATE projects SET target_label = $2 WHERE id = $1`, [p.id, p.target_label]);
    for (const m of p.members ?? []) await tx.query(`INSERT INTO project_members VALUES ($1,$2,$3)`, [p.id, m.person_id, m.role]);
  }
  for (const [i, r] of (local.reminders ?? []).entries()) {
    await tx.query(`INSERT INTO reminders (id, team_id, person_id, sent_by, channel, subject, item_count, at) VALUES ($1,$2,$3,$4,'gmail',$5,0,$6)`,
      [`rem_seed_${i}`, TEAM_ID, r.person_id, r.sent_by, r.subject ?? 'Reminder (sent from the source tracker)', r.at]);
  }
}

// Project pages: header details for each project and the partner plan (fixtures/plan.json).
async function seedPlan(tx: Tx, dir: string, people: Row[], skipPlan = false): Promise<void> {
  const file = path.join(dir, 'plan.json');
  if (!fs.existsSync(file)) return;
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  await seedPlanData(tx, skipPlan ? { project_meta: plan.project_meta } : plan, people);
}

async function seedPlanData(tx: Tx, plan: Row, people: Row[]): Promise<void> {
  const name = Object.fromEntries(people.map((p) => [p.id, p.display_name as string]));
  // Free-text owner fields may name a roster id, so the overlay's names flow through.
  const names = (s: string | null | undefined) => (s ?? '').replace(/per_[a-z]+/g, (id) => name[id] ?? id);

  for (const [id, m] of Object.entries<Row>(plan.project_meta ?? {})) {
    await tx.query(
      `UPDATE projects SET eyebrow = $2, phase = $3, launch_on = $4, pills = $5::jsonb, intro = $6 WHERE id = $1`,
      [id, m.eyebrow ?? null, m.phase ?? null, m.launch_on ?? null, j(m.pills ?? []), m.intro ?? null],
    );
  }

  const p = plan.plan_project;
  if (!p) return;
  await tx.query(
    `INSERT INTO projects (id, team_id, name, department, owner_id, status, status_note, status_at, kind, eyebrow, phase, intro,
       launch_on, pills, pillars, partner_name, partner_people, cadence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'plan',$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16::jsonb,$17::jsonb)`,
    [p.id, TEAM_ID, p.name, p.department, p.owner_id, p.status, p.status_note, p.status_at, p.eyebrow, p.phase, p.intro,
      p.launch_on, j(p.pills), j(p.pillars), p.partner_name, j(p.partner_people), j(p.cadence)],
  );
  const at = p.status_at;
  const lines = [...(plan.lines ?? []), ...(plan.removed_lines ?? []).map((l: Row) => ({ ...l, removed: true }))];
  for (const l of lines) {
    await tx.query(
      `INSERT INTO plan_lines (id, project_id, num, pillar, what, done_def, note, owner_id, owner_with, partner, partner_role, mode,
         due_on, orig_due_on, push_count, by_label, status, completed_on, removed, removed_by, removed_at, remove_reason, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$23)`,
      [l.id, p.id, l.num, l.pillar, l.what, l.done_def ?? '', l.note ?? '', l.owner_id ?? null, names(l.owner_with), l.partner ?? '',
        l.partner_role ?? '', l.mode ?? 'coaching', l.due_on ?? null, l.orig_due_on ?? null, l.push_count ?? 0, l.by_label ?? '',
        l.status ?? 'Not started', l.completed_on ?? null, !!l.removed, l.removed_by ?? null, l.removed_at ?? null, l.remove_reason ?? null, at],
    );
    for (const [i, c] of (l.checkpoints ?? []).entries()) {
      await tx.query(
        `INSERT INTO plan_checkpoints (id, line_id, label, due_on, orig_due_on, push_count, done, done_on, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [c.id, l.id, c.label, c.due_on ?? null, c.orig_due_on ?? null, c.push_count ?? 0, !!c.done, c.done_on ?? null, i],
      );
    }
  }
  for (const [i, a] of (plan.asks ?? []).entries()) {
    await tx.query(
      `INSERT INTO plan_asks (id, project_id, short, text, owner_name, due_on, checkpoints, done, done_on, position) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [a.id, p.id, a.short, a.text, names(a.owner_name), a.due_on ?? null, j(a.checkpoints ?? []), !!a.done, a.done_on ?? null, i],
    );
  }
  for (const [i, text] of (plan.parked ?? []).entries()) {
    await tx.query(`INSERT INTO plan_parked (id, project_id, text, position) VALUES ($1,$2,$3,$4)`, [`${p.id}_pk_${i + 1}`, p.id, text, i]);
  }
  for (const a of plan.actions ?? []) {
    await tx.query(
      `INSERT INTO plan_actions (id, project_id, line_id, owner_name, owner_with, task, due_on, source, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      [a.id, p.id, a.line_id ?? null, names(a.owner_name), names(a.owner_with), a.task, a.due_on ?? null, j(a.source ?? {}), p.owner_id, at],
    );
  }
  for (const [i, a] of (plan.activity ?? []).entries()) {
    await tx.query(`INSERT INTO plan_activity (id, project_id, actor_id, summary, at) VALUES ($1,$2,$3,$4,$5)`,
      [`${p.id}_pa_${i + 1}`, p.id, a.actor_id ?? null, a.summary, a.at]);
  }
}
