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
reminders, roster admin (one person, or a pasted list of people as members), and the `/api/v1` routes in SPEC.md 4.3 to 4.5 with the 4.1 error shape,
version checks, a same-origin check on writes and rate limits.

Google sign-in (FR-54) is built with `fetch` and no extra package. `/api/auth/google` sets a random
`state` cookie and sends the visitor to Google. `/api/auth/google/callback` checks the state, swaps the code for an
ID token, then `checkSignIn` lets in only an active roster person on `NICO_ALLOWED_DOMAIN`. It turns on when
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (see `.env.example`). The roster picker stays for local runs
(`NICO_DEV_SIGNIN=1`).

### Jev uses (suggestions only)

With `NICO_JEV` on (and `TYPESAFE_API_KEY`; hosted also needs `NICO_JEV_LIVE`), five small checks run through
`lib/jevUses.ts`. Each one finds candidates in code, asks Jev, then merges in code. An answer needs 0.6 confidence
(yes/no 0.65). An error or a low answer shows nothing. Nothing is saved or changed. With the flag off the screens show
nothing new.

- Home `/me`: a "Suggested" sort next to By date (the default). It falls back and says so.
- Project page, lead only: "Suggest how it is going" (on track, at risk or slipping) from the last 14 days of notes.
- Minutes queue: "Check drafts" notes vague wording and a likely repeat of an open task.
- Task drawer: a new comment can offer the usual done or blocked banner.
- New task: a suggested project, filled only while the field is empty.

Not built: the sort on the Team page.

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
  key set, the minutes are masked (`lib/redact.ts`, plus the partner names) and sent to the Anthropic API to suggest
  lines. With `DATABASE_URL` set, the minutes, chat and sentence reads stay off unless `NICO_MODEL_LIVE=1`
  (`lib/model.ts`), the same rule as Jev. Tests: `tests/model.test.ts`.

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
clicking a task opens a side panel with its details, actions and history. Anyone on the team starts a project
from Projects (name, what done looks like, date, lead, people with their project role,
sub-projects or pillars, partner); the project's Settings edits the same fields.

An admin can mark a person "Own projects only" on the Roster. That person sees only the projects they
own, lead or are a member of, and the projects whose Settings lists them under "Can also view". Leads
and admins always see everything (`lib/sight.ts`, `lib/visibility.ts`).

### Statuses

A person picks one of five: **Not started**, **In progress**, **Blocked**, **Done**, **Dropped**. The app
works out the flags from the dates and never lets anyone pick them: **Late** (date passed, not done),
**At risk** (due within two days and still not started or blocked), and once done **Ahead**, **On
time** or **Late** against the first date given. An early warning is a date move, which the ledger
counts as moved in time. This replaces SPEC.md FR-10 to FR-12's picked health and Red rule (team
decision, 9 Oct). Older ahead and off-track values read as In progress.

### Connections and search

- **Connections** (opened from Import minutes when a tool is not connected; not in the menu): a lead
  pastes a Granola, Fireflies or Fathom API key once. A Fathom key is per user and sees only its
  owner's own and shared meetings.
  The key is checked against the tool, kept only in `.data/connections.json` (git-ignored, owner-only
  file), and shown back only as its last four characters. A key set in the server environment
  (`GRANOLA_API_KEY`, `FIREFLIES_API_KEY`, `FATHOM_API_KEY`) wins over the file, and the page says so.
  On Vercel the file is not used at all and the page refuses to save or remove a key: one saved key
  would serve every lead, so keys there are env vars only. Import
  minutes then lists that tool's recent meetings to pick from; a meeting already imported into a
  project is refused. Wispr Flow has no key-based API for apps like this one (its Notetaker has a
  read-only MCP server for AI assistants, not used here yet), so it stays paste-only.
- **Google Meet notes** (Connections, lead or admin; off unless `NICO_MEET=1` with the Google client set). A lead
  presses Connect Google Meet. That is a second Google permission screen, asked only of that lead and never at
  sign-in (incremental authorization). It asks to read Meet records and Meet files: `meetings.space.readonly` and
  `drive.meet.readonly`. The return must come from the lead's own Google address (`people.email` or `alt_emails`), or
  nothing is saved. Only the refresh token is kept, in `google_links`, sealed with AES-256-GCM under a key from
  `NICO_TOKEN_KEY` and bound to the person. Access tokens live in memory for one call. Disconnect deletes the row and
  asks Google to revoke the token. The Import minutes screen then shows a Google Meet tab: the last 14 days of
  meetings the lead was in. A pick reads the Gemini notes Doc if there is one, else the transcript with speaker names.
  The text goes through the same minutes reader as Fathom, so nothing is stored beyond what that flow stores. View as
  refuses every Meet route, reads included. Code: `lib/meet.ts`, `app/api/v1/connections/google-meet/`,
  `app/api/auth/google/meet/callback/`. Tests: `tests/meet.test.ts`, with Google faked. Limits: a raw transcript has no
  Next steps heading, so without `ANTHROPIC_API_KEY` the plain reader gives noisy proposals, and the model reader is
  the better fit. A notes Doc owned by another organizer may not open with these scopes, and the transcript is read
  instead. Not yet checked against a live Google account.
- **Google Doc minutes** (Import minutes, Google Doc tab; same switch and same Google link as Meet). A lead pastes the
  link of any Doc they can open. The app reads it once with the Docs API (`documents.readonly`) and the lead's own
  token, sent by POST so the Doc link stays out of request logs. Headings, bullets and their depth, person chips
  ("@name task" becomes "(Name) task"), date chips, every tab, and a table with Owner and Task columns become lines
  for the same minutes reader as Granola, so sub-bullets become details. An "Action items" heading reads as Next
  steps. The source id is the Doc id and the meeting date, so a running weekly Doc can be imported once per meeting.
  A lead linked before this change gets `docs_reauth` and must disconnect and connect Google again. Code:
  `readGoogleDoc` in `lib/meet.ts`, `app/api/v1/connections/google-meet/docs/`. Limit: a re-import of a running Doc
  also brings back the earlier weeks' action items; the lead rejects them or Check drafts flags them.
- **Search** (sidebar, or Ctrl/⌘+K): projects, tasks, plan lines and people in one list.
- **Quick Add** (the first line of New task and of a board's Add task): type or say a sentence such as "ask Sam to send
  me the design files by Monday for Autumn landing page", and it fills in the task name, owner, due date and project for
  the person to check before Add task. `POST /api/v1/tasks/read-sentence` (`lib/sentenceRead.ts`) asks Claude when
  `ANTHROPIC_API_KEY` is set, masked like the chat read below, and checks the answer against the roster and the
  projects the person can see. With no key, or a bad answer, the plain rules in `lib/sentence.ts` read it ("ask / remind
  / get NAME to", "NAME needs to", "send me", "for PROJECT", weekdays, "tomorrow", "end of week", "next week", "eod").
  Nothing is written and the sentence is not stored. The mic button types what is said through the browser's own
  speech service (Chrome, Edge, Safari; hidden where the browser has none) and reads it when the person stops. A phone's
  keyboard dictation works too. Several tasks at once ("Sam, can you ... by Friday? And then Kabir, can you ...") open a
  list of cards (`components/TaskDrafts.tsx`), each with Add and Skip, and Add all; up to ten at a time. The rules split
  on lines, list markers, sentence ends and "and also / and then / also / then" when what follows starts a new task.
  Tests: `tests/sentence.test.ts`.
- **Paste a chat** (paste a WhatsApp chat into Quick Add on New task; not shown under View as): the chat goes to the
  review screen below, where an exported `.txt` file can also be picked. `lib/chat.ts` reads iOS, Android (12 or 24 hour) and plain lines into messages and drops
  system lines. Before the text goes to Claude, `lib/redact.ts` masks it: roster names and addresses, project names,
  phone numbers, links, amounts. A sender who is not on the roster becomes "an outside person". Claude may only point at
  the tasks and projects the signed-in person can see, and it reads the chat as data, never as instructions. Each answer
  is checked in `lib/paste.ts`: status as one of the five words, a real date, a quote that is in the source message.
  The review screen shows the reading beside the change, with Approve, Edit and Skip. Nothing is written until Approve.
  Approve goes through the normal service rules, one change per proposal, so the undo toast works for status and date
  changes (a new task and a note have none). The raw text is dropped after the read and is not stored. Needs
  `ANTHROPIC_API_KEY`: without it the read returns 503 `model_off`. Tests: `tests/chat.test.ts`, `tests/paste.test.ts`,
  `tests/paste-evals.test.ts`. The 20 synthetic chats are in `evals/paste/`.

### Phone install, dictation and feedback

- **Install on a phone.** `app/manifest.ts` serves `/manifest.webmanifest` (name Nico Desk, standalone, skin W day colours).
  Icons are in `public/icons/` (192, 512, maskable 512, apple touch 180), made by `scripts/make-icons.mjs`. `layout.tsx`
  sets `appleWebApp` and a light and dark `themeColor`. `public/sw.js` is a small service worker, registered in
  production only (`components/ServiceWorker.tsx`). It never touches `/api/`, any non-GET request or another origin, and
  it caches no page. Only `/_next/static/`, `/icons/`, the manifest and `public/offline.html` are cached (cache-first,
  versioned name, old caches deleted on activate). A page request goes to the network and falls back to the offline
  page. The Guide has an "On your phone" section. Test: `tests/pwa.test.ts`.
- **Dictation check (HANDOFF 8.6).** `components/ime.ts` holds `isRealEnter` (Enter that is not part of an IME
  composition: `isComposing` or keyCode 229) and `cutBy`. Every Enter-to-submit handler now uses it. `LimitNotice`
  (mounted in `layout.tsx`) listens for `beforeinput` on any box with a `maxLength` and shows a notice when a paste or
  dictation is cut. `Count` shows how many characters are left on the long boxes. Test: `tests/ime.test.ts`.
- **Feedback.** The Feedback link (top bar, an icon only on a phone) is open to everyone. It has a box to write a note (up to 4000
  characters) with an optional pick of the screen it is about, and below it every note from the team, newest first, with
  the writer's name and the date and time. Everyone on the team reads every note, whatever their role.  One thought per note. A note can carry up to three
  screenshots, pasted into the box, dropped on the card or picked with "+ Add screenshot"; the browser shrinks each to at
  most 1600px and under 600 KB (`components/shrinkImage.ts`) before upload, and `feedback_images` keeps them (bytea, RLS
  on). Only the writer adds them, the server checks the first bytes, and any teammate opens them
  (`/api/v1/feedback/[id]/images/[n]`, private cache). "+1" (`feedback_votes`) backs a teammate's note once per
  person, never your own, and shows the count. Notes pile up; nothing marks them read. Replies (`feedback_replies`) come only from
  people with the Roster switch "Can reply to feedback" (`people.replies_feedback`); everyone reads them, and the writer
  sees new ones on Home until they open Feedback or press Mark seen. The `feedback` table (`lib/schema.ts`
  and `upgrade()`, RLS on) holds the notes. `POST` and `GET /api/v1/feedback` are open to anyone signed in on the team,
  `PATCH /api/v1/feedback/[id]` (mark read) is admin only, and View as refuses every write. Nothing is emailed.
  Test: `tests/feedback.test.ts`.
- **Your profile** (`/me/profile`, from the account menu and Edit profile on your own page): your name, a nickname, a
  phone number and a photo. A nickname (up to 40 characters, `people.nickname`) shows in place of the name everywhere;
  the Roster and the person page show both, and paste, minutes and reminders still match either one.
  `PATCH /api/v1/me/profile` takes `name`, `nickname` and `phone`; View as refuses it. Test: `tests/profile.test.ts`.


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

- **Meeting rhythm and agenda** (13 Oct): a project can meet weekly, every two weeks, monthly or as needed, on a set
  weekday if it likes. Four columns on `projects` hold it (`meet_every`, `meet_day`, `meet_next`, `meet_last`). The
  project page shows the rhythm, the next date and an agenda that plain code builds from the board (`lib/meetings.ts`,
  no model): late, blocked and at-risk tasks, tasks due before the next meeting, open asks and actions on a plan
  board, what changed since the last meeting (the Updates reader), what finished, and new comments, all through
  `lib/visibility.ts`. A past next date rolls forward by the frequency; as needed has no automatic date. Write the
  minutes opens the existing import. Meeting held (project owner or lead, team lead, admin) sets the last meeting to
  today and moves the next date on. The project list shows "Meets Thu, next 15 Oct". API: `GET` and `PUT`
  `/api/v1/projects/:id/meeting`, `POST /api/v1/projects/:id/meeting/held`. For a hosted database run
  `npx tsx --env-file=.env.remote.local scripts/upgrade-meetings.ts` (or `npm run db:upgrade`) before promoting.

## Hosting

- `lib/db.ts` picks the database:
  - `DATABASE_URL` set: postgres-js through `lib/pgRemote.ts` (Supabase transaction pooler). `npm run db:remote`
    (`scripts/db-remote.ts`) drops, reseeds and turns RLS on. `npm run db:upgrade` runs the
    idempotent `upgrade()` in `lib/db.ts`: it adds columns and tables and keeps all data. Both end with
    `PUBLIC_API_LOCK` (`lib/schema.ts`): the Supabase `anon` and `authenticated` roles get no rights, and a
    restrictive `deny_public_api` policy refuses them on every table. Then `TEAM_FENCE` makes the `nico_app` role and
    one `team_fence` policy per table. Signed-in calls go through `scoped()` and run as `nico_app` with their team set,
    so they see only that team's rows. Sign-in, the session route and the reminders cron still read as the owner.
  - Unset on Vercel: PGlite in tmpdir, seeded from `fixtures/` on each cold start, so edits do not last.
  - Unset locally: PGlite in `web/.data/`.
- `NICO_OPEN_DEMO=1` skips sign-in: a visitor is the team lead and `/signin` switches person. On Vercel, secrets come
  from env or are derived (`lib/secret.ts`). `.env.example` lists every variable.
- Vercel project `nico-desk`, root `web`, serves https://nico-desk.vercel.app from Supabase project `nico-desk`
  (Mumbai). `DATABASE_URL` is set for production only, so previews still use PGlite.
- The live site holds the real pilot, loaded by `NICO_ROSTER=pilot/roster.local.json npm run db:remote` from the
  git-ignored `web/pilot/` (`drop_samples` in its `projects.local.json` leaves the fixtures out).
- Crons (`vercel.json`): a daily job at 09:00 IST calls `/api/v1/jobs/reminders` (in-app due and overdue notices
  only, needs `CRON_SECRET`). The weekly reseed route was removed on 13 Oct. `lib/reseed.ts` runs only from
  `npm run db:remote`.
- With `DATABASE_URL` set, `NICO_SESSION_SECRET` and `NICO_JOB_SECRET` must be set (the app refuses a derived one),
  and the roster picker and open demo stay off unless `NICO_ALLOW_DEMO_IN_HOSTED=1`.
- Google Meet notes (`NICO_MEET=1`), steps for the person who owns the Google Cloud project:
  1. In APIs and Services, enable the Google Meet REST API, the Google Drive API and the Google Docs API.
  2. On the OAuth consent screen, add the scopes `https://www.googleapis.com/auth/meetings.space.readonly`,
     `https://www.googleapis.com/auth/drive.meet.readonly` and `https://www.googleapis.com/auth/documents.readonly`.
     `drive.meet.readonly` is Restricted and `documents.readonly` is Sensitive, so a public app needs Google
     verification. An Internal app in one Workspace domain does not.
  3. On the same OAuth client, add the redirect URI `https://<host>/api/auth/google/meet/callback`, and
     `http://localhost:3100/api/auth/google/meet/callback` for local runs. The sign-in URI stays as it is.
  4. Set `NICO_MEET=1` and `NICO_TOKEN_KEY` (a long random string; keep it, since losing it makes saved links
     unreadable and each lead must connect again). Without `NICO_TOKEN_KEY` on Vercel or with `DATABASE_URL` set, the
     feature stays off.
  5. Run `npm run db:upgrade` before promoting the build, so `google_links` exists.
- MCP server for Claude (`app/api/mcp/`, `lib/mcp.ts`, `lib/mcpAuth.ts`): add the custom connector
  `https://<host>/api/mcp` in Claude. Claude registers itself, the person approves at `/connect` (with their app
  session, or Google if they have none), and every tool call runs as that person through `scoped()`, with the same
  sight and edit rules as the app. Seven tools: `list_my_tasks`, `search_tasks`, `get_task`, `create_task`,
  `update_task`, `add_comment`, `get_project_summary`. No deletes, bulk edits or people changes. Changes are marked
  "via Claude" (`events.origin = 'claude'`, `comments.via`). Nothing is stored for sign-in: client ids, codes and
  tokens are sealed with `NICO_SESSION_SECRET` (access 1 hour, refresh 30 days). Deactivating a person stops their
  access on the next call; rotating the secret stops everyone's. Needs `npm run db:upgrade` once before the first deploy that carries it.
- Activity log (`/activity`, `lib/activity.ts`): for admins, under More. Per person, the days they opened the app, then
  their changes, comments and chat messages, each for the last 7 and 30 days, by Kolkata day. Counts only, never what
  was written. A visit is one `visit_days` row per person per day, written on their first signed-in request. Visits
  count from the deploy that adds the table. Optional `NICO_ACTIVITY_EMAILS` (comma list) narrows the page to the
  admins named there. Needs `npm run db:upgrade` once before the first deploy that carries it. "Changes" counts
  events made in the app or through Claude, not sheet or Granola imports.
- Production builds from `main` on each push. Work goes on `maahir/mvp` (each push makes a preview), then merges into
  `main`. A schema change needs `npm run db:upgrade` before that merge.
- Vercel project `nico-desk-v2` serves branch `maahir/mvp-v2` at https://nico-desk-v2.vercel.app on PGlite, since its
  ask columns are not in the Supabase schema.

## What is not built, and why

| Not built | Why |
|---|---|
| Sheet read (FR-40 to FR-43) | Needs read access to a Sheet. The fixtures' Sheet rows show as read-only mirrors |
| Slice 2: Granola drafts, Monday digest, Friday overdue email | Gated in SPEC.md section 1 |
| The OKR page's own tokens and components | `~/Code/Nicobar work` is not on this machine. `app/globals.css` uses the same palette as `docs/team-page`, in one block to swap |
| Sending reminders from the server | Nothing is sent on anyone's behalf without their yes (CLAUDE.md). Drafts open in your own Gmail and you send them |
| Wispr Flow import | Wispr Flow has no key-based API for apps. Its Notetaker has a read-only MCP server for AI assistants, which needs an MCP client with per-user sign-in. Paste the summary instead |

## Layout

- `lib/schema.ts`: the SPEC.md 3.3 DDL (slice 1 tables).
- `lib/seed.ts`: loads `../fixtures`, filling the fields SPEC.md 3.6 adds.
- `lib/derive.ts`: outcome, overdue, silent slips, renegotiation class. Never stored.
- `lib/service.ts`: every read and write, with the role and date rules. Pages and API both use it.
- `lib/plan.ts`, `lib/planUtil.ts`: project pages and plan boards; `app/api/v1/projects/[id]/plan` takes one op per change.
- `lib/http.ts`: the API wrapper: session, same-origin, rate limit, Zod, error shape.
- `app/api/v1/`: the routes. `app/*/page.tsx`: the views. `components/`: chips, task table, forms.
- `tests/core.test.ts`: acceptance checks on the fixtures. `tests/plan.test.ts`: project pages, plan boards, sub-projects, minutes and reminders.
