# nico-desk, local version: what it does and how it is built

This is the spec for the version of nico-desk that runs on your own machine at http://localhost:3100.
It covers what each page does, the rules behind it, how it is built, and how it looks, so anyone on
the team can read it and understand what was built and why. Section 13 lists the decisions the desk
owner (the project lead running this pilot) made along the way.

`SPEC.md` is the pilot spec this version started from. Where the two differ, this file describes
what the app actually does today, and section 13 says what changed.

People are named by role here, not by name, because the repo is public.

---

## 1. What it is for

One place where a small team runs its week:

- who owns what, and by when
- which project each task belongs to, and what changed
- meeting notes turned into tasks
- an honest record of whether dates were kept

The goal from `INTENT.md` still holds: every commitment gets done or is openly renegotiated, without
anyone chasing. Three things follow from it:

- the first date given is never lost
- every change of plan carries a reason
- nothing is sent on anyone's behalf

## 2. Running it

```
cd web
npm install
npm run build && npm start        # or: npm run dev
```

Open http://localhost:3100. The sign-in page offers the desk owner first ("Continue as you"), and
anyone else on the roster below that.

| Command | Does |
|---|---|
| `npm test` | 41 acceptance tests on a fresh in-memory database |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npm run db:reset` | Deletes the local database (stop the server first). It is rebuilt on the next start |
| `npm run job:reminders` | Runs the daily reminder job against the running server |
| `NICO_TODAY=2026-10-09 npm start` | Pins "today", for demos |

**Local files that never go into git:**

| File | Holds |
|---|---|
| `web/roster.local.json` | Real names, titles, emails and access for the 5 team members. `"me"` marks the desk owner |
| `web/projects.local.json` | The 9 sample projects with made-up tasks. Read only when the database is first created |
| `web/.data/pg/` | The database |
| `web/.data/connections.json` | Granola or Fireflies API keys (owner-only file) |

Without these files, the app runs on the synthetic fixtures in `fixtures/`.

## 3. People and access

The pilot team is 5 people, each with a different title and team:

| Role | Title | Team | Access |
|---|---|---|---|
| Desk owner | Project lead | Projects | Lead and admin |
| Business lead | Retention lead | Retention | Lead |
| Brand manager | Brand manager | Brand | Member |
| Founder | Founder | Leadership | Lead |
| Designer | Designer | Design | Member |

| Access | Can do |
|---|---|
| **Member** | See the team's work. Change their own tasks. See their own Ledger card only |
| **Lead** | Everything a member can, plus: change anyone's task, reopen closed tasks, set priority, start and edit projects, send reminders, see the whole Ledger, connect Granola or Fireflies |
| **Admin** | Edit the roster: titles, teams, access, who never gets reminders |

## 4. Pages

The left sidebar holds:
- **Home**, **Team** and **Projects**
- **More**, which opens Ledger, Reminders (leads) and Roster (admins)
- a **+ New task** button

A search bar sits fixed at the top middle of every page.

### 4.1 Home (`/me`)

Your own work, greeted by name ("Good afternoon, \<first name\>").

- **Callouts at the top:** what others are waiting on you for (you were named on their block), and tasks newly assigned to you.
- **Your open tasks, grouped by date:** Late, Today, This week, Later.
- **On each task:**
  - a **tick box** to mark it done in one click
  - a **status dropdown**: picking Not started, In progress or Done applies at once, while picking Blocked or Dropped opens the side panel and asks for the reason first
  - the short description, project, sub-project and note
- **Done this week:** folded away at the bottom.
- **+ New task:** adds a task.

### 4.2 Team (`/team`)

The team's work, looking forward.

- **Week arrows** (this week, previous, next), a **project filter**, and a **Find a person** box.
  Find a person filters by name or title as you type, and Esc clears it. It is there because the list will grow.
- **By person (default): only what is next.** Done work is not shown here. For each person:
  - **Late** (in red), then **This week**, then **Coming up** (tasks due after this week)
  - Coming up shows 3 tasks, with "Show N more"
  - the header reads e.g. "7 ahead · 1 late"
  - people with nothing ahead are listed in one line at the bottom
- **By status:** the week's work grouped by Blocked, Not started, In progress and Done, including what was finished this week.
- **Changing tasks:** every task has the same tick and status dropdown as Home. Clicking a task opens the side panel.

### 4.3 Projects (`/projects`)

The projects as cards ("placards") in a grid of 9, 3 by 3. Each card shows:
- the project name, its category line, phase and launch date with a countdown
- what done looks like
- progress, and counts of open and late work
- the lead
- the project status: On track, At risk or Off track. This is set on the project, separate from task statuses.

Leads get a **+ New project** button (section 6.1).

### 4.4 A project (`/projects/[id]`)

**The header** shows:
- the category line, the name, the launch date ("16 d to go") and the phase
- what done looks like
- the people on the project, each with their role on it, for example "Packaging and photography"
- **Settings** (leads), which edits everything set when the project was started

**Below the header, the project is one of two kinds:**

**Task board** (most projects):

- **Number tiles that filter the table:** Open, In progress, At risk, Late, Done.
- **Person pills:** "Everyone (9)", "Ishaan (2)" and so on. They filter by owner.
- **Sub-projects:** a side list (for example Hampers, Packaging, Photography) with counts.
- **The task table:** tick, task (name, sub-project tag, short description, note, block reason), owner, due date, status dropdown with a flag under it, and edit and drop buttons.
  - A moved date shows "pushed 2×" and the earlier dates struck through.
- **Changes in the row:**
  - Editing opens in the row. Moving the date there asks why.
  - Status changes that need words open a prompt row under the task.
- **Toolbar:** Reminders, Import minutes, + Add task.
- **Further down:**
  - an **Inbox** of proposals from meeting minutes
  - **Completed** tasks, folded away
  - the project's **update log**

**Partner plan** (work with an outside partner, taken from the partner tracker artifact):

- **Tabs:** Lines, Next two weeks, Asks, Rhythm and parked, Log.
- **Lines:** numbered lines of work under pillars. Each line has:
  - an owner on each side, an action and a target date
  - checkpoints
  - a status: Not started, In progress, Blocked or Done
  - a "pending" mark when an owner is missing
- **Tiles:** Open, In progress, Late, Pending, Pushed, Done.
- **Moving a line's date later counts as a push.**
  - The first date is kept and a reason is asked for.
  - If the same person changes their own date within 10 minutes, it counts as a correction, not a push.
- **Removing a line** needs a reason, and the line can be restored.
- **Rhythm and parked:** the meeting cadence and parked items.
- **Log:** an append-only activity log.

### 4.5 Task side panel

Clicking any task, anywhere, opens a panel on the right with:
- the title and description, editable in place
- the 5 status buttons and the flag
- owner, due date ("Change date"), sub-project and a one-line note
- the block reason and who it is waiting on, if blocked
- the date trail ("First given 6 Oct → 8 Oct")
- the full history with reasons
- "Drop task…" and "Open full page"

### 4.6 Full task page (`/tasks/[id]`)

The older full-page view of one task: status, date move, close or drop, block and clear, priority (leads), "Add an update", edit, and the full log.

### 4.7 New task (`/tasks/new`)

A form with these fields:
- title (3 to 200 characters) and a short description (up to 600)
- owner, due date
- project and sub-project
- a one-line note

The sub-project list follows the chosen project.

### 4.8 Ledger (More → Ledger)

The record of who kept their dates, for the last N weeks (4 by default, up to 26). It keeps its
original layout, with two additions:

1. **Summary tiles** and **weekly tables** per person: closed ahead, on time and late, dates moved, and silent slips.
2. **Delivery habits: one card per person**, in name order. It is deliberately not a leaderboard. Each card shows:
   - **Kept on the first date**, as a percentage, with an arrow comparing it to the same length of time before
   - a bar split into **ahead, on time and late**
   - **when late, usually N days**: a one-day slip reads differently from a two-week one
   - **moved dates**: how many moves were made in time (before the date) and how many after
   - **slipped silently**: the date passed with no word. This should be 0
   - **right now**: open, overdue, what they are waiting on others for, and who is waiting on them
3. **Every number is clickable.** It opens the tasks behind that number. For each task you see:
   - owner, project and description
   - the date trail: first date → each move with its reason → how it ended ("closed 7 Oct · 1 day late")
   - a note if it slipped silently

**Who sees what:** leads and admins see everyone. A member sees only their own card and rows.

The Ledger is always worked out from the task history. It is never stored.

### 4.9 Reminders (More → Reminders, leads)

One email per person listing what is late, and optionally what is due within N days, across tasks, plan checkpoints and meeting actions.

**The app never sends anything.**
- "Open in Gmail" opens a filled-in draft in the lead's own Gmail, and the lead presses Send.
- "Mail app" and "Copy" do the same in other mail tools.
- Opening a draft is recorded, so the page shows "reminded 2 days ago".
- People marked "never remind" are listed as skipped.

### 4.10 Search (top bar, Ctrl/⌘+K)

- **What it searches:** projects, tasks, plan lines and people, in one list.
- **Results:** a dropdown as you type. Enter opens the full results page (`/search`).
- **Placement:** top middle of every page, so it is always in the same place and centred over the content.

### 4.11 Roster (More → Roster, admins)

Each person's title, team, access, contact email and "never remind" setting.

### 4.12 Connections (not in the menu)

Where a lead pastes the team's Granola or Fireflies API key once.

- **How you get there:** it was taken off the menu. It is reached from Import minutes, via the "connect Granola" link, when a tool is not connected yet.
- **How the key is handled:**
  - it is checked against the tool before it is saved
  - it is kept only in `web/.data/connections.json`
  - it is shown back as its last 4 characters only

## 5. Statuses, flags and reasons

### 5.1 The 5 statuses a person picks

| Status | Meaning | What it asks for |
|---|---|---|
| **Not started** | Nobody has begun it. Every new task starts here | Nothing. Going back to it after work began asks why |
| **In progress** | Someone is working on it | Nothing, one click |
| **Blocked** | It cannot move | A **block reason** (required). Naming a teammate it waits on is optional, since not every block is a person (a supplier, a printer, a decision). A named teammate sees it in the app as "waiting on you" |
| **Done** | Finished | Nothing, one tick. A note is optional |
| **Dropped** | Not happening | A **reason** (required) |

### 5.2 Flags the app works out (never picked)

| Flag | When |
|---|---|
| **Late** | The date has passed and the task is not done |
| **At risk** | Due within 2 days and still Not started or Blocked |
| **Ahead / On time / Late** | Shown on done tasks, judged against the **first** date given |

Hovering a flag shows why it is there.

**Ahead and At risk used to be statuses a person picked.** They were taken out because they are
judgements, not facts. To warn early that a task will slip, move the date (section 5.4).

### 5.3 Reasons

All reasons are 10 to 280 characters and are kept in the task's history. A screen cannot skip this: the server checks every rule, not only the page.

| Change | Reason needed? |
|---|---|
| Blocked | Yes: the block reason |
| Dropped | Yes |
| Back to Not started after work began | Yes |
| Reopening a closed task (leads only) | Yes |
| Moving a date | Yes |
| Not started → In progress | No |
| Clearing a block | No, a note is optional |
| Done | No, a note is optional |

Partner plan lines follow the same rule: Blocked, back to Not started, and reopening need a reason; starting and Done are one click.

### 5.4 Dates

- **The first date is locked.**
  - The date a task is first given (`first_due_on`) can never change; a database trigger guards it.
  - The Ledger judges every task against it.
- **Moving a date** always keeps the first date and needs a reason.
  - Before the date passes, the move counts as **moved in time**, which is the good habit.
  - After the date passes, it counts as **moved after the date**.
- **Slipped silently** means the date passed with no move and no close.

## 6. Projects

### 6.1 Starting a project (leads)

**+ New project** opens a form. You need 4 things to start:

| Needed | Rule |
|---|---|
| Name | 2 to 80 characters, unique in the team |
| Kind | Task board or Partner plan (it can't be changed later) |
| What done looks like | One or two sentences, at least 10 characters |
| Project lead | Defaults to you |

**Optional, now or later in Settings:**
- a category line (e.g. "Gifting · Hampers · Corporate orders")
- a date and what kind of date it is: Launch, Go-live, Send date, Event date, End date or Quarter end
- a phase (e.g. "Sampling")
- **people and their role on this project**, e.g. "Packaging POC"
- **sub-projects** on a task board, or **pillars** on a partner plan (pillars are required)
- for a partner plan: the partner's name and their people

Settings edits the same fields. Renaming a pillar keeps its lines under it.

### 6.2 Where tasks are added

- Inside a project: "+ Add task" on its board.
- Anywhere: "+ New task" in the sidebar or on Home. A task can have no project, for one-off weekly work.
- From meeting minutes (section 7).

### 6.3 The 9 sample projects

Made up for the local version, with no real tracker data:
- Monthly newsletter
- Festive gifting
- End of season sale
- Autumn landing page
- Instagram content calendar
- Loyalty tier pilot
- Campaign shoot plan
- Store refresh, Bandra
- AI studio partnership (a partner plan)

## 7. Meeting minutes

**Import minutes**, on any project, has 4 tabs:

| Tab | How |
|---|---|
| **Paste** | Paste notes from anywhere |
| **Granola** | Pick from the team's recent Granola meetings (public API, team workspace key) |
| **Fireflies** | Pick from recent Fireflies meetings (GraphQL API). Their action items are read per person |
| **Wispr Flow** | Paste only. Wispr Flow has no public API |

**How minutes become tasks:**
1. The app reads the "Next steps", "Action items", "To-dos" or "Follow-ups" section.
   - Lines like "(Name) task by 14 Oct" or a bold name heading followed by tasks are understood.
2. Each step becomes a **proposal** in the project's Inbox.
   - The app matches it to a teammate and a sub-project.
3. Someone **accepts, edits or rejects** each proposal. **Nothing changes until someone accepts.**
   - A proposal needs an owner and a date before it can be accepted.
   - On a task board an accepted proposal becomes a task; on a plan it becomes a line.
4. A meeting that was already imported into a project is refused, so nothing is added twice.

**About the AI reader:** without an `ANTHROPIC_API_KEY`, a plain parser does the reading. With the key set, the minutes are sent to the Anthropic API to suggest better proposals, so only set it if that is fine for the notes being pasted.

## 8. Data model

The database is Postgres. Locally it runs as PGlite, Postgres compiled to WASM inside the app, with no install needed. The schema is in `web/lib/schema.ts`.

| Table | Holds |
|---|---|
| `teams`, `people`, `team_members` | The roster, roles, contact email, "never remind" |
| `projects` | Name, kind (`tasks` or `plan`), lead, goal, category line, phase, date and its label, sub-projects or pillars, partner, cadence, status |
| `project_members` | Each person's role on a project |
| `tasks` | Title, description, owner, project, sub-project, `first_due_on` (locked), `due_on`, note, status, block reason and optional person, priority, version |
| `events` | **Append-only** history of every field change, with the reason. The Ledger and logs are built from it |
| `notices` | In-app notices: due tomorrow, due today, overdue, blocked on you, assigned |
| `plan_lines`, `plan_checkpoints`, `plan_actions`, `plan_asks`, `plan_parked` | Partner plans |
| `plan_proposals` | Proposals from meeting minutes, for both kinds of project |
| `plan_activity` | **Append-only** log for plans |
| `reminders` | A record that a reminder draft was opened. Never the email itself |

**Rules held by the database or the service layer:**
- the first date is locked
- history tables are append-only
- every write checks the task's `version`, so two people can't overwrite each other's changes
- a block always has a reason (a person is optional)
- Ahead, on time, late, overdue and silent slips are **worked out from the history, never stored**

**About the status field:** a task's picked status is stored in `health`: `not_started`, or `on_track` (shown as In progress). Older `ahead` and `off_track` values read as In progress.

**Upgrades:** an older local database upgrades itself on start (`upgrade()` in `lib/db.ts`), so local data survives.

## 9. API

Everything the pages do goes through `/api/v1`. Every request needs a signed-in session from the same site. Bodies are checked with Zod, and errors come back as `{ error: { code, message, field } }`.

**Tasks:**

| Route | Does |
|---|---|
| `GET/POST /tasks` | List, create |
| `GET/PATCH /tasks/[id]` | Read, edit title, description, note, owner, sub-project |
| `POST /tasks/[id]/health` | `not_started` or `on_track` (In progress), with a reason when going back |
| `POST /tasks/[id]/block` | `{ ask, onId? }`: block reason required, person optional |
| `POST /tasks/[id]/unblock` | `{ note? }` |
| `POST /tasks/[id]/close` | `{ as: 'done' \| 'dropped', reason? }`: a reason is required to drop |
| `POST /tasks/[id]/reopen` | Leads only, with a reason |
| `POST /tasks/[id]/renegotiate` | New date plus a reason |
| `POST /tasks/[id]/priority` | Leads only |
| `POST /tasks/[id]/updates` | Add an update to the log |
| `GET /tasks/[id]/log` | History |

**Team and personal views:**

| Route | Does |
|---|---|
| `GET /me/tasks` | My tasks |
| `GET /me/notices`, `POST /me/notices/[id]/read` | Notices |
| `GET /teams/[id]/week`, `/by-status`, `/ledger`, `/people` | Team views |

**Projects:**

| Route | Does |
|---|---|
| `POST /projects`, `GET/PATCH /projects/[id]` | Start and edit projects |
| `GET/POST /projects/[id]/plan` | Plan state, and one operation per change (lines, statuses, checkpoints, minutes, proposals) |

**Reminders, connections and search:**

| Route | Does |
|---|---|
| `GET/POST /reminders` | Drafts, and recording that one was opened |
| `GET/POST/DELETE /connections` | Connect or disconnect Granola or Fireflies |
| `GET /connections/[provider]/meetings`, `/meetings/[id]` | List and read meetings |
| `GET /search?q=` | Search |

**Other:**

| Route | Does |
|---|---|
| `POST/DELETE /session` | Local sign-in and sign-out |
| `PATCH /people/[id]` | Roster edits (admins) |
| `POST /jobs/reminders` | The daily in-app notice job |

## 10. How it is built

| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5.9 |
| Database | PGlite 0.5 (Postgres in WASM), data in `web/.data/pg` |
| Validation | Zod 4 |
| Tests | Vitest, 41 tests on a fresh in-memory database |
| Sign-in | A roster picker, on only with `NICO_DEV_SIGNIN=1`. Google sign-in is not built yet |

**Code map (`web/`):**

**`lib/`: rules and data**

| File | Holds |
|---|---|
| `lib/service.ts` | **Every task rule.** Pages and the API both call it, so a rule can't be skipped |
| `lib/plan.ts`, `lib/planUtil.ts` | Projects, partner plans, minutes to proposals |
| `lib/derive.ts` | Outcomes, overdue, silent slips. Worked out, never stored |
| `lib/reminders.ts`, `lib/connectors.ts`, `lib/search.ts` | Reminders, Granola and Fireflies, search |
| `lib/schema.ts`, `lib/db.ts`, `lib/seed.ts` | Schema, database start and upgrades, seeding from fixtures and the local files |

**`app/` and `components/`: pages and screens**

| File | Holds |
|---|---|
| `app/*/page.tsx` | The pages |
| `app/api/v1/` | The API |
| `components/task-ui.tsx` | The shared task row, status dropdown, flags, side panel and pop-up |
| `components/TaskBoard.tsx`, `PlanBoard.tsx` | The two kinds of project board |
| `HomeView.tsx`, `TeamView.tsx`, `LedgerView.tsx`, `Minutes.tsx`, `ProjectForm.tsx`, `TopSearch.tsx` | The other main screens |
| `app/globals.css` | All styling and design tokens |

## 11. Design

Calm and warm, built for reading at a glance. One idea per screen, and a fixed place for everything.

**Colours** (tokens on `:root` in `globals.css`; dark mode redefines them):

| Token | Colour | Used for |
|---|---|---|
| `--bg` | `#f5f2ec` warm off-white | Page background |
| `--surface` | `#ffffff` | Cards, tables |
| `--side` | `#1e1b17` near-black | Sidebar |
| `--accent` | `#b5532c` terracotta | Main buttons, active nav |
| `--text` / `--muted` / `--faint` | `#1f1c18` / `#6e675c` / `#9a9284` | Text levels |
| `--black` | `#3b3631` | Not started |
| `--amber` | `#b7791f` | In progress, At risk |
| `--red` | `#c4432b` | Blocked, Late |
| `--purple` | `#7b4fc0` | Done |
| `--green` | `#2f855a` | Ahead, On time |

**Type:**
- Fraunces (serif) for page titles and big numbers
- Inter for everything else
- JetBrains Mono for code

**Patterns:**
- **A colour always comes with a word:** status pills have a dot and a word. Colour is never the only signal.
- **One line per task:** title, a short description under it, then project and sub-project in grey. Owner, date and status sit on the right.
- **Flags are small outlined capitals under the status** (LATE, AT RISK). They look different from the statuses on purpose, because nobody picks them.
- **Late dates are red** and show "2 days late". A moved date shows ↻2 or "pushed 2×".
- **Details open in a side panel, not a new page**, so you never lose your place.
- **Questions appear where you are:** a prompt row under the task, or a form in the side panel. They never sit on a separate page.
- **Number tiles filter what's below them.** Every number on the Ledger opens the tasks behind it.
- **Corners and spacing:** rounded 12px corners, light shadows, generous spacing.
- **Phones:** every page works at phone width with a 16px side margin and no sideways scrolling.

## 12. Privacy and safety rules

- **No real company data in git:** no real tracker tasks and no customer data. The 9 projects are made up.
- **No people's names in repo files**, only roles. Real names live in the git-ignored `roster.local.json`.
- **Nothing is sent on anyone's behalf.** Reminders open as drafts in the lead's own mail.
- **API keys** stay on the server in a git-ignored, owner-only file. They are never sent to the browser.
- **No recording.** Recording meetings needs everyone's consent and a storage rule first, so the app reads notes from tools the team already uses.

## 13. Decisions the desk owner made (and why)

| Asked for | What was built |
|---|---|
| Indian names, and a better look | Warm palette, serif titles, dark sidebar; Indian names on the local roster |
| A desk in the desk owner's name | Sign-in offers the desk owner first; Home greets them by name |
| Features from the desk owner's tracker artifacts | Partner plans, checkpoints, asks, pushes, minutes to proposals, number tiles, person pills, sub-projects |
| **No real tracker tasks** | Only the features were taken. All tasks and projects are made up |
| A team of 5, each with a different role | The roster in section 3. The founder is listed as Founder |
| A project-wise view | Projects page and a page per project |
| Projects as boxes | A 3 × 3 grid of cards, one per project |
| The table board over the calmer version | The task table is back, with a short description on every task |
| Starting projects, not just tasks | + New project: what is needed to start, people and their roles, date, partner |
| Check off tasks from my own list | Tick box on Home |
| Change status from Home too | Status dropdown on every task on Home and Team |
| The app felt cluttered | Fewer menu items (More group), one line per task, details in a side panel |
| Import notes from Wispr Flow, Granola, Fireflies | Granola and Fireflies by API key, Wispr Flow by paste (no public API) |
| Reminders that can be sent | Drafts open in your own Gmail and you press Send |
| Search, always in the same place | Fixed at the top middle |
| Ledger: who's on time and who's delayed, not drastically different | Same page, plus one delivery-habits card per person (not a leaderboard), and every number opens the tasks and reasons behind it |
| A reason when status changes or a date is pushed | Reasons required (section 5.3), checked by the server |
| Team view should look forward, not back | By person shows only Late, This week and Coming up |
| Find a person in a long list | Find a person box on Team |
| Fewer, clearer statuses | Not started, In progress, Blocked, Done, Dropped. Ahead, At risk and Late are flags the app works out |
| Not every block is a person | Blocked needs a block reason; naming a teammate is optional |
| Remove the Connections tab | Off the menu; reached only from Import minutes when needed |

## 14. Not built yet

| Not built | Why |
|---|---|
| Google sign-in | No Google client issued yet. Local sign-in is a roster picker |
| Reading department Google Sheets | Needs access granted for that purpose. Sheet rows show as read-only mirrors in the fixtures |
| Notifications bell | Explained but not built. In-app notices exist (due today, overdue, blocked on you, assigned) and appear as callouts on Home |
| Sending reminders from the server | Nothing is sent on anyone's behalf without their yes |
| Hosting for the team | No hosted database chosen yet. This version runs on one machine |
| Wispr Flow import | No public API |

## 15. How to check it works

```
cd web
npm test            # expects 41 passed
npm run typecheck   # no errors
npm run build       # succeeds
```

The current version was also checked by hand in Chrome, at desktop and phone width, with no errors:
- Home, Team (search and status dropdown), all 9 project boards, the Ledger and search
- the block, drop and status forms
