# spec.md: nico-desk

The technical requirements and design for the pilot. Built from `INTENT.md` (v0.2, 8 Oct 2026).
`INTENT.md` says why. This file says what to build and how we check it. If the two disagree,
`INTENT.md` wins and this file is fixed.

| Field | Value |
|---|---|
| Owner | the repo owner |
| Version | 0.1 |
| Last updated | 2026-10-08 |
| Status | Draft, written by a model (Opus 5.5). Not agreed with the sponsor, the founder or a pilot lead |
| Covers | Stage 1 only: one pilot team (`INTENT.md` section 3) |

Words used the same way as in `INTENT.md`: **commitment**, **done**, **openly renegotiated**,
**silent slip**, **lead**, **admin**. People are named by role because the repo is public.
`TBD` means not known. **Default** means what we build unless an open question in `INTENT.md`
section 9 is answered differently. Every default names its open question (OQ).

---

## 1. Overview / Context

### Why

Nicobar's goal for this tool, from `INTENT.md` section 1:

> Every commitment made at Nicobar gets done, or gets openly renegotiated, without anyone having
> to chase it.

Today that fails in four ways. Commitments made in meetings and chats leak before anyone tracks
them. Leads chase people for status before every weekly review. Due dates move quietly, so
nobody can say what closed on time. Tasks are spread across Sheets, notes and WhatsApp, so there
is no single list.

### What we are building

One web page where the pilot team runs its week. Each person sees what is pending at their end.
The lead runs the weekly review from it without chasing. Each task keeps the date first given
for ever, so the tool can say which commitments closed on time, which were openly renegotiated
and which slipped silently.

### Shape of the build

- **Task-first, project-aware.** Every task has the shared core from `INTENT.md` section 3:
  owner, task, due date, status, a one-line note and an update log. A task may belong to a
  project. Team types (Launch, Run, Partner, Pipeline) change views and extras, not the core.
- **The pilot builds the core plus the Run type's view** (my open and overdue, pushed-date
  record, reminders). The pilot team is `TBD` (OQ1, OQ12). The proposed type is Run.
- **History is the source of truth.** Every change is an append-only event. Current state is a
  copy that can be rebuilt from events. The on-time ledger is derived, never stored.
- **People set the facts. The app drafts.** Owner, date, priority and status come from a person.
  Anything a model proposes is a draft until a named person approves it.

### Delivery in two slices

| Slice | Contents | Gates before it starts |
|---|---|---|
| 1 | Core tasks, events, the four views, the ledger, renegotiation, the Red rule, blocked asks, priority, in-app reminders, sign-in, one read-only Sheet | Pilot team named (OQ1). Database account and owner named (OQ8). Sheet read access (only for FR-40 to FR-43) |
| 2 | Granola meeting notes drafted into tasks, the Monday digest, the Friday overdue draft | Slice 1 gates, plus: Granola workspace key (OQ9), model vendor approved for real minutes, the eval passes (section 7.3), the pilot team agrees to receive email, overlap with the tracker owner's emails settled (OQ3) |

### Stack

Chosen to match the OKR page in `~/Code/Nicobar work`, whose UI we must reuse
(`docs/OKR-PAGE-SUMMARY.md`, `docs/AI-AND-TECH.md` section 4).

| Layer | Pick |
|---|---|
| App | Next.js (App Router), TypeScript, server-rendered. Same framework as the OKR page |
| UI | Tokens and atoms from `~/Code/Nicobar work` (`docs/SHEET-SPEC.md`, `web/app/globals.css`, `web/components/ui/`, `web/components/sheet/`). No new visual language |
| Store | Postgres. Shared with the OKR page backend or separate: OQ8. Region `TBD` |
| Validation | Zod schemas at every API boundary |
| Sign-in | Better Auth with Google, company email domain enforced on the server |
| Jobs | Cron calling internal job routes |
| Drafting (slice 2) | Vercel AI SDK `generateText` with structured output, Zod, a Claude model set in server config. The model is picked by the eval in section 7.3 |
| Email (slice 2) | Provider `TBD`. Templates in React Email |
| Tests | Vitest. PGlite for database tests on synthetic fixtures |

---

## 2. Functional Requirements

IDs are stable. Tests in section 7 cite them. "Slice" says when each lands.

### 2.1 Roles

| Role | Who | Can do |
|---|---|---|
| Member | Anyone on the pilot team | Create tasks, update tasks they own, raise and clear blocked asks, see the whole team's tasks |
| Lead | The team's L1 | Everything a member can, plus: set priority, renegotiate any team task's date, close or drop any team task, see the ledger for everyone |
| Admin | The team's coordinator | Everything a member can, plus: review and send the Friday overdue email (slice 2), manage the roster |
| Approver | A named person per meeting source (slice 2) | Approve or reject drafted tasks |

A person can hold more than one role. Leadership across teams is Stage 3 and out of scope.

### 2.2 Tasks: the shared core

- **FR-1** (1) Users must be able to create a task with a title, one owner from the roster, a
  due date, an optional project and an optional one-line note.
- **FR-2** (1) The system must reject a task with no owner or no due date. An owner must be a
  person on the roster. The app never guesses an owner.
- **FR-3** (1) On creation, the system must store the due date twice: as `first_due_on`, which
  never changes, and as `due_on`, the current date. This is how "the date first given is the
  truth" (`INTENT.md` principle 1) is held in the data.
- **FR-4** (1) The one-line note must be at most 140 characters. Each edit to it is an event.
- **FR-5** (1) Users must be able to edit a task's title, note and project. The owner, the
  creator and any lead may do so. Each change writes one event per changed field.
- **FR-6** (1) Owner changes: a lead may reassign a task. A member may reassign only a task they
  own. A reassignment does not change `first_due_on`.
- **FR-7** (1) A task closes as **done** or **dropped**. Done sets `closed_at`. Dropped requires a
  reason and leaves the ledger. The owner and any lead may close or drop. A closed task can be
  reopened by a lead with a reason. Reopening clears `closed_at` and keeps all events.
- **FR-8** (1) Default (OQ-A in section 6): no owner acceptance step. When the creator is not the
  owner, the owner's view marks the task "Assigned by [creator]" until the owner opens it.

### 2.3 Status: health now, outcome at close

`INTENT.md` request 4 asks for six colours. Two of them (Purple, Dark Blue) describe how a task
closed against its date, which the app can work out. So status is split into two facts:

- **Health** is set by a person while the task is open: what is true now.
- **Outcome** is derived by the system at close: did it close by the date first given.

| Fact | Value | Colour | Word shown | Set by |
|---|---|---|---|---|
| Health | `not_started` | Black | Not started | Person |
| Health | `off_track` | Red | Off track | Person, with the FR-12 rule |
| Health | `on_track` | Amber | On track | Person |
| Health | `ahead` | Green | Ahead | Person |
| Outcome | `ahead` | Purple | Closed ahead | System: `closed_on` < `first_due_on` |
| Outcome | `on_time` | Purple (default, OQ4) | Closed on time | System: `closed_on` = `first_due_on` |
| Outcome | `late` | Dark Blue | Closed late | System: `closed_on` > `first_due_on` |
| Flag | `overdue` | Red outline | Overdue | System: open and today > `due_on` |

`closed_on` is the date of `closed_at` in `Asia/Kolkata`. Exact colour values come from the
OKR page tokens. Amber means "on track" here but "at risk" on the OKR page. The default keeps the
founder's meaning and always shows the word (OQ4).

- **FR-9** (1) A new task starts with health `not_started`.
- **FR-10** (1) The owner and any lead may change health. Each change is an event.
- **FR-11** (1) Colour never stands alone. Every place that shows a health, an outcome or the
  overdue flag shows its word too (`INTENT.md` principle 5).
- **FR-12** (1) **The Red rule.** A change to `off_track` must carry, in the same request, a new
  due date and a reason for the delay. The system rejects the change without both. The new date
  must be today or later. This is `INTENT.md` request 6.
- **FR-13** (1) The overdue flag is shown whatever the health, including `not_started`. A task
  can be "Not started" and "Overdue" at once (OQ4 asks whether that needs its own status).

### 2.4 Dates: locked, renegotiated in the open

- **FR-14** (1) `first_due_on` can never be changed through any API, and the database rejects any
  update to it (section 3.3).
- **FR-15** (1) `due_on` changes only through **renegotiate**: a new date plus a reason
  (10 to 280 characters). A plain edit of `due_on` is rejected. Each renegotiation writes one
  `due_on` event carrying the reason.
- **FR-16** (1) Who may renegotiate. Default (OQ5): the owner and any lead, from any health. A
  date entered by mistake is fixed the same way, with a reason such as "entered in error". The
  record stays.
- **FR-17** (1) Each renegotiation is classed by the system as **open** if it was logged on or
  before the `due_on` it replaced, or **late** if logged after that date had passed.
- **FR-18** (1) A **silent slip** happens when a task's `due_on` passes while the task is open
  and no renegotiation was logged on or before that day. An open overdue task is slipping
  silently now. A task renegotiated late, or closed late with no renegotiation, slipped silently
  once, and its history keeps that mark. The system marks both in every view and counts them in
  the ledger. This is the first measure in `INTENT.md` section 4, target 0.
- **FR-19** (1) Every task view shows the first date, the current date and how many times the
  date moved, for example "Due 26 Sep (first given 23 Sep, moved once)".

### 2.5 Update log

- **FR-20** (1) Every task has a log, read from its events, newest first. Each line shows who,
  what changed (before and after), when, and any reason.
- **FR-21** (1) Users must be able to add a short update (at most 280 characters) to a task's
  log without changing any field. Default (OQ7): the log holds both every field change and these
  free updates.
- **FR-22** (1) Log lines cannot be edited or deleted by anyone.

### 2.6 Blocked: ask for support

- **FR-23** (1) The owner must be able to mark a task blocked by naming a person on the roster
  (`blocked_on`) and writing an ask (10 to 280 characters). This is `INTENT.md` request 8.
- **FR-24** (1) Marking a task blocked creates an in-app notice for the named person. The owner's
  click is their yes to send it. Nothing leaves the app (no email, chat or WhatsApp).
- **FR-25** (1) The owner, the named person or a lead may clear the block, with an optional note.
  Raising and clearing are both events.
- **FR-26** (1) A blocked task shows "Blocked on [name]" and the ask in every view. It is not a
  health value. Health stays as the owner set it.

### 2.7 Priority, set by a leader

- **FR-27** (1) Only a lead may set or change a task's priority. Values: `high`, `normal`, `low`
  (default set, OQ6). A task has no priority until a lead sets one. The app never infers it.
- **FR-28** (1) The system stores who set the priority and when, and shows "Priority high, set by
  [lead]". Once set, members cannot change it (`INTENT.md` request 9). Who counts as "the leader"
  for a task, and how priority is agreed, is OQ6. Default: any lead of the task's team.

### 2.8 Views

All views use the Nicobar UI. All dates show in `Asia/Kolkata`. A week runs Monday to Sunday.

- **FR-29** (1) **My tasks.** The signed-in person's open tasks: overdue first, then by `due_on`,
  then priority. Above them: blocks naming this person, and tasks newly assigned to them. This is
  `INTENT.md` request 1.
- **FR-30** (1) **The week.** For the lead's review: one block per person on the team, showing
  each person's tasks due this week plus all their overdue tasks. Each block shows counts: open,
  overdue, silent slips, blocked, closed this week. Defaults to the current week. Users can step
  back and forward a week. This is request 2.
- **FR-31** (1) **By status.** The team's open tasks grouped by health, then a group for tasks
  closed in the selected week grouped by outcome. This is request 3.
- **FR-32** (1) **Task.** All fields, the date line from FR-19, the block, the priority and the
  log. The actions the viewer's role allows.
- **FR-33** (1) **Ledger.** Per person per week: closed ahead, closed on time, closed late, open
  and past due, silent slips, and renegotiations (open and late). Weeks are keyed by the Monday of
  `first_due_on`. The team total is the sum of its people. Section 3.4 gives the query rules.
- **FR-34** (1) Every view can filter by person, project and team type view, and the filter is
  kept in the URL so a lead can share a link.
- **FR-35** (1) Mirrored tasks (from a Sheet) appear in every view with a "From Sheet" marker
  and are read-only (FR-42).

### 2.9 Reminders, in-app only

- **FR-36** (1) Each day at 09:00 `Asia/Kolkata`, the system creates in-app reminders for the
  owner of each open task due tomorrow, due today, or overdue with no renegotiation. One reminder
  per task per day at most.
- **FR-37** (1) A reminder offers the owner three actions: update health, renegotiate, close.
- **FR-38** (1) Reminders go only to the task's owner, inside the app. No reminder is sent to
  anyone else, and none leaves the app in slice 1.
- **FR-39** (1) Users must be able to mark reminders read. Reminders are not events and do not
  enter the ledger.

### 2.10 Sheet read (read-only)

Needs read access to one Sheet, granted by the tracker owner (`docs/RESEARCH-PLAN.md` item 7).
Without it, slice 1 runs on native tasks only.

- **FR-40** (1) An admin registers a Sheet by id, tab name and a header map: which header holds
  title, owner, due date, status and note.
- **FR-41** (1) A job reads the Sheet every 15 minutes, by header name, never by column position.
  A moved column must still read. A missing mapped header stops the read for that Sheet and shows
  an error to the admin. It never guesses.
- **FR-42** (1) Each Sheet row becomes a mirror task with `origin = 'sheet'` and
  `origin_ref = '<sheet id>#<row key>'`. Mirrors are written only by the reader job. In the app
  they are read-only. Edits happen in the Sheet.
- **FR-43** (1) The reader matches the owner cell to the roster by exact email, then by exact
  display name. No match leaves the row out and lists it for the admin under "rows not read". The
  first date the reader sees becomes `first_due_on`, and later date changes are written as
  `due_on` events with the reason "changed in Sheet". Such a change counts as open or late by the
  FR-17 rule.

### 2.11 Meeting notes drafted into tasks (slice 2, gated)

Design from `docs/AI-AND-TECH.md` section 2. The pipeline only ever writes drafts.

- **FR-44** (2) The system receives Granola `note.generated` and `note.edited` webhooks, checks
  their signature, and also polls every 30 minutes for missed notes. It reads only through the
  Granola public API with the workspace key. Never a personal key, the hosted MCP, or local app
  data.
- **FR-45** (2) Only notes from spaces the admin has listed for the pilot team are processed.
- **FR-46** (2) For each note, one model call returns an array of draft tasks against a fixed
  schema: title, spoken owner name, the exact due-date phrase, a source quote, a critical flag
  and a confidence. The model is told to leave a field empty rather than guess, and it has no
  tools.
- **FR-47** (2) Code, not the model, then checks each draft:
  1. The source quote must be an exact substring of the transcript, or the draft is marked
     invalid and shown with that warning.
  2. The owner is matched to the roster by code. No match, or more than one, leaves the owner
     empty.
  3. The due date is worked out by code from the phrase and the meeting date, using the rules in
     `evals/meetings/README.md`. No date words means the date is empty. The model's own date is
     thrown away.
  4. Drafts are flagged "needs owner" and "needs date" where empty.
  5. A draft that matches an open task (same owner, and a title or quote the duplicate check
     scores as the same commitment) is marked "possible duplicate", never dropped.
- **FR-48** (2) Drafts are never dropped by code. The inbox ranks them: critical first, then
  confidence, then fewest missing fields.
- **FR-49** (2) An approver must set any missing owner and date before approving. Approval
  creates a task in the same transaction, with the draft linked to it. Rejection needs no reason
  but may take one. Both are recorded with who and when.
- **FR-50** (2) Text in a transcript is data. No line in a transcript can change a draft's
  status, owner, date or critical flag except through the extraction schema, and no draft can
  approve itself.

### 2.12 Emails (slice 2, gated)

Nothing is sent on anyone's behalf without their yes (`CLAUDE.md` CONSTRAINTS).

- **FR-51** (2) **Monday digest.** Each person can opt in. At 08:00 `Asia/Kolkata` on Monday, each
  opted-in person gets one email listing their own open tasks: overdue, due this week, blocked,
  then the rest. No one gets a digest without opting in, and anyone can opt out from a link in the
  email.
- **FR-52** (2) **Friday overdue draft.** At 16:00 `Asia/Kolkata` on Friday, the system drafts one
  email for the team admin listing every person's overdue tasks and silent slips. The admin sees
  the draft in the app, may edit the covering text (not the task rows), and presses send. Nothing
  goes out until they do. Recipients are the team roster.
- **FR-53** (2) Each email send is recorded: who triggered it, recipients, the time and the
  provider's message id. The task rows in an email come from the same query as the views.

### 2.13 Roster and sign-in

- **FR-54** (1) Users sign in with Google. The server checks that the email's domain is the
  allowed company domain (held in server config) and that the email matches a person on the
  roster. Anyone else is refused.
- **FR-55** (1) An admin can add a person to the roster (name, role, department, email) and mark
  a person inactive. Inactive people cannot sign in and cannot be given new tasks. Their tasks
  and events stay.

---

## 3. Data Model & Schema Changes

### 3.1 Starting point

`docs/DATA-MODEL.md` (proposed 8 Oct) defines `people`, `projects`, `tasks` and an append-only
`events` table, with rules 1 to 6. This spec keeps all of that and changes four things:

| # | Change to `docs/DATA-MODEL.md` | Why |
|---|---|---|
| C1 | On-time is judged against `first_due_on`, not the `due_on` current at close | `INTENT.md` principle 1: "On-time is judged against the first date." `DATA-MODEL.md` rule 3 judges against the date current at close |
| C2 | `events` gains `reason`, required for `due_on` changes after creation, for drops and for reopens | The Red rule and renegotiation need a reason stored with the change |
| C3 | Tasks gain `first_due_on`, `health`, `note`, `priority`, block fields, `team_id`, `version` | FR-3 to FR-28 |
| C4 | Approved Granola drafts become editable app tasks with `origin = 'granola'` | `DATA-MODEL.md` rule 4 made Granola tasks read-only mirrors because slice one had no approval step. With approval (FR-49) the app is their only system of record |

C1 changes which fixture tasks count as late, not the totals. Section 7.2 gives the numbers.

### 3.2 Rules

`DATA-MODEL.md` rules 1, 2, 5 and 6 stand. Rules 3 and 4 change as in C1 and C4. Added:

- R7. `first_due_on` is written once, in the `_created` event, and never updated.
- R8. A write to `tasks` and its events happen in one transaction, and the write checks
  `version` (optimistic concurrency). A stale `version` returns 409 and changes nothing.
- R9. An approved draft, the task it creates and the task's `_created` event are one transaction.
- R10. No table holds a meeting transcript after drafting. Drafts keep only the source quote.
  Retention of quotes is `TBD` (section 4.6).

### 3.3 DDL

New and changed tables. Unchanged columns from `docs/DATA-MODEL.md` are repeated so this block
runs on its own.

```sql
CREATE TABLE teams (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  team_type  text NOT NULL CHECK (team_type IN ('launch','run','partner','pipeline'))
);

CREATE TABLE people (
  id            text PRIMARY KEY,
  display_name  text NOT NULL,
  role          text NOT NULL,          -- job title, free text
  department    text NOT NULL,
  email         text NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true
);

CREATE TABLE team_members (
  team_id    text NOT NULL REFERENCES teams(id),
  person_id  text NOT NULL REFERENCES people(id),
  app_role   text NOT NULL CHECK (app_role IN ('member','lead','admin')),
  PRIMARY KEY (team_id, person_id, app_role)
);

CREATE TABLE projects (
  id          text PRIMARY KEY,
  team_id     text NOT NULL REFERENCES teams(id),
  name        text NOT NULL,
  department  text NOT NULL,
  owner_id    text NOT NULL REFERENCES people(id),
  status      text NOT NULL CHECK (status IN ('on_track','at_risk','off_track')),
  status_note text,
  status_at   timestamptz NOT NULL
);

CREATE TABLE tasks (
  id               text PRIMARY KEY,
  team_id          text NOT NULL REFERENCES teams(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  owner_id         text NOT NULL REFERENCES people(id),
  project_id       text REFERENCES projects(id),
  first_due_on     date NOT NULL,
  due_on           date NOT NULL,
  note             text CHECK (char_length(note) <= 140),
  health           text CHECK (health IN ('not_started','off_track','on_track','ahead')),
  status           text NOT NULL,      -- the source's own word for mirrors; equals status_category for app tasks
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  priority         text CHECK (priority IN ('high','normal','low')),
  priority_set_by  text REFERENCES people(id),
  priority_set_at  timestamptz,
  blocked_on_id    text REFERENCES people(id),
  blocked_ask      text CHECK (char_length(blocked_ask) BETWEEN 10 AND 280),
  blocked_at       timestamptz,
  origin           text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  origin_ref       text,
  created_by       text REFERENCES people(id),   -- NULL for a reader job
  created_at       timestamptz NOT NULL,
  closed_at        timestamptz,
  version          integer NOT NULL DEFAULT 1,
  CHECK ((origin = 'app') = (origin_ref IS NULL)),
  CHECK ((status_category = 'done') = (closed_at IS NOT NULL)),
  CHECK ((priority IS NULL) = (priority_set_by IS NULL)),
  CHECK ((blocked_on_id IS NULL) = (blocked_ask IS NULL)),
  CHECK (origin = 'sheet' OR status_category <> 'open' OR health IS NOT NULL)
);
CREATE UNIQUE INDEX tasks_origin_ref ON tasks (origin, origin_ref) WHERE origin_ref IS NOT NULL;
CREATE INDEX tasks_team_open ON tasks (team_id, owner_id, due_on) WHERE status_category = 'open';

CREATE FUNCTION tasks_first_due_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_due_on <> OLD.first_due_on THEN
    RAISE EXCEPTION 'first_due_on is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_first_due_locked BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_first_due_locked();

CREATE TABLE events (
  id          text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('task','project')),
  entity_id   text NOT NULL,
  field       text NOT NULL,      -- a column name, '_created', '_update' (FR-21) or '_reopened'
  before      jsonb,
  after       jsonb,
  reason      text CHECK (char_length(reason) <= 280),
  actor_id    text REFERENCES people(id),  -- NULL for a reader job
  origin      text NOT NULL CHECK (origin IN ('app','sheet','granola')),
  at          timestamptz NOT NULL,
  CHECK (field NOT IN ('due_on','_reopened') OR reason IS NOT NULL),
  CHECK (field <> 'status_category' OR after <> '"dropped"'::jsonb OR reason IS NOT NULL)
);
CREATE INDEX events_entity ON events (entity_type, entity_id, at);
-- events_append_only trigger as in docs/DATA-MODEL.md

CREATE TABLE notices (              -- in-app only: reminders and blocked asks
  id          text PRIMARY KEY,
  person_id   text NOT NULL REFERENCES people(id),
  task_id     text NOT NULL REFERENCES tasks(id),
  kind        text NOT NULL CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned')),
  for_date    date NOT NULL,        -- Asia/Kolkata day the notice belongs to
  created_at  timestamptz NOT NULL,
  read_at     timestamptz,
  UNIQUE (person_id, task_id, kind, for_date)
);

CREATE TABLE sheet_sources (
  id            text PRIMARY KEY,
  team_id       text NOT NULL REFERENCES teams(id),
  sheet_id      text NOT NULL,
  tab_name      text NOT NULL,
  header_map    jsonb NOT NULL,     -- {"title": "...", "owner": "...", "due_on": "...", "status": "...", "note": "...", "row_key": "..."}
  last_read_at  timestamptz,
  last_error    text,
  UNIQUE (sheet_id, tab_name)
);
```

Slice 2 tables:

```sql
CREATE TABLE meetings (
  id           text PRIMARY KEY,
  team_id      text NOT NULL REFERENCES teams(id),
  source       text NOT NULL CHECK (source IN ('granola')),
  source_id    text NOT NULL,          -- the Granola note id
  title        text NOT NULL,
  held_on      date NOT NULL,
  received_at  timestamptz NOT NULL,
  drafted_at   timestamptz,
  UNIQUE (source, source_id)
);

CREATE TABLE drafts (
  id             text PRIMARY KEY,
  meeting_id     text NOT NULL REFERENCES meetings(id),
  title          text NOT NULL,
  spoken_owner   text,
  owner_id       text REFERENCES people(id),     -- set by code or by the approver, never by the model
  due_phrase     text,
  due_on         date,                           -- set by code or by the approver
  due_kind       text NOT NULL CHECK (due_kind IN ('stated','inferred','missing')),
  source_quote   text NOT NULL,
  quote_valid    boolean NOT NULL,
  critical       boolean NOT NULL,
  confidence     numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  duplicate_of   text REFERENCES tasks(id),
  state          text NOT NULL CHECK (state IN ('draft','approved','rejected')),
  decided_by     text REFERENCES people(id),
  decided_at     timestamptz,
  decision_note  text,
  task_id        text REFERENCES tasks(id),
  CHECK ((state = 'approved') = (task_id IS NOT NULL)),
  CHECK (state = 'draft' OR decided_by IS NOT NULL)
);

CREATE TABLE email_optins (
  person_id    text NOT NULL REFERENCES people(id),
  kind         text NOT NULL CHECK (kind IN ('monday_digest')),
  opted_in_at  timestamptz NOT NULL,
  opted_out_at timestamptz,
  PRIMARY KEY (person_id, kind)
);

CREATE TABLE email_sends (
  id            text PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('monday_digest','friday_overdue')),
  triggered_by  text REFERENCES people(id),   -- the admin for friday_overdue; NULL for an opted-in digest
  recipients    text[] NOT NULL,              -- person ids, not addresses
  body_snapshot jsonb NOT NULL,               -- task ids and covering text
  state         text NOT NULL CHECK (state IN ('draft','sent','failed')),
  provider_id   text,
  created_at    timestamptz NOT NULL,
  sent_at       timestamptz
);
```

### 3.4 Derived values (never stored)

| Value | Rule |
|---|---|
| `closed_on` | `(closed_at AT TIME ZONE 'Asia/Kolkata')::date` |
| Outcome | `ahead` if `closed_on` < `first_due_on`; `on_time` if equal; `late` if greater. Only for `done` |
| Overdue | `status_category = 'open'` and today (`Asia/Kolkata`) > `due_on` |
| Renegotiation class | For each `due_on` event after creation: `open` if the event's date in `Asia/Kolkata` is on or before its `before` value, else `late` |
| Silent slip, now | Overdue. With dates locked, an open task past its current `due_on` was by definition not renegotiated in time |
| Silent slip, ever | Silent slip now, or any late renegotiation (above), or `done` with `closed_on` after the `due_on` current at close and no `due_on` event on or before that date |
| Met revised date | For `done` tasks whose date moved: `closed_on` <= the `due_on` current at close. Shown next to outcome so an open renegotiation that was then kept is visible |
| Ledger week | Monday of `first_due_on` |

The ledger query in `docs/DATA-MODEL.md` changes in one place: the `due_on` used for ON TIME and
LATE is `first_due_on` (C1). OPEN still uses the current `due_on`.

### 3.5 Events written per action

| Action | Events (all at the same `at`) |
|---|---|
| Create | `_created` with the full row in `after` |
| Edit title, note, project, owner | One per changed field |
| Health change | `health` |
| Red rule | `health`, then `due_on` with `reason` |
| Renegotiate | `due_on` with `reason` |
| Close done | `status`, `status_category`, `closed_at` |
| Drop | `status`, `status_category` with `reason` |
| Reopen | `_reopened` with `reason`, `status`, `status_category`, `closed_at` |
| Block / clear | `blocked_on_id`, `blocked_ask` |
| Priority | `priority` |
| Free update | `_update` with the text in `after` |

### 3.6 Fixtures

`fixtures/` stays synthetic and must be updated to this schema: add `teams` and `team_members`,
add `first_due_on`, `health` and `version` to tasks, and add a `reason` to the two `due_on`
events (`tsk_008`, `tsk_017`). Replay must still produce `tasks.json` exactly.

---

## 4. API / Interface Contracts

### 4.1 Conventions

- JSON over HTTPS under `/api/v1`. Next.js route handlers. Server components may call the same
  service functions directly, but every write goes through the service layer that the routes
  use, so the rules hold on both paths.
- Auth by session cookie from sign-in. Every route except sign-in, the Granola webhook and the
  email opt-out link needs a session. Job routes need a server-held secret instead.
- IDs are text with a prefix: `tsk_`, `per_`, `prj_`, `evt_`, `ntc_`, `drf_`, `mtg_`, `eml_`.
- Dates are `YYYY-MM-DD`. Times are ISO 8601 with offset. Days are judged in `Asia/Kolkata`.
- Every write on a task takes `version` and returns the new task with its new `version`.
- Request bodies are checked with Zod. Unknown fields are rejected.
- Errors:

```json
{ "error": { "code": "reason_required", "message": "A new date needs a reason.", "field": "reason" } }
```

| HTTP | `code` examples |
|---|---|
| 400 | `invalid_body`, `reason_required`, `date_in_past`, `owner_not_on_roster`, `due_on_locked` |
| 401 | `not_signed_in` |
| 403 | `not_allowed` (role does not permit the action), `read_only_mirror` |
| 404 | `not_found` |
| 409 | `version_conflict` |
| 429 | `rate_limited` |

### 4.2 Task shape

```ts
type Task = {
  id: string;
  teamId: string;
  title: string;
  ownerId: string;
  projectId: string | null;
  firstDueOn: string;          // locked
  dueOn: string;               // current
  dateMoves: number;           // count of due_on events after creation
  note: string | null;
  health: 'not_started' | 'off_track' | 'on_track' | 'ahead' | null;  // null only for Sheet mirrors
  statusCategory: 'open' | 'done' | 'dropped';
  sourceStatus: string;        // the Sheet's own word for mirrors
  outcome: 'ahead' | 'on_time' | 'late' | null;     // derived, done only
  metRevisedDate: boolean | null;                    // derived, done and moved only
  overdue: boolean;            // derived
  slippedSilently: boolean;    // derived: silent slip ever (section 3.4); overdue covers "now"
  priority: { value: 'high' | 'normal' | 'low'; setBy: string; setAt: string } | null;
  blocked: { onId: string; ask: string; at: string } | null;
  origin: 'app' | 'sheet' | 'granola';
  readOnly: boolean;           // true for Sheet mirrors
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
  version: number;
};
```

### 4.3 Task routes (slice 1)

| Method and path | Body | Who | Rules |
|---|---|---|---|
| `POST /tasks` | `{ title, ownerId, dueOn, projectId?, note? }` | Member | FR-1 to FR-3. `dueOn` today or later. Returns 201 and `Task` |
| `GET /tasks/:id` | | Member | Returns `Task` |
| `PATCH /tasks/:id` | `{ version, title?, note?, projectId?, ownerId? }` | FR-5, FR-6 | Any `dueOn`, `firstDueOn`, `health`, `priority` or status key in the body: 400 `due_on_locked` or `invalid_body` |
| `POST /tasks/:id/health` | `{ version, health, newDueOn?, reason? }` | Owner, lead | `off_track` needs `newDueOn` and `reason` (FR-12) |
| `POST /tasks/:id/renegotiate` | `{ version, newDueOn, reason }` | Owner, lead | FR-15, FR-16. `newDueOn` today or later and not equal to `dueOn` |
| `POST /tasks/:id/close` | `{ version, as: 'done' \| 'dropped', reason? }` | Owner, lead | `dropped` needs `reason` |
| `POST /tasks/:id/reopen` | `{ version, reason }` | Lead | FR-7 |
| `POST /tasks/:id/block` | `{ version, onId, ask }` | Owner | FR-23, FR-24. `onId` is an active person, not the owner |
| `POST /tasks/:id/unblock` | `{ version, note? }` | Owner, blocked person, lead | FR-25 |
| `POST /tasks/:id/priority` | `{ version, value }` | Lead | FR-27, FR-28 |
| `POST /tasks/:id/updates` | `{ text }` | Owner, lead | FR-21. Does not need `version`, as it changes no field |
| `GET /tasks/:id/log` | `?before=<event id>&limit=50` | Member | FR-20. Newest first |

Every write route returns 403 `read_only_mirror` for `origin = 'sheet'`.

### 4.4 View routes (slice 1)

| Method and path | Query | Returns |
|---|---|---|
| `GET /me/tasks` | | `{ blockedOnMe: Task[], assigned: Task[], tasks: Task[] }` in FR-29 order |
| `GET /teams/:id/week` | `weekStart=YYYY-MM-DD` (a Monday), `personId?`, `projectId?` | `{ weekStart, people: [{ personId, counts: { open, overdue, silentSlips, blocked, closedThisWeek }, tasks: Task[] }] }` |
| `GET /teams/:id/by-status` | `weekStart`, `personId?`, `projectId?` | `{ open: { [health]: Task[] }, closed: { [outcome]: Task[] } }` |
| `GET /teams/:id/ledger` | `from`, `to` (Mondays), `personId?` | `{ rows: [{ personId, weekStart, closedAhead, closedOnTime, closedLate, openPastDue, silentSlips, renegotiatedOpen, renegotiatedLate }] }` |
| `GET /me/notices` | `unread?` | `Notice[]` |
| `POST /me/notices/:id/read` | | 204 |

### 4.5 Admin routes (slice 1)

| Method and path | Body | Who |
|---|---|---|
| `POST /teams/:id/people` | `{ displayName, role, department, email, appRoles }` | Admin |
| `PATCH /people/:id` | `{ active?, appRoles? }` | Admin |
| `POST /teams/:id/sheets` | `{ sheetId, tabName, headerMap }` | Admin |
| `GET /teams/:id/sheets/:sid/status` | | Admin: `{ lastReadAt, lastError, rowsNotRead: [{ rowKey, reason }] }` |

### 4.6 Slice 2 routes

| Method and path | Body | Who | Rules |
|---|---|---|---|
| `POST /webhooks/granola` | Granola payload | Granola | Standard Webhooks signature checked. Answer within 15 s by queueing, never by drafting inline. Idempotent on the Granola note id |
| `GET /teams/:id/drafts` | `state=draft` | Approver | FR-48 order |
| `POST /drafts/:id/approve` | `{ title?, ownerId?, dueOn?, projectId? }` | Approver | Owner and date must be set after the merge, or 400. Creates the task (R9) |
| `POST /drafts/:id/reject` | `{ note? }` | Approver | |
| `PUT /me/optins/monday_digest` | `{ on: boolean }` | Member | FR-51 |
| `GET /email/optout?token=` | | Anyone with the link | Signed single-purpose token. Turns the digest off |
| `GET /teams/:id/emails/friday` | | Admin | The current draft, built from the same query as the views |
| `POST /teams/:id/emails/friday/send` | `{ coveringText, idempotencyKey }` | Admin | FR-52. Sends once per key |

### 4.7 Internal interfaces

Job routes, called by cron with a secret header:

| Route | When (`Asia/Kolkata`) | Does |
|---|---|---|
| `POST /jobs/reminders` | Daily 09:00 | FR-36. Idempotent per day by the `notices` unique key |
| `POST /jobs/sheets` | Every 15 min | FR-41 to FR-43 |
| `POST /jobs/granola-poll` | Every 30 min (slice 2) | FR-44 fallback |
| `POST /jobs/monday-digest` | Monday 08:00 (slice 2) | FR-51 |
| `POST /jobs/friday-draft` | Friday 16:00 (slice 2) | FR-52 draft only. Never sends |

The extraction step (slice 2) has one function signature, so the model can be swapped:

```ts
extractDrafts(input: { meetingId: string; heldOn: string; transcript: string; roster: { id: string; name: string }[] })
  : Promise<RawDraft[]>   // model output, checked by Zod, before FR-47 checks
```

---

## 5. Non-Functional Requirements

### 5.1 Performance and scale

- Pilot scale: one team, up to 15 people, up to 2,000 tasks and 50,000 events. Design for 10
  teams without schema change.
- Server response for any view route at p95 under 400 ms with that data, measured on the
  synthetic fixture scaled up. A page is usable within 2 s on a mid-range phone on 4G.
- Ledger queries are computed on read. Add a cache only if the p95 target is missed.

### 5.2 Security and access

- Google sign-in only. The company domain is checked on the server, never by the `hd` hint
  alone. The email must also match an active roster person.
- Every write checks the actor's team role on the server (section 2.1). The UI hiding a button
  is not a check.
- Sessions are `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Writes need a CSRF token or a
  same-origin check.
- Secrets (database URL, Google client secret, Granola key, model key, email key, job secret)
  live in the host's secret store. None goes in the repo, a fixture or a log.
- The Granola key has a named holder and a written revocation rule before slice 2 starts (OQ9).
- Read-only by design on the founder's Supabase and every department Sheet. The Sheets
  credential has read scope only.

### 5.3 Rate limits

| What | Limit |
|---|---|
| Writes per signed-in user | 60 per minute, then 429 |
| Sign-in attempts per IP | 10 per minute |
| Granola API calls | Under Granola's 5 per second sustained and 25 burst per 5 s, with backoff on 429 |
| Sheets API reads | Under 300 per minute per project |
| Model calls | One per meeting note, retried only on 429 or 529, three times, then the note is marked failed for the admin |

### 5.4 Data and privacy

- **The repo is public.** Synthetic data only in git, fixtures, evals and artifacts. No names,
  credentials, customer data or internal URLs. The fixture guard (`fixtures/README.md`) runs in CI.
- **No customer PII** is read, stored or sent.
- **Model vendor gate.** Real meeting text goes to a model only after Nicobar approves that
  vendor in writing. Until then, slice 2 runs on synthetic transcripts only.
- **Transcripts are not stored** after drafting (R10). Retention of draft quotes: `TBD`, to be
  set with the sponsor before slice 2. Default if no answer: 90 days, then the quote is deleted
  and the draft keeps its decision.
- **Logs** hold ids, routes, status codes and timings. They never hold task titles, notes,
  asks, quotes or email bodies.
- **Backups:** daily, kept 14 days, restore tested once before the pilot starts. The data region
  is decided with OQ8.

### 5.5 Reliability

- Every write is one database transaction. A failed write leaves no partial events.
- Jobs are idempotent and safe to run twice.
- The Granola webhook answers within 15 s. Missed webhooks are caught by polling.
- A model or API error means "no draft", never a guessed one. The note is retried or flagged.

### 5.6 Interface and accessibility

- The Nicobar UI, as specified in `~/Code/Nicobar work/docs/SHEET-SPEC.md`. Its guards
  (`tools/lint_rules.py`, `tools/check_contrast.py`) run on our views.
- Every colour has a word. Contrast meets WCAG 2.2 AA in day and night grounds.
- Every action is reachable by keyboard. Mobile follows the global rule: the keyboard closes on
  tap outside, return or scroll.

### 5.7 Model safety (slice 2)

- The model has no tools. Its only output is drafts that match the schema.
- Owners and dates are set by code or by a person, never by the model.
- Transcript text is treated as data. The eval's injection cases (17 to 20) must pass.
- A field a person set is never overwritten by a later model run.

---

## 6. Constraints & Out of Scope

### 6.1 Constraints (must hold)

From `CLAUDE.md` CONSTRAINTS and `INTENT.md` section 7:

- Use the OKR page's UI. No new visual language.
- Do not rebuild the tracker owner's tracker (`nicobar-okr-processor`). Read what it produces.
- Never write to the founder's Supabase or any department Google Sheet.
- Nothing is sent on anyone's behalf (tags, nudges, emails) without their yes.
- No recorder. Meetings are read from Granola through its public API and a workspace key.
- No real Nicobar data, names, credentials or customer data in the repo.
- No priority or status set by the app on its own.

### 6.2 Out of scope for this iteration

| Not built | Why, and where it goes |
|---|---|
| Leadership view across teams | Stage 3. Needs many teams' data |
| Launch, Partner and Pipeline views (countdown, dependencies, two-sided owners, stage board, season calendar) | Pilot builds the core and one type's view. Launch dependencies come next if the pilot is Run |
| Milestones, roll-ups, timelines, subtasks, dependencies | Project-tool features. Milestones only if the pilot lead asks by week three |
| Comments threads, attachments, labels | Not asked for. The update log covers notes |
| Partner-side owners and tasks | OQ11 |
| Wispr Flow as a source | Later. Each person opts in |
| Google Chat scanning | Later. Needs admin access and everyone's consent |
| Slack, WhatsApp or push delivery | Not in the pilot |
| Writing to Sheets, two-way sync | Read-only rule |
| Writing to the context layer | Read access and owner `TBD` (`docs/BRIEF.md` question 3). Nothing in this iteration reads it either |
| Merging with the OKR page | OQ8 and `HANDOFF.md` question 6. The schema keeps `team_id` and text ids so a merge stays possible |
| A meeting recorder | Needs everyone's consent and a retention rule first |
| Model-set priority, health, risk or due dates | Principle 2 |
| Owner acceptance of assigned tasks | OQ-A below |
| Native mobile apps, offline mode, local-first sync | A responsive web page is enough for the pilot |

### 6.3 Open questions this spec adds

Defaults are built unless answered otherwise.

| # | Question | Default | Who decides |
|---|---|---|---|
| OQ-A | `INTENT.md` defines a commitment as a date the owner agreed to. When someone else creates the task, must the owner accept before the first date locks? | No acceptance step. The date locks at creation. The owner sees "Assigned by" | the sponsor, the founder |
| OQ-B | Does the Friday overdue email go to the whole team roster, or only to people with overdue items plus the lead? | Whole roster | the founder |
| OQ-C | Should a Sheet date change count as a renegotiation in the ledger, given the Sheet gives no reason? | Yes, with reason "changed in Sheet" | the sponsor |
| OQ-D | Retention of draft quotes after a decision | 90 days | the sponsor |

---

## 7. Verification & Acceptance Criteria

### 7.1 How we test

| Layer | Tool | Runs |
|---|---|---|
| Unit | Vitest | Each derived value in section 3.4, each Zod schema, date maths |
| Database | Vitest on PGlite with the schema in section 3.3 | Constraints, triggers, replay, ledger |
| API | Vitest calling route handlers with a signed-in test session per role | Every row in sections 4.3 to 4.6 |
| UI | Playwright on the fixture data | The four views, colour plus word, keyboard |
| Eval | `evals/meetings/` with a scorer for drafts (slice 2) | Section 7.3 |
| Guards | `python3 -I evals/meetings/check.py`, the fixture denylist test, the OKR page's lint and contrast tools | CI on every push |

All tests run on synthetic data. A test that needs a real key or real data is not a test here.

### 7.2 Acceptance criteria per requirement

Slice 1 is done when every slice 1 row passes in CI.

| FR | Acceptance check |
|---|---|
| FR-1, FR-2 | Create with all fields returns 201. Missing owner, missing date, or an owner not on the roster returns 400 with the matching code, and no row or event is written |
| FR-3, FR-14 | After create, `firstDueOn = dueOn`. A direct `UPDATE tasks SET first_due_on` raises `first_due_on is locked`. No API body can change it |
| FR-4 | A 141-character note returns 400 |
| FR-5, FR-6 | A member editing another person's task returns 403. A lead's edit writes one event per changed field. Reassignment keeps `firstDueOn` |
| FR-7 | Close as done sets `closedAt` and writes three events. Drop without a reason returns 400. A dropped task is absent from the ledger. Reopen by a member returns 403 |
| FR-8 | A task created by A for B shows "Assigned by A" in B's `/me/tasks` until B opens it |
| FR-9 to FR-11 | A new task has health `not_started`. Every rendered health, outcome and overdue chip in the UI test has visible text |
| FR-12 | `off_track` with no `newDueOn` or no `reason` returns 400 `reason_required` and changes nothing. With both, health and `due_on` change in one transaction, and the `due_on` event carries the reason |
| FR-13 | A `not_started` task past its date shows "Not started" and "Overdue" |
| FR-15 | `PATCH` with `dueOn` returns 400 `due_on_locked`. Renegotiate with no reason, or a reason under 10 characters, returns 400 |
| FR-17, FR-18 | Fixture: a task renegotiated the day before its date is classed open and has `slippedSilently = false`. An open task whose date passed with no event is overdue with `slippedSilently = true`. Renegotiating it afterwards classes that renegotiation late, clears `overdue`, and keeps `slippedSilently = true` |
| FR-19 | `tsk_008` shows "Due 26 Sep (first given 23 Sep, moved once)" |
| FR-20 to FR-22 | The log lists every event for the task, newest first. `UPDATE` or `DELETE` on `events` raises `events is append-only` |
| FR-23 to FR-26 | Block writes two events and one `blocked_on_you` notice for the named person and sends nothing outside the app (the email provider mock gets zero calls). Blocking on the owner or an inactive person returns 400 |
| FR-27, FR-28 | Priority from a member returns 403. From a lead it stores `setBy` and `setAt`. New tasks have no priority |
| FR-29 to FR-33 | On the fixtures as of 2026-10-09, the views return the expected people, order and counts (golden JSON files checked into `tests/`) |
| FR-33, C1 | **Ledger on the fixtures, judged against `first_due_on`:** 18 on time or ahead, 6 late, 4 open and past due, the same totals as `fixtures/README.md`. Per task: `tsk_008` (first due 23 Sep, moved to 26 Sep, closed 25 Sep) is **late** with `metRevisedDate = true`. `tsk_017` (first due 2 Oct, moved to 1 Oct, closed 2 Oct) is **on time** with `metRevisedDate = false`. Under the old rule in `docs/DATA-MODEL.md` these two swap, and the test must catch that |
| FR-34 | A filtered view's URL reloads to the same rows |
| FR-35, FR-42 | Every write route on a Sheet mirror returns 403 `read_only_mirror` |
| FR-36 to FR-39 | Running the reminders job twice on one day creates each notice once. Only owners get notices. The email mock gets zero calls |
| FR-40, FR-41 | A fixture Sheet with its columns reordered reads to the same tasks. A fixture with a mapped header renamed stops with `last_error` set and writes nothing |
| FR-43 | A row whose owner matches nobody is listed in `rowsNotRead` and creates no task. A date changed in the fixture Sheet writes a `due_on` event with reason "changed in Sheet" and keeps `first_due_on` |
| FR-54, FR-55 | Sign-in with an email outside the company domain, or not on the roster, or inactive, is refused |
| FR-44, FR-45 | (2) A webhook with a bad signature returns 401. The same note delivered twice creates one meeting. A note from an unlisted space is ignored |
| FR-46 to FR-48 | (2) A draft whose quote is not in the transcript is shown with `quoteValid = false`, not dropped. A model-returned date is never stored; `dueOn` matches the code's result from the phrase |
| FR-49 | (2) Approve with no owner returns 400. Approve with both creates a task, its `_created` event and links the draft, in one transaction |
| FR-50 | (2) Eval injection cases 17 to 20 pass (section 7.3) |
| FR-51 | (2) A person who has not opted in gets no digest. The opt-out link turns it off without sign-in |
| FR-52, FR-53 | (2) The Friday job creates a draft and the email mock gets zero calls. Send by a non-admin returns 403. Send twice with one key sends once |

### 7.3 Draft quality gate (slice 2)

Run on the 20 synthetic cases in `evals/meetings/`. Slice 2 cannot go live, even on synthetic
data shown to the pilot team, until all of these hold. Targets are from
`docs/RESEARCH-PLAN.md` item 8.

| Measure | Target |
|---|---|
| Critical recall | 100% |
| Invented dates (a date where `missing` is expected) | 0% |
| Quote validity (exact substring) | 100% of drafts shown as valid |
| Owner precision | 0.9 or better |
| Injection cases 17 to 20 | All pass, by the rule in `evals/meetings/README.md` |
| Cancelled cases 15, 16 | No draft built on a `must_not_draft` quote |
| Duplicate cases 13, 14 | One draft, or a second marked "possible duplicate" |

### 7.4 Non-functional checks

| NFR | Check |
|---|---|
| 5.1 | A load test on fixtures scaled to 2,000 tasks shows view routes under 400 ms at p95 |
| 5.2 | API tests call every write route as each role and as signed out. Every forbidden pair returns 401 or 403 |
| 5.3 | 61 writes in a minute from one user: the 61st returns 429 |
| 5.4 | The fixture denylist test and a secret scan pass in CI. A log capture during the API tests contains no task title, note or ask |
| 5.5 | Each job run twice gives the same database state as run once |
| 5.6 | The OKR page's contrast and lint tools pass on our views. Playwright tabs through each view and reaches every action |

### 7.5 Pilot acceptance

Building to this spec is not the same as the pilot working. Whether nico-desk worked is judged
on 31 Dec 2026 against `INTENT.md` section 4: silent slips at 0, the lead running six reviews in
a row from it without being asked, overdue items falling, and the lead saying they would object
if it were taken away. Every measure in that table must be readable from the ledger, the events
and the check-ins, and the week 0 baseline must be taken before slice 1 goes live.
