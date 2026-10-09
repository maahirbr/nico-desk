# nico-desk web: slice 1

The first build slice of `../SPEC.md`: one page where the pilot team runs its week. Runs locally
on synthetic data only.

## Run it

```
cd web
npm install
npm run build && npm start      # or: npm run dev
```

Open http://localhost:3100 and pick a person. On first start the database is created in
`web/.data/` and seeded from `../fixtures/`. Each role on the synthetic roster:

| Person | Access |
|---|---|
| Meera Iyer | lead: priority, reopen, renegotiate anyone's date |
| Priya Menon | admin: the roster |
| Everyone else | member |

Real names on a local run: put a `roster.local.json` next to this README (git-ignored) that maps
fixture person ids to `display_name`, `role`, `email` and `roles`, then `npm run db:reset`. The
public repo keeps the synthetic names. `me` names the desk owner, whom sign-in offers first. Example shape:

```json
{ "me": "per_ada", "people": { "per_ada": { "display_name": "Your name", "role": "Project lead", "email": "you@example.test", "roles": ["lead", "admin"] } } }
```

Other commands:

| Command | Does |
|---|---|
| `npm test` | Acceptance tests from SPEC.md 7.2 on a fresh in-memory database |
| `npm run typecheck` | TypeScript |
| `npm run job:reminders` | Runs the daily reminder job against the running server (SPEC.md FR-36) |
| `npm run db:reset` | Deletes the local database. Stop the server first. It reseeds on the next start |
| `NICO_TODAY=2026-10-09 npm start` | Pins "today", e.g. to the fixtures' as-of date |

## What is built

From SPEC.md slice 1: tasks with a locked first date (`first_due_on`, guarded by a database
trigger), renegotiation only with a reason, a picked status plus derived flags and outcome (see below), silent
slips, the update log (append-only `events`), blocked asks with in-app notices, leader-set
priority, the four views (My tasks, The week, By status, Ledger), the task page, in-app
reminders, roster admin, and the `/api/v1` routes in SPEC.md 4.3 to 4.5 with the 4.1 error shape,
version checks, a same-origin check on writes and rate limits.

### Projects

`/projects` lists every project; each has its own page with a header (eyebrow, phase, launch
pills, countdown) and one of two boards, set by `projects.kind`:

- **Task board** (`tasks`): the project's tasks with stat tiles that filter, department pills, tick
  to close, inline status (Blocked asks for a block reason and, optionally, who it waits on; Dropped for a reason), inline edit (a moved date asks why), drop with a reason, add a task, completed tasks and
  the project's update log. Same rules and API as the rest of the app.
- **Plan board** (`plan`): lines of work with a partner, by pillar or by date. Our owner and the
  partner's person, coaching or hands-on, checkpoints with done stamps ("1 day late"), dates moved
  later counted as pushes with the first date kept and a reason asked for (a fix within 10
  minutes by the same person is a correction), Blocked with a reason, remove with a reason and
  restore, search, person and tile filters, next two weeks, the partner's asks, cadence, parked
  items, and an append-only update log (`plan_activity`).
- **Meeting minutes** (plan board): paste minutes, and each next step becomes a proposal to accept,
  edit or reject; nothing changes on the plan until someone accepts. Without `ANTHROPIC_API_KEY`
  a plain parser reads "(Name) task (Oct 12)" lines and marks every line choice unsure. With the
  key set, the minutes are sent to the Anthropic API to suggest lines; only set it if that is
  acceptable for the minutes being pasted.

### Real projects on a local run

`projects.local.json` (git-ignored, next to this README) adds real people, task boards and plans on
top of the synthetic fixtures: `team_name`, `people` (with `contact_email` for reminders and
`never_remind`), `task_projects` (tasks with `workstream` sub-projects and date `history`),
`plan_projects` (same shape as `fixtures/plan.json`) and past `reminders`. It is read only when the
database is first created, so run `npm run db:reset` after changing it. The tests never read it.

### Sub-projects, minutes and reminders

- **Sub-projects** (task boards): a side list of a project's workstreams with open counts; tasks
  carry `workstream`. Person pills filter by owner. A moved date shows each earlier date struck out.
- **Import minutes** works on task boards too: each next step becomes a proposed task, matched to a
  roster person and a sub-project; it needs an owner and a date before it can be accepted.
- **Reminders** (`/reminders`, leads): one email per person with what is overdue (and, optionally,
  due within N days) across tasks, plan checkpoints and meeting actions. The app never sends. "Open
  in Gmail" opens a filled-in compose window in your own Gmail and you press Send; "Mail app" and
  "Copy" do the same elsewhere. Each opened draft is recorded, so the page says "reminded 2 days
  ago". People marked `never_remind` are listed as skipped.

### Layout

The sidebar has Home (your tasks by when they are due, with a tick and a status picker), Team (by
person: what is next for each person, overdue, this week and coming up, with a find-a-person box; by
status: the week's work;
`/week` and `/status` redirect there), Projects, and More (Ledger, Reminders, Roster). Every list
uses one line per task with one status word and, where it applies, one flag (see Statuses);
clicking a task opens a side panel with its details, actions and history. Leads start a project
from Projects (name, what done looks like, date, lead, people with their project role,
sub-projects or pillars, partner); the project's Settings edits the same fields.

### Statuses

A person picks one of five: **Not started**, **In progress**, **Blocked**, **Done**, **Dropped**. The app
works out the flags from the dates and never lets anyone pick them: **Late** (date passed, not done),
**At risk** (due within two days and still not started or blocked), and once done **Ahead**, **On
time** or **Late** against the first date given. An early warning is a date move, which the ledger
counts as moved in time. This replaces SPEC.md FR-10 to FR-12's picked health and Red rule (team
decision, 9 Oct). Older ahead and off-track values read as In progress.

### Connections and search

- **Connections** (opened from Import minutes when a tool is not connected; not in the menu): a lead
  pastes the team's Granola or Fireflies API key once.
  The key is checked against the tool, kept only in `.data/connections.json` (git-ignored, owner-only
  file), and shown back only as its last four characters. Import minutes then lists that tool's
  recent meetings to pick from; a meeting already imported into a project is refused. Wispr Flow has
  no public API (only an MCP connection for AI assistants), so it stays paste-only.
- **Search** (sidebar, or Ctrl/⌘+K): projects, tasks, plan lines and people in one list.

### Ledger and reasons

- **Ledger** (More → Ledger): the summary tiles and weekly tables as before, plus a **delivery
  habits** card per person (kept on the first date with an ahead / on time / late split, how late
  when late, dates moved in time or after, silent slips, what is open now and who waits on whom),
  in name order with a trend against the same length of time before. Every number opens the tasks
  behind it, each with its first date, every move and its reason, and how it ended. Leads and admins
  see everyone; a member sees only their own card and rows (SPEC.md roles).
- **Reasons** (10 to 280 characters, kept in the task's history): blocking needs a block reason
  (naming a teammate it waits on is optional, and they get an in-app notice), dropping needs a reason, and so do going back to Not started, reopening and
  moving a date. Starting (Not started to In progress), clearing a block and marking done are one
  click, each with an optional note. Plan lines follow the same rule.

## What is not built, and why

| Not built | Why |
|---|---|
| Google sign-in (FR-54) | No Google client issued. Local sign-in is a roster picker, on only with `NICO_DEV_SIGNIN=1` (set by `npm run dev` and `npm start`). It still enforces the roster, the active flag and the allowed domain (`NICO_ALLOWED_DOMAIN`, default `example.test`) |
| Sheet read (FR-40 to FR-43) | Needs read access to a Sheet. The fixtures' Sheet rows show as read-only mirrors |
| Slice 2: Granola drafts, Monday digest, Friday overdue email | Gated in SPEC.md section 1 |
| The OKR page's own tokens and components | `~/Code/Nicobar work` is not on this machine. `app/globals.css` uses the same palette as `docs/team-page`, in one block to swap |
| Sending reminders from the server | Nothing is sent on anyone's behalf without their yes (CLAUDE.md). Drafts open in your own Gmail and you send them |
| Wispr Flow import | Wispr Flow has no public API, only a read-only MCP connection for AI assistants. Paste the summary instead |
| A hosted Postgres | Not chosen yet (OQ8). Local runs use PGlite, Postgres compiled to WASM in this process. The schema in `lib/schema.ts` is plain Postgres |

## Layout

- `lib/schema.ts`: the SPEC.md 3.3 DDL (slice 1 tables).
- `lib/seed.ts`: loads `../fixtures`, filling the fields SPEC.md 3.6 adds.
- `lib/derive.ts`: outcome, overdue, silent slips, renegotiation class. Never stored.
- `lib/service.ts`: every read and write, with the role and date rules. Pages and API both use it.
- `lib/plan.ts`, `lib/planUtil.ts`: project pages and plan boards; `app/api/v1/projects/[id]/plan` takes one op per change.
- `lib/http.ts`: the API wrapper: session, same-origin, rate limit, Zod, error shape.
- `app/api/v1/`: the routes. `app/*/page.tsx`: the views. `components/`: chips, task table, forms.
- `tests/core.test.ts`: acceptance checks on the fixtures. `tests/plan.test.ts`: project pages, plan boards, sub-projects, minutes and reminders.
