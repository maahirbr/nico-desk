import type { Db, Tx } from './db';
import { bad, forbidden, notFound } from './errors';
import { createTask, newId } from './service';
import { today as todayIst } from './time';
import {
  lineLate, needsWhy, nextStepsOf, plainParse, stampRel,
  type Checkpoint, type ParsedStep, type PlanAction, type PlanAsk, type PlanLine, type Proposal,
} from './planUtil';

// Project pages. Every project has a header (eyebrow, phase, launch countdown, pills). A 'tasks'
// project shows its tasks as a board; a 'plan' project shows lines of work with checkpoints,
// a partner's asks and actions from meetings. Every change to a plan is logged in plan_activity.


export type Pill = { label: string; value: string };
export type Cadence = { day?: string; time?: string; what?: string; detail?: string; until?: string };

export type Project = {
  id: string; teamId: string; name: string; department: string; ownerId: string;
  status: 'on_track' | 'at_risk' | 'off_track'; statusNote: string | null;
  kind: 'tasks' | 'plan'; eyebrow: string | null; phase: string | null; intro: string | null; launchOn: string | null;
  pills: Pill[]; pillars: { key: string; label: string }[]; partnerName: string | null; partnerPeople: string[]; cadence: Cadence[];
  workstreams: string[]; targetLabel: string | null; createdBy: string | null;
};

type ProjectRow = {
  id: string; team_id: string; name: string; department: string; owner_id: string; status: Project['status']; status_note: string | null;
  kind: Project['kind']; eyebrow: string | null; phase: string | null; intro: string | null; launch_on: string | null;
  pills: Pill[]; pillars: Project['pillars']; partner_name: string | null; partner_people: string[]; cadence: Cadence[];
  workstreams: string[]; target_label: string | null; created_by: string | null;
};

const toProject = (r: ProjectRow): Project => ({
  id: r.id, teamId: r.team_id, name: r.name, department: r.department, ownerId: r.owner_id, status: r.status, statusNote: r.status_note,
  kind: r.kind, eyebrow: r.eyebrow, phase: r.phase, intro: r.intro, launchOn: r.launch_on, pills: r.pills ?? [],
  pillars: r.pillars ?? [], partnerName: r.partner_name, partnerPeople: r.partner_people ?? [], cadence: r.cadence ?? [],
  workstreams: r.workstreams ?? [], targetLabel: r.target_label, createdBy: r.created_by,
});

export async function teamProjects(db: Tx, teamId: string): Promise<Project[]> {
  const { rows } = await db.query<ProjectRow>(`SELECT * FROM projects WHERE team_id = $1 ORDER BY kind DESC, name`, [teamId]);
  return rows.map(toProject);
}

export async function getProject(db: Tx, id: string): Promise<Project> {
  const { rows } = await db.query<ProjectRow>(`SELECT * FROM projects WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('No such project.');
  return toProject(rows[0]);
}

// ---------- reading a plan ----------

type LineRow = Record<string, any>;

function toLine(r: LineRow, cps: Checkpoint[]): PlanLine {
  return {
    id: r.id, num: r.num, pillar: r.pillar, what: r.what, doneDef: r.done_def, note: r.note, ownerId: r.owner_id, ownerWith: r.owner_with,
    partner: r.partner, partnerRole: r.partner_role, mode: r.mode, dueOn: r.due_on, origDueOn: r.orig_due_on, pushCount: r.push_count,
    byLabel: r.by_label, status: r.status, completedOn: r.completed_on, removed: r.removed, removedBy: r.removed_by, removedAt: r.removed_at,
    removeReason: r.remove_reason, lastDateBy: r.last_date_by, lastDateAt: r.last_date_at, updatedAt: r.updated_at, checkpoints: cps,
  };
}

const toCp = (c: LineRow): Checkpoint => ({
  id: c.id, label: c.label, dueOn: c.due_on, origDueOn: c.orig_due_on, pushCount: c.push_count, done: c.done, doneOn: c.done_on,
});

export type PlanState = {
  lines: PlanLine[]; removed: PlanLine[]; actions: PlanAction[]; asks: PlanAsk[]; parked: string[];
  proposals: Proposal[]; activity: { id: string; at: string; actorName: string | null; summary: string }[];
};

export async function planState(db: Tx, projectId: string): Promise<PlanState> {
  const [lines, cps, actions, asks, parked, props, activity] = await Promise.all([
    db.query<LineRow>(`SELECT * FROM plan_lines WHERE project_id = $1 ORDER BY num`, [projectId]),
    db.query<LineRow>(`SELECT c.* FROM plan_checkpoints c JOIN plan_lines l ON l.id = c.line_id WHERE l.project_id = $1 ORDER BY c.position`, [projectId]),
    db.query<LineRow>(`SELECT * FROM plan_actions WHERE project_id = $1 ORDER BY done, due_on NULLS LAST, created_at`, [projectId]),
    db.query<LineRow>(`SELECT * FROM plan_asks WHERE project_id = $1 ORDER BY position`, [projectId]),
    db.query<LineRow>(`SELECT text FROM plan_parked WHERE project_id = $1 ORDER BY position`, [projectId]),
    db.query<LineRow>(`SELECT * FROM plan_proposals WHERE project_id = $1 AND status = 'pending' ORDER BY created_at, position`, [projectId]),
    db.query<LineRow>(
      `SELECT a.id, a.at, a.summary, p.display_name AS actor FROM plan_activity a LEFT JOIN people p ON p.id = a.actor_id
       WHERE a.project_id = $1 ORDER BY a.at DESC, a.id DESC LIMIT 40`, [projectId]),
  ]);
  const byLine = new Map<string, Checkpoint[]>();
  for (const c of cps.rows) byLine.set(c.line_id, [...(byLine.get(c.line_id) ?? []), toCp(c)]);
  const all = lines.rows.map((r) => toLine(r, byLine.get(r.id) ?? []));
  return {
    lines: all.filter((l) => !l.removed),
    removed: all.filter((l) => l.removed),
    actions: actions.rows.map((a) => ({
      id: a.id, lineId: a.line_id, ownerName: a.owner_name, ownerWith: a.owner_with, task: a.task, dueOn: a.due_on,
      done: a.done, doneOn: a.done_on, source: a.source ?? {},
    })),
    asks: asks.rows.map((a) => ({
      id: a.id, short: a.short, text: a.text, ownerName: a.owner_name, dueOn: a.due_on, checkpoints: a.checkpoints ?? [], done: a.done, doneOn: a.done_on,
    })),
    parked: parked.rows.map((p) => p.text),
    proposals: props.rows.map(toProposal),
    activity: activity.rows.map((a) => ({ id: a.id, at: a.at, actorName: a.actor, summary: a.summary })),
  };
}

const toProposal = (p: LineRow): Proposal => ({
  id: p.id, batch: p.batch, position: p.position, meeting: p.meeting, ownerName: p.owner_name, ownerWith: p.owner_with, task: p.task,
  dueOn: p.due_on, lineId: p.line_id, ownerId: p.owner_id, workstream: p.workstream, confidence: p.confidence, alt: p.alt ?? [], why: p.why,
});

// Pending proposals from meeting minutes, for any project.
export async function pendingProposals(db: Tx, projectId: string): Promise<Proposal[]> {
  const { rows } = await db.query<LineRow>(
    `SELECT * FROM plan_proposals WHERE project_id = $1 AND status = 'pending' ORDER BY created_at, position`, [projectId]);
  return rows.map(toProposal);
}

// Counts for the projects list.
export async function projectCounts(db: Tx, teamId: string, today = todayIst()) {
  const { rows: t } = await db.query<{ project_id: string; open: number; overdue: number; done: number }>(
    `SELECT project_id, count(*) FILTER (WHERE status_category = 'open')::int AS open,
            count(*) FILTER (WHERE status_category = 'open' AND due_on < $2)::int AS overdue,
            count(*) FILTER (WHERE status_category = 'done')::int AS done
     FROM tasks WHERE team_id = $1 AND project_id IS NOT NULL GROUP BY project_id`, [teamId, today]);
  const out: Record<string, { open: number; overdue: number; done: number }> = {};
  for (const r of t) out[r.project_id] = { open: r.open, overdue: r.overdue, done: r.done };
  const plans = (await teamProjects(db, teamId)).filter((p) => p.kind === 'plan');
  for (const p of plans) {
    const s = await planState(db, p.id);
    out[p.id] = {
      open: s.lines.filter((l) => l.status !== 'Done').length,
      overdue: s.lines.filter((l) => lineLate(l, today)).length,
      done: s.lines.filter((l) => l.status === 'Done').length,
    };
  }
  return out;
}

// ---------- writing a plan ----------

const FIX_WINDOW_MS = 10 * 60 * 1000;
const fmt = (d: string) => {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d.slice(8, 10))} ${M[Number(d.slice(5, 7)) - 1]}`;
};
const ref = (l: { num: number; what: string }) => `line ${l.num} (${l.what})`;
const clip = (t: string) => (t.length > 60 ? `${t.slice(0, 59)}…` : t);

async function log(tx: Tx, projectId: string, meId: string, summary: string) {
  await tx.query(`INSERT INTO plan_activity (id, project_id, actor_id, summary, at) VALUES ($1,$2,$3,$4,now())`,
    [newId('pa'), projectId, meId, summary]);
}

async function lineFor(tx: Tx, projectId: string, lineId: string): Promise<PlanLine> {
  const { rows } = await tx.query<LineRow>(`SELECT * FROM plan_lines WHERE id = $1 AND project_id = $2 FOR UPDATE`, [lineId, projectId]);
  if (!rows[0]) throw notFound('No such line on this plan.');
  const { rows: cps } = await tx.query<LineRow>(`SELECT * FROM plan_checkpoints WHERE line_id = $1 ORDER BY position`, [lineId]);
  return toLine(rows[0], cps.map(toCp));
}

function completion(line: PlanLine, status: PlanLine['status'], today: string): string | null {
  if (status === 'Done') return line.status === 'Done' ? line.completedOn : today;
  return null;
}

export type PlanOp =
  | { op: 'status'; lineId: string; status: PlanLine['status']; reason?: string }
  | { op: 'tickCheckpoint'; lineId: string; cpId: string; done: boolean }
  | {
      op: 'editLine'; lineId: string; what: string; doneDef: string; note: string; ownerId: string | null; ownerWith: string;
      partner: string; partnerRole: string; mode: 'coaching' | 'hands-on'; dueOn: string | null; byLabel: string;
      checkpoints: { id?: string; label: string; dueOn: string | null }[]; dateReason?: string;
    }
  | { op: 'removeLine'; lineId: string; reason: string }
  | { op: 'restoreLine'; lineId: string }
  | { op: 'addLine'; pillar: string; what: string; doneDef: string; ownerId: string | null; partner: string; partnerRole: string; dueOn: string | null }
  | { op: 'tickAsk'; askId: string; done: boolean }
  | { op: 'tickAction'; actionId: string; done: boolean }
  | { op: 'removeAction'; actionId: string }
  | { op: 'importMinutes'; title: string; date: string; text: string; source?: { provider: string; id: string; link?: string | null } }
  | { op: 'acceptProposal'; proposalId: string; lineId: string | null; task?: string; ownerName?: string; ownerWith?: string; dueOn?: string | null; ownerId?: string | null; workstream?: string | null }
  | { op: 'rejectProposal'; proposalId: string }
  | { op: 'acceptSure'; batch: string }
  | { op: 'dismissBatch'; batch: string };

const MINUTES_OPS = new Set(['importMinutes', 'acceptProposal', 'rejectProposal', 'acceptSure', 'dismissBatch']);

export async function planOp(db: Db, meId: string, projectId: string, o: PlanOp, today = todayIst()): Promise<{ note?: string }> {
  const project = await getProject(db, projectId);
  if (project.kind !== 'plan' && !MINUTES_OPS.has(o.op)) throw bad('not_a_plan', 'This project has no plan board.');
  // On a task board, an accepted step becomes a task, with all the task rules (owner, a date kept for good).
  if (project.kind === 'tasks' && (o.op === 'acceptProposal' || o.op === 'acceptSure')) return acceptAsTasks(db, meId, project, o);
  // Minutes are read before the transaction, since reading them may call a model.
  const parsed = o.op === 'importMinutes' ? await readMinutes(db, projectId, o) : null;
  return db.transaction(async (tx) => {
    const names = await peopleNames(tx);
    switch (o.op) {
      case 'status': {
        const l = await lineFor(tx, projectId, o.lineId);
        if (o.status === l.status) return {};
        let note = l.note;
        // Blocked, going back to not started, and reopening say why. Starting or finishing is one click.
        const why = (o.reason ?? '').trim();
        if (needsWhy(l.status, o.status) && (why.length < 10 || why.length > 280))
          throw bad('reason_required', o.status === 'Blocked' ? 'Say what is blocking it (10 to 280 characters).' : 'Say why the status changed (10 to 280 characters).', 'reason');
        let summary = `set ${ref(l)} to ${o.status}${why ? `: ${why}` : ''}`;
        if (o.status === 'Blocked') note = `Blocked: ${why}`.slice(0, 160);
        else if (l.status === 'Blocked' && note.startsWith('Blocked: ')) note = '';
        const done = completion(l, o.status, today);
        if (o.status === 'Done') {
          const r = stampRel(today, targetOf(l));
          summary = `marked ${ref(l)} done${r.rel ? ` (${r.rel})` : ''}${why ? `: ${why}` : ''}`;
        } else if (l.status === 'Done') summary = `reopened ${ref(l)}: ${why}`;
        await tx.query(`UPDATE plan_lines SET status = $2, completed_on = $3, note = $4, updated_at = now() WHERE id = $1`, [l.id, o.status, done, note]);
        await log(tx, projectId, meId, summary);
        return {};
      }
      case 'tickCheckpoint': {
        const l = await lineFor(tx, projectId, o.lineId);
        const c = l.checkpoints.find((x) => x.id === o.cpId);
        if (!c) throw notFound('No such checkpoint.');
        await tx.query(`UPDATE plan_checkpoints SET done = $2, done_on = $3 WHERE id = $1`, [c.id, o.done, o.done ? today : null]);
        await tx.query(`UPDATE plan_lines SET updated_at = now() WHERE id = $1`, [l.id]);
        const r = o.done ? stampRel(today, c.origDueOn ?? c.dueOn) : { rel: '' };
        await log(tx, projectId, meId, `${o.done ? 'ticked' : 'unticked'} “${c.label}” on ${ref(l)}${r.rel ? ` (${r.rel})` : ''}`);
        return {};
      }
      case 'editLine': {
        const l = await lineFor(tx, projectId, o.lineId);
        if (o.what.trim().length < 2) throw bad('invalid_body', 'Say what the line is.', 'what');
        if (o.ownerId && !names[o.ownerId]) throw bad('owner_not_on_roster', 'That person is not on the roster.', 'ownerId');
        // Fixing your own date within 10 minutes is a correction, not a push.
        const correcting = l.lastDateBy === meId && !!l.lastDateAt && Date.now() - Date.parse(l.lastDateAt) < FIX_WINDOW_MS;
        const dateLog: string[] = [];
        let moved = false;
        let pushed = false;
        const move = (label: string, from: string | null, to: string | null): boolean => {
          if ((from ?? '') === (to ?? '')) return false;
          moved = true;
          if (!from) dateLog.push(`set “${label}” to ${fmt(to!)}`);
          else if (!to) dateLog.push(`cleared the date on “${label}”`);
          else dateLog.push(`${to > from ? 'pushed' : 'pulled forward'} “${label}”, ${fmt(from)} → ${fmt(to)}`);
          const isPush = !!(from && to && to > from && !correcting);
          pushed ||= isPush;
          return isPush;
        };
        let lineOrig = l.origDueOn;
        let linePush = l.pushCount;
        if (move('due date', l.dueOn, o.dueOn)) { lineOrig = l.origDueOn ?? l.dueOn; linePush += 1; }
        const keep = new Set<string>();
        const cpWrites: [string, string, string | null, string | null, number, boolean, string | null, number][] = [];
        o.checkpoints.filter((c) => c.label.trim() || c.dueOn).forEach((c, i) => {
          const old = c.id ? l.checkpoints.find((x) => x.id === c.id) : undefined;
          const id = old?.id ?? newId('cp');
          keep.add(id);
          let orig = old?.origDueOn ?? null;
          let pc = old?.pushCount ?? 0;
          if (old && move(c.label.trim() || 'checkpoint', old.dueOn, c.dueOn)) { orig = old.origDueOn ?? old.dueOn; pc += 1; }
          if (!old && c.dueOn) { moved = true; dateLog.push(`added checkpoint “${c.label.trim()}” for ${fmt(c.dueOn)}`); }
          cpWrites.push([id, c.label.trim() || 'Checkpoint', c.dueOn, orig, pc, old?.done ?? false, old?.doneOn ?? null, i]);
        });
        const dropped = l.checkpoints.filter((c) => !keep.has(c.id));
        for (const c of dropped) dateLog.push(`removed checkpoint “${c.label}”`);
        // nico-desk's rule: a date moved later is renegotiated openly, with a reason.
        const why = (o.dateReason ?? '').trim();
        if (pushed && why.length < 10) throw bad('reason_required', 'A date moved later needs a reason of at least 10 characters.', 'dateReason');

        await tx.query(
          `UPDATE plan_lines SET what=$2, done_def=$3, note=$4, owner_id=$5, owner_with=$6, partner=$7, partner_role=$8, mode=$9,
             due_on=$10, orig_due_on=$11, push_count=$12, by_label=$13, updated_at=now(),
             last_date_by = CASE WHEN $14 THEN $15 ELSE last_date_by END, last_date_at = CASE WHEN $14 THEN now() ELSE last_date_at END
           WHERE id=$1`,
          [l.id, o.what.trim(), o.doneDef.trim(), o.note.trim().slice(0, 160), o.ownerId, o.ownerWith.trim(), o.partner, o.partnerRole.trim(),
            o.mode, o.dueOn, lineOrig, linePush, o.byLabel.trim(), moved, meId],
        );
        if (dropped.length) await tx.query(`DELETE FROM plan_checkpoints WHERE id = ANY($1)`, [dropped.map((c) => c.id)]);
        for (const w of cpWrites) {
          await tx.query(
            `INSERT INTO plan_checkpoints (id, line_id, label, due_on, orig_due_on, push_count, done, done_on, position)
             VALUES ($1,$9,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET label=$2, due_on=$3, orig_due_on=$4, push_count=$5, position=$8`,
            [...w, l.id],
          );
        }
        const changes: string[] = [];
        if ((l.ownerId ?? '') !== (o.ownerId ?? '')) changes.push(`owner ${names[l.ownerId ?? ''] ?? 'pending'} → ${names[o.ownerId ?? ''] ?? 'pending'}`);
        if (l.partner !== o.partner) changes.push(`${project.partnerName ?? 'partner'} ${l.partner || 'pending'} → ${o.partner || 'pending'}`);
        if (!correcting) changes.push(...dateLog);
        await log(tx, projectId, meId, `edited ${ref(l)}${changes.length ? `: ${changes.join('; ')}` : ''}${pushed ? `. Reason: ${why}` : ''}`);
        return {};
      }
      case 'removeLine': {
        const l = await lineFor(tx, projectId, o.lineId);
        const why = o.reason.trim();
        if (why.length < 4) throw bad('reason_required', 'Say why the line is being removed.', 'reason');
        await tx.query(`UPDATE plan_lines SET removed = true, removed_by = $2, removed_at = now(), remove_reason = $3, updated_at = now() WHERE id = $1`, [l.id, meId, why]);
        await log(tx, projectId, meId, `removed ${ref(l)}: ${why}`);
        return {};
      }
      case 'restoreLine': {
        const l = await lineFor(tx, projectId, o.lineId);
        await tx.query(`UPDATE plan_lines SET removed = false, removed_by = NULL, removed_at = NULL, remove_reason = NULL, updated_at = now() WHERE id = $1`, [l.id]);
        await log(tx, projectId, meId, `restored ${ref(l)}`);
        return {};
      }
      case 'addLine': {
        if (!project.pillars.some((p) => p.key === o.pillar)) throw bad('invalid_body', 'Pick a pillar.', 'pillar');
        if (o.what.trim().length < 2) throw bad('invalid_body', 'Say what the line is.', 'what');
        const { rows } = await tx.query<{ n: number }>(`SELECT coalesce(max(num), 0)::int + 1 AS n FROM plan_lines WHERE project_id = $1`, [projectId]);
        const num = rows[0].n;
        await tx.query(
          `INSERT INTO plan_lines (id, project_id, num, pillar, what, done_def, owner_id, partner, partner_role, due_on, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())`,
          [newId('ln'), projectId, num, o.pillar, o.what.trim(), o.doneDef.trim(), o.ownerId, o.partner, o.partnerRole.trim(), o.dueOn],
        );
        await log(tx, projectId, meId, `added line ${num} (${o.what.trim()})`);
        return {};
      }
      case 'tickAsk': {
        const { rows } = await tx.query<LineRow>(`UPDATE plan_asks SET done = $3, done_on = $4 WHERE id = $1 AND project_id = $2 RETURNING short, text`,
          [o.askId, projectId, o.done, o.done ? today : null]);
        if (!rows[0]) throw notFound('No such ask.');
        await log(tx, projectId, meId, `${o.done ? 'ticked' : 'reopened'} ask: ${rows[0].short || rows[0].text}`);
        return {};
      }
      case 'tickAction': {
        const { rows } = await tx.query<LineRow>(`UPDATE plan_actions SET done = $3, done_on = $4 WHERE id = $1 AND project_id = $2 RETURNING task, due_on`,
          [o.actionId, projectId, o.done, o.done ? today : null]);
        if (!rows[0]) throw notFound('No such action.');
        const r = o.done ? stampRel(today, rows[0].due_on) : { rel: '' };
        await log(tx, projectId, meId, `${o.done ? 'ticked' : 'reopened'} action “${clip(rows[0].task)}”${r.rel ? ` (${r.rel})` : ''}`);
        return {};
      }
      case 'removeAction': {
        const { rows } = await tx.query<LineRow>(`DELETE FROM plan_actions WHERE id = $1 AND project_id = $2 RETURNING task`, [o.actionId, projectId]);
        if (!rows[0]) throw notFound('No such action.');
        await log(tx, projectId, meId, `removed action “${clip(rows[0].task)}”`);
        return {};
      }
      case 'importMinutes': {
        const { steps, usedModel } = parsed!;
        if (!steps.length) throw bad('no_steps', 'No next steps or action items found in these minutes.', 'text');
        if (o.source) {
          const { rows: seen } = await tx.query(`SELECT 1 FROM plan_proposals WHERE project_id = $1 AND meeting->>'sourceId' = $2 LIMIT 1`, [projectId, o.source.id]);
          if (seen.length) throw bad('already_imported', 'This meeting was already imported into this project.');
        }
        if (project.kind === 'tasks') return importAsTaskProposals(tx, project, meId, o, steps);
        const { rows: ls } = await tx.query<LineRow>(`SELECT id, num FROM plan_lines WHERE project_id = $1 AND NOT removed`, [projectId]);
        const byNum = new Map(ls.map((l) => [l.num as number, l.id as string]));
        const batch = newId('mb');
        const meeting = meetingOf(o);
        for (const [i, s] of steps.entries()) {
          const lineId = s.line != null ? byNum.get(s.line) ?? null : null;
          await tx.query(
            `INSERT INTO plan_proposals (id, project_id, batch, position, meeting, owner_name, owner_with, task, due_on, line_id, confidence, alt, why, created_by, created_at)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,now())`,
            [newId('pp'), projectId, batch, i, JSON.stringify(meeting), canon(s.owner, project), s.with.map((w) => canon(w, project)).join(', '),
              s.task.trim(), /^\d{4}-\d{2}-\d{2}$/.test(s.due) ? s.due : null, lineId, lineId && s.confidence === 'sure' ? 'sure' : 'unsure',
              JSON.stringify(s.alt.map((n) => byNum.get(n)).filter(Boolean)), s.why.slice(0, 120), meId],
          );
        }
        await log(tx, projectId, meId, `imported ${steps.length} next steps from “${meeting.title}” (${fmt(o.date)}) for review`);
        return { note: usedModel ? `${steps.length} proposals to review.` : `${steps.length} proposals to review. Read line by line; pick the line for each.` };
      }
      case 'acceptProposal':
        await accept(tx, projectId, meId, o.proposalId, o);
        return {};
      case 'rejectProposal':
        await decide(tx, projectId, meId, [o.proposalId], 'rejected');
        return {};
      case 'acceptSure': {
        const { rows } = await tx.query<LineRow>(
          `SELECT id FROM plan_proposals WHERE project_id = $1 AND batch = $2 AND status = 'pending' AND confidence = 'sure' AND line_id IS NOT NULL ORDER BY position`,
          [projectId, o.batch]);
        for (const r of rows) await accept(tx, projectId, meId, r.id, {});
        return {};
      }
      case 'dismissBatch': {
        const { rows } = await tx.query<LineRow>(`SELECT id FROM plan_proposals WHERE project_id = $1 AND batch = $2 AND status = 'pending'`, [projectId, o.batch]);
        await decide(tx, projectId, meId, rows.map((r) => r.id), 'rejected');
        if (rows.length) await log(tx, projectId, meId, `dismissed ${rows.length} proposed actions`);
        return {};
      }
    }
  });
}

// ---------- minutes on a task board ----------

function meetingOf(o: { title: string; date: string; source?: { provider: string; id: string; link?: string | null } }) {
  return {
    title: o.title.trim() || 'Pasted minutes', date: o.date,
    ...(o.source ? { source: o.source.provider, sourceId: o.source.id, link: o.source.link ?? undefined } : {}),
  };
}

async function importAsTaskProposals(tx: Tx, project: Project, meId: string, o: { title: string; date: string; source?: { provider: string; id: string; link?: string | null } }, steps: ParsedStep[]) {
  const { rows: ppl } = await tx.query<{ id: string; display_name: string }>(
    `SELECT p.id, p.display_name FROM people p JOIN team_members m ON m.person_id = p.id AND m.team_id = $1 WHERE p.active GROUP BY p.id`,
    [project.teamId]);
  const match = (n: string) => {
    const k = n.trim().toLowerCase();
    if (!k) return null;
    return ppl.find((p) => p.display_name.toLowerCase() === k)
      ?? ppl.find((p) => p.display_name.toLowerCase().split(' ')[0] === k.split(' ')[0]) ?? null;
  };
  const batch = newId('mb');
  const meeting = meetingOf(o);
  for (const [i, s] of steps.entries()) {
    const who = match(s.owner);
    const words = new Set(s.task.toLowerCase().match(/[a-z]{3,}/g) ?? []);
    const ws = project.workstreams.find((w) => (w.toLowerCase().match(/[a-z]{3,}/g) ?? []).some((x) => words.has(x))) ?? null;
    const due = /^\d{4}-\d{2}-\d{2}$/.test(s.due) ? s.due : null;
    await tx.query(
      `INSERT INTO plan_proposals (id, project_id, batch, position, meeting, owner_name, owner_with, task, due_on, owner_id, workstream, confidence, why, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,'',$13,now())`,
      [newId('pp'), project.id, batch, i, JSON.stringify(meeting), who?.display_name ?? s.owner, s.with.join(', '), s.task.trim(), due,
        who?.id ?? null, ws, who && due ? 'sure' : 'unsure', meId],
    );
  }
  return { note: `${steps.length} proposed tasks to review. Each needs an owner on the roster and a date before it can be accepted.` };
}

async function acceptAsTasks(db: Db, meId: string, project: Project, o: PlanOp): Promise<{ note?: string }> {
  const ids: string[] = [];
  if (o.op === 'acceptProposal') ids.push(o.proposalId);
  else if (o.op === 'acceptSure') {
    const { rows } = await db.query<LineRow>(
      `SELECT id FROM plan_proposals WHERE project_id = $1 AND batch = $2 AND status = 'pending' AND confidence = 'sure' ORDER BY position`,
      [project.id, o.batch]);
    ids.push(...rows.map((r) => r.id));
  }
  for (const id of ids) {
    const { rows } = await db.query<LineRow>(`SELECT * FROM plan_proposals WHERE id = $1 AND project_id = $2 AND status = 'pending'`, [id, project.id]);
    const p = rows[0];
    if (!p) throw notFound('That proposal was already decided.');
    const e = o.op === 'acceptProposal' ? o : {} as Partial<Extract<PlanOp, { op: 'acceptProposal' }>>;
    const ownerId = e.ownerId !== undefined ? e.ownerId : p.owner_id;
    const dueOn = e.dueOn !== undefined ? e.dueOn : p.due_on;
    if (!ownerId) throw bad('owner_required', 'Pick an owner from the roster first (Edit).', 'ownerId');
    if (!dueOn) throw bad('date_required', 'Give it a date first (Edit). The date is kept as the first date.', 'dueOn');
    const title = (e.task ?? p.task).trim();
    await createTask(db, meId, {
      teamId: project.teamId, title: title.length > 200 ? `${title.slice(0, 199)}…` : title, ownerId, dueOn, projectId: project.id,
      workstream: e.workstream !== undefined ? e.workstream : p.workstream,
      note: `From ${p.meeting?.title ?? 'meeting minutes'}, ${fmt(p.meeting?.date ?? todayIst())}`.slice(0, 140),
    });
    await decide(db, project.id, meId, [id], 'accepted');
  }
  return {};
}

function targetOf(l: PlanLine): string | null {
  if (l.dueOn) return l.origDueOn ?? l.dueOn;
  const ds = l.checkpoints.filter((c) => c.dueOn).sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));
  const last = ds.at(-1);
  return last ? last.origDueOn ?? last.dueOn : null;
}

async function peopleNames(tx: Tx): Promise<Record<string, string>> {
  const { rows } = await tx.query<{ id: string; display_name: string }>(`SELECT id, display_name FROM people`);
  return Object.fromEntries(rows.map((r) => [r.id, r.display_name]));
}

// Partner first names are how the plan writes them; full names collapse to that.
function canon(n: string, p: Project): string {
  const k = n.trim();
  const hit = p.partnerPeople.find((x) => k.toLowerCase() === x.toLowerCase() || k.toLowerCase().startsWith(`${x.toLowerCase()} `));
  return hit ?? k;
}

async function decide(tx: Tx, projectId: string, meId: string, ids: string[], status: 'accepted' | 'rejected') {
  if (!ids.length) return;
  await tx.query(`UPDATE plan_proposals SET status = $3, decided_by = $4, decided_at = now() WHERE project_id = $1 AND id = ANY($2) AND status = 'pending'`,
    [projectId, ids, status, meId]);
}

async function accept(tx: Tx, projectId: string, meId: string, proposalId: string,
  edits: { lineId?: string | null; task?: string; ownerName?: string; ownerWith?: string; dueOn?: string | null }) {
  const { rows } = await tx.query<LineRow>(`SELECT * FROM plan_proposals WHERE id = $1 AND project_id = $2 AND status = 'pending' FOR UPDATE`, [proposalId, projectId]);
  const p = rows[0];
  if (!p) throw notFound('That proposal was already decided.');
  const lineId = edits.lineId !== undefined ? edits.lineId : p.line_id;
  const task = (edits.task ?? p.task).trim();
  if (!task) throw bad('invalid_body', 'The action needs a task.', 'task');
  const dueOn = edits.dueOn !== undefined ? edits.dueOn : p.due_on;
  await tx.query(
    `INSERT INTO plan_actions (id, project_id, line_id, owner_name, owner_with, task, due_on, source, proposal_id, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,now())`,
    [newId('act'), projectId, lineId || null, (edits.ownerName ?? p.owner_name).trim(), (edits.ownerWith ?? p.owner_with).trim(), task, dueOn || null,
      JSON.stringify(p.meeting), p.id, meId],
  );
  await decide(tx, projectId, meId, [p.id], 'accepted');
  const { rows: ln } = lineId ? await tx.query<LineRow>(`SELECT num, what FROM plan_lines WHERE id = $1`, [lineId]) : { rows: [] as LineRow[] };
  await log(tx, projectId, meId,
    `added action “${clip(task)}” (${(edits.ownerName ?? p.owner_name) || 'no owner'}) to ${ln[0] ? ref(ln[0] as any) : 'Other actions'} from ${p.meeting?.title ?? 'meeting minutes'}`);
}

// ---------- reading minutes ----------

// With ANTHROPIC_API_KEY set, a model reads the next steps and suggests a line for each.
// Without it, or if the call fails, the plain parser splits them line by line.
async function readMinutes(db: Tx, projectId: string, o: { title: string; date: string; text: string }): Promise<{ steps: ParsedStep[]; usedModel: boolean }> {
  const steps = nextStepsOf(o.text);
  const s = await planState(db, projectId);
  const lines = s.lines.map((l) => ({ num: l.num, what: l.what, doneDef: l.doneDef }));
  if (!steps) return { steps: [], usedModel: false };
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const project = await getProject(db, projectId);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.NICO_MODEL || 'claude-sonnet-5-5',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt(steps, o, lines, project) }],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        const text: string = data?.content?.find((c: any) => c.type === 'text')?.text ?? '';
        const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
        if (Array.isArray(arr)) {
          return {
            usedModel: true,
            steps: arr.map((x: any) => ({
              owner: String(x.owner ?? ''), with: Array.isArray(x.with) ? x.with.map(String) : [], task: String(x.task ?? ''),
              due: String(x.due ?? ''), line: typeof x.line === 'number' ? x.line : null, confidence: (x.confidence === 'sure' ? 'sure' : 'unsure') as ParsedStep['confidence'],
              alt: Array.isArray(x.alt) ? x.alt.filter((n: unknown) => typeof n === 'number') : [], why: String(x.why ?? ''),
            })).filter((x: ParsedStep) => x.task.trim()),
          };
        }
      }
    } catch {
      // fall through to the plain parser
    }
  }
  return { steps: plainParse(steps, o.date, lines), usedModel: false };
}

function prompt(steps: string, m: { title: string; date: string }, lines: { num: number; what: string; doneDef: string }[], p: Project): string {
  return [
    'You turn meeting next steps into proposed action items for a project plan. Reply with ONLY a JSON array.',
    '', `Meeting: ${m.title || 'Meeting'} on ${m.date} (YYYY-MM-DD).`, '', "The plan's lines:",
    ...lines.map((l) => `${l.num}. ${l.what}: ${l.doneDef}`),
    '', 'Rules:',
    '- One object per next step, in order. Do not invent steps or merge them.',
    `- owner: the person named for the step. ${p.partnerPeople.length ? `Write ${p.partnerName ?? 'partner'} people by first name: ${p.partnerPeople.join(', ')}.` : ''} Otherwise keep the name as written, or "".`,
    '- with: other people named as working with the owner (array), else [].',
    '- task: the step as a short, clear action, keeping every concrete detail. No owner name at the start, no date.',
    "- due: YYYY-MM-DD. 'today' is the meeting date, 'tomorrow' the next day. Vague timing gives \"\".",
    '- line: the plan line number this step clearly belongs to, or null.',
    '- confidence: "sure" only when the step is plainly part of that line; else "unsure".',
    '- alt: other line numbers it might belong to (array).',
    '- why: under 12 words on why that line.',
    '', 'Next steps:', steps,
  ].join('\n');
}


// ---------- starting and editing a project ----------

export type Member = { personId: string; role: string };

export async function projectMembers(db: Tx, projectId: string): Promise<Member[]> {
  const { rows } = await db.query<{ person_id: string; project_role: string }>(
    `SELECT m.person_id, m.project_role FROM project_members m JOIN people p ON p.id = m.person_id
     WHERE m.project_id = $1 ORDER BY p.display_name`, [projectId]);
  return rows.map((r) => ({ personId: r.person_id, role: r.project_role }));
}

export type ProjectInput = {
  name: string; kind: 'tasks' | 'plan'; ownerId: string; goal: string; eyebrow?: string; phase?: string;
  launchOn?: string | null; targetLabel?: string; workstreams: string[]; members: Member[];
  partnerName?: string; partnerPeople?: string[];
};

const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (d: string) => `${Number(d.slice(8, 10))} ${LONG[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const slug = (s: string, i: number) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'part') + `_${i + 1}`;

function clean(input: ProjectInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw bad('invalid_body', 'Give the project a name of 2 to 80 characters.', 'name');
  const goal = input.goal.trim();
  if (goal.length < 10) throw bad('invalid_body', 'Say in a sentence what done looks like (at least 10 characters).', 'goal');
  const ws = [...new Set(input.workstreams.map((w) => w.trim()).filter(Boolean))].slice(0, 20);
  if (ws.some((w) => w.length > 60)) throw bad('invalid_body', 'Keep each sub-project name under 60 characters.', 'workstreams');
  if (input.kind === 'plan' && ws.length === 0) throw bad('invalid_body', 'A partner plan needs at least one pillar.', 'workstreams');
  const members = input.members.filter((m) => m.personId && m.personId !== input.ownerId);
  for (const m of members) if (m.role.trim().length < 2) throw bad('invalid_body', 'Give each person on the project a role.', 'members');
  const label = (input.targetLabel ?? '').trim() || (input.kind === 'plan' ? 'End date' : 'Launch');
  const pills = [
    ...(input.launchOn ? [{ label, value: longDate(input.launchOn) }] : []),
    ...(input.phase?.trim() ? [{ label: 'Phase', value: input.phase.trim() }] : []),
  ];
  return { name, goal, ws, members, label, pills };
}

async function checkPeople(tx: Tx, teamId: string, ids: string[]) {
  const { rows } = await tx.query<{ person_id: string }>(
    `SELECT DISTINCT m.person_id FROM team_members m JOIN people p ON p.id = m.person_id WHERE m.team_id = $1 AND p.active AND m.person_id = ANY($2)`,
    [teamId, ids]);
  if (rows.length !== new Set(ids).size) throw bad('owner_not_on_roster', 'Everyone on a project must be an active member of the team.', 'members');
}

async function rolesOf(tx: Tx, teamId: string, personId: string): Promise<Set<string>> {
  const { rows } = await tx.query<{ app_role: string }>(`SELECT app_role FROM team_members WHERE team_id = $1 AND person_id = $2`, [teamId, personId]);
  return new Set(rows.map((r) => r.app_role));
}

export async function createProject(db: Db, meId: string, teamId: string, input: ProjectInput): Promise<Project> {
  const roles = await rolesOf(db, teamId, meId);
  if (!roles.has('lead') && !roles.has('admin')) throw forbidden('Only a lead can start a project.');
  const c = clean(input);
  const id = newId('prj');
  await db.transaction(async (tx) => {
    await checkPeople(tx, teamId, [input.ownerId, ...c.members.map((m) => m.personId)]);
    const { rows } = await tx.query(`SELECT 1 FROM projects WHERE team_id = $1 AND lower(name) = lower($2)`, [teamId, c.name]);
    if (rows.length) throw bad('invalid_body', 'A project with that name already exists.', 'name');
    const { rows: dept } = await tx.query<{ department: string }>(`SELECT department FROM people WHERE id = $1`, [input.ownerId]);
    await tx.query(
      `INSERT INTO projects (id, team_id, name, department, owner_id, status, status_at, kind, eyebrow, phase, intro, launch_on, pills,
         pillars, partner_name, partner_people, workstreams, target_label, created_by)
       VALUES ($1,$2,$3,$4,$5,'on_track',now(),$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14::jsonb,$15::jsonb,$16,$17)`,
      [id, teamId, c.name, dept[0]?.department ?? 'Team', input.ownerId, input.kind, input.eyebrow?.trim() || null, input.phase?.trim() || null, c.goal,
        input.launchOn || null, JSON.stringify(c.pills), JSON.stringify(input.kind === 'plan' ? c.ws.map((w, i) => ({ key: slug(w, i), label: w })) : []),
        input.kind === 'plan' ? input.partnerName?.trim() || 'Partner' : null,
        JSON.stringify(input.kind === 'plan' ? (input.partnerPeople ?? []).map((x) => x.trim()).filter(Boolean) : []),
        JSON.stringify(input.kind === 'tasks' ? c.ws : []), c.label, meId],
    );
    for (const m of c.members) await tx.query(`INSERT INTO project_members VALUES ($1,$2,$3)`, [id, m.personId, m.role.trim()]);
    await tx.query(`INSERT INTO events (id, entity_type, entity_id, field, after, actor_id, origin, at) VALUES ($1,'project',$2,'_created',$3::jsonb,$4,'app',now())`,
      [newId('evt'), id, JSON.stringify({ name: c.name, kind: input.kind, owner_id: input.ownerId, launch_on: input.launchOn || null }), meId]);
  });
  return getProject(db, id);
}

export async function updateProject(db: Db, meId: string, id: string, input: ProjectInput): Promise<Project> {
  const p = await getProject(db, id);
  const roles = await rolesOf(db, p.teamId, meId);
  if (p.ownerId !== meId && !roles.has('lead') && !roles.has('admin')) throw forbidden('Only the project owner or a lead can change the project.');
  if (input.kind !== p.kind) throw bad('invalid_body', 'A project keeps its board type.', 'kind');
  const c = clean(input);
  await db.transaction(async (tx) => {
    await checkPeople(tx, p.teamId, [input.ownerId, ...c.members.map((m) => m.personId)]);
    const { rows } = await tx.query(`SELECT 1 FROM projects WHERE team_id = $1 AND lower(name) = lower($2) AND id <> $3`, [p.teamId, c.name, id]);
    if (rows.length) throw bad('invalid_body', 'A project with that name already exists.', 'name');
    // Plan pillars keep their keys, so lines stay in their pillar when one is renamed.
    const pillars = p.kind === 'plan' ? c.ws.map((w, i) => p.pillars[i] ? { key: p.pillars[i].key, label: w } : { key: slug(w, i), label: w }) : [];
    if (p.kind === 'plan') {
      const keep = new Set(pillars.map((x) => x.key));
      const { rows: used } = await tx.query<{ pillar: string }>(`SELECT DISTINCT pillar FROM plan_lines WHERE project_id = $1 AND NOT removed`, [id]);
      if (used.some((u) => !keep.has(u.pillar))) throw bad('invalid_body', 'A pillar that still has lines cannot be removed. Move its lines first.', 'workstreams');
    }
    await tx.query(
      `UPDATE projects SET name=$2, owner_id=$3, eyebrow=$4, phase=$5, intro=$6, launch_on=$7, pills=$8::jsonb, pillars=$9::jsonb,
         partner_name=$10, partner_people=$11::jsonb, workstreams=$12::jsonb, target_label=$13 WHERE id=$1`,
      [id, c.name, input.ownerId, input.eyebrow?.trim() || null, input.phase?.trim() || null, c.goal, input.launchOn || null, JSON.stringify(c.pills),
        JSON.stringify(pillars), p.kind === 'plan' ? input.partnerName?.trim() || p.partnerName : null,
        JSON.stringify(p.kind === 'plan' ? (input.partnerPeople ?? []).map((x) => x.trim()).filter(Boolean) : []),
        JSON.stringify(p.kind === 'tasks' ? c.ws : []), c.label],
    );
    await tx.query(`DELETE FROM project_members WHERE project_id = $1`, [id]);
    for (const m of c.members) await tx.query(`INSERT INTO project_members VALUES ($1,$2,$3)`, [id, m.personId, m.role.trim()]);
  });
  return getProject(db, id);
}
