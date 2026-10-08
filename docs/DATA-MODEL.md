# Data model, first slice

Written by a model (Sonnet 5.5) on 8 Oct 2026. Proposed, not decided. Postgres. Matches the first build slice in `docs/RESEARCH-PLAN.md`. Synthetic examples are in `fixtures/`.

## Rules

1. The `events` table is the only history. Current state in `tasks` and `projects` is a copy that can be rebuilt by replaying events.
2. Every write to `tasks` or `projects` inserts its events in the same transaction. One event per changed field.
3. `on_time` is derived, never stored. A task is ON TIME when the date of `closed_at` is on or before the `due_on` that was current at close. It is LATE otherwise. It is OPEN while unclosed and past due.
4. A task has exactly one origin. The app writes only tasks whose origin is `app`. Rows with origin `sheet` or `granola` are mirrors, written only by their reader job, and the app shows them read-only.
5. Sheet rows are read by header name, never by column position. `origin_ref` is the sheet id plus the row key, joined with `#`.
6. Dates and times: `due_on` is a date. Other times are `timestamptz`. A "date" of a time means the date in `Asia/Kolkata`.

## DDL

```sql
CREATE TABLE people (
  id            text PRIMARY KEY,
  display_name  text NOT NULL,
  role          text NOT NULL,
  department    text NOT NULL,
  email         text NOT NULL UNIQUE
);
-- email_domain_check: the allowed sign-in domain lives in server config, not here.
-- The server checks it at sign-in. Fixtures use example.test only.

CREATE TABLE projects (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  department  text NOT NULL,
  owner_id    text NOT NULL REFERENCES people(id),
  status      text NOT NULL CHECK (status IN ('on_track','at_risk','off_track')),
  status_note text,
  status_at   timestamptz NOT NULL   -- time of the last status or note event
);

CREATE TABLE tasks (
  id              text PRIMARY KEY,
  title           text NOT NULL,
  owner_id        text NOT NULL REFERENCES people(id),
  project_id      text REFERENCES projects(id),
  due_on          date NOT NULL,
  status          text NOT NULL,   -- the team's own word: todo, doing, done, dropped
  status_category text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  origin          text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  origin_ref      text,
  created_at      timestamptz NOT NULL,
  closed_at       timestamptz,
  CHECK ((origin = 'app') = (origin_ref IS NULL)),
  CHECK ((status_category = 'done') = (closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX tasks_origin_ref ON tasks (origin, origin_ref) WHERE origin_ref IS NOT NULL;

CREATE TABLE events (
  id          text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('task','project')),
  entity_id   text NOT NULL,
  field       text NOT NULL,      -- a column name, or '_created'
  before      jsonb,
  after       jsonb,
  actor_id    text REFERENCES people(id),  -- NULL for a reader job
  origin      text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  at          timestamptz NOT NULL
);
CREATE INDEX events_entity ON events (entity_type, entity_id, at);

CREATE FUNCTION events_append_only() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'events is append-only'; END $$;
CREATE TRIGGER events_no_change BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();
```

## Notes per table

- `people`: the roster. Owners are matched to it by code, never by the model. Sign-in is not modelled here.
- `projects`: a record with a status and a note, not a roll-up. `status_at` is a stored copy of the latest event time.
- `tasks`: current state. `status` is free text per team. `status_category` is the fixed set the ledger and views use. `closed_at` is set only for `done`. A `dropped` task has no `closed_at` and is not in the ledger.
- `events`: `_created` stores the first row in `after`. Every other event stores one field. A close writes three events: `status`, `status_category` and `closed_at`, all at the same time.

## Example: the on-time ledger, per person per week

`$1` is the as-of date. The week is the Monday of the `due_on` that counted. Tasks not yet due are left out.

```sql
WITH t AS (
  SELECT k.id, k.owner_id, k.closed_at, d.due_on
  FROM tasks k
  CROSS JOIN LATERAL (
    SELECT CASE WHEN k.closed_at IS NULL THEN k.due_on ELSE COALESCE(
      (SELECT (e.after #>> '{}')::date FROM events e
        WHERE e.entity_type = 'task' AND e.entity_id = k.id
          AND e.field = 'due_on' AND e.at <= k.closed_at
        ORDER BY e.at DESC, e.id DESC LIMIT 1),
      (SELECT (e.after ->> 'due_on')::date FROM events e
        WHERE e.entity_type = 'task' AND e.entity_id = k.id AND e.field = '_created')
    ) END AS due_on
  ) d
  WHERE k.status_category <> 'dropped'
), s AS (
  SELECT *, CASE
    WHEN closed_at IS NOT NULL AND (closed_at AT TIME ZONE 'Asia/Kolkata')::date <= due_on THEN 'ON TIME'
    WHEN closed_at IS NOT NULL THEN 'LATE'
    WHEN due_on < $1::date THEN 'OPEN' END AS state
  FROM t
)
SELECT owner_id, date_trunc('week', due_on)::date AS week_start, state, count(*) AS tasks
FROM s WHERE state IS NOT NULL
GROUP BY 1, 2, 3 ORDER BY 2, 1, 3;
```

## What this does not model yet

- Milestones: a dated checkpoint inside a project. Add only if the pilot lead asks by week three.
- Triage drafts: a proposed task, a quote, a named approver and a decision log. Slice two.
- Nudges: a record of what was suggested, to whom, and the yes. Nothing is sent without a yes.
- Sign-in: a user, a session and a role. Slice one has one user.
- Sheet sync state: last read time and header map per sheet.
- Granola link: the meeting id and quote for a task. Now only `origin_ref`.
- Comments, attachments and labels.
- Roll-ups above projects.
- Task dependencies and subtasks.
- Soft delete or merge of duplicate tasks.

## Rules added here, not in the docs

- Creation is one event with field `_created`. A close is three events. Reader jobs write events with `actor_id` NULL.
- Granola tasks are mirrors, like Sheet tasks, because slice one has no approval step.
- The ledger week follows the `due_on` that counted. A time becomes a date in `Asia/Kolkata`.
- A task not yet due is left out of the ledger. Only unclosed and past due counts as OPEN.
