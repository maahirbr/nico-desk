# Plan: the setup check-list and the run-the-meeting view

Status: part 1 built and committed 20 Oct (1e02659), not pushed or deployed. Part 2 waits for G1 and G2 below.
Work happens on `maahir/mvp`. Build part 1 first, then part 2. One Sonnet agent per part, one commit per part.
Read `CLAUDE.md` (all four sections), `DESIGN.md`, `docs/DESIGN-19-OCT.md` (how both features look) and `docs/ROADMAP.md` "Next (week of 19 Oct)" first.
The repo is public.

Why these two: the second team starts 19 Oct. Each project lead sets up a project and then runs its meeting in the
app (ROADMAP "Who does what"). Both use cases are marked "Still needed" in the ROADMAP table.

## Gates (ask before building part 2)

| # | Question | Who decides | Default if no answer |
|---|---|---|---|
| G1 | Meetings came off the project pages on 14 Oct, at the PM's call (DECISIONS 2026-10-14). Part 2 brings a meeting surface back, as its own page, not the old box. Yes or no? | the PM | Build part 1 only, without the rhythm step. |
| G2 | Today only the task owner or a team lead (app role `lead` or `admin`) may close, move or block a task. A project lead who is a plain member cannot change other people's tasks in their own project. Let the project's owner and lead change tasks in that project? | the repo owner | Part 2 shows actions only on tasks the person may already change. The rest read "Only the owner or a lead can change this." |

Record each answer in `docs/DECISIONS.md` before the code that depends on it.

## What exists (facts, checked 19 Oct)

- `lib/meetings.ts`: `mayRunMeeting`, `setMeetingRhythm`, `markMeetingHeld` (refuses `already_held` on the same
  day), the pure `buildAgenda` and the loader `meetingAgenda(db, me, projectId, today)`.
  - Sections, in order: late, blocked, at_risk, soon, lines, asks, actions, changed, finished, comments.
  - Each section has `rows` (capped at `SECTION_CAP = 25`) and `more`.
  - `AgendaRow = { id, taskId | null, title, note, tone? }`.
- Storage: `projects.meet_every`, `meet_day`, `meet_next`, `meet_last`, plus `events` rows (`meeting_rhythm`,
  `meeting_held`). There is no per-meeting table and no minutes table.
- Routes: `GET`/`PUT /api/v1/projects/:id/meeting`, `POST /api/v1/projects/:id/meeting/held`. All still live and
  tested in `tests/meetings.test.ts`.
- `components/MeetingSection.tsx` still exists. Only `IMPORT_EVENT` is used from it today. It is not mounted.
- Task writes (`lib/service.ts`): `createTask`, `renegotiate` (the only way to move a date, reason required),
  `closeTask` (`as: 'done' | 'dropped'`, dropped needs a reason), `blockTask` (ask 1 to 280 characters),
  `unblockTask`. Client helpers in `components/task-ui.tsx`: `api`, `quickMove`, `moveWithWords`, `Modal`,
  `AddTaskForm`.
- Plan writes: `planOp` in `lib/plan.ts` (`status`, `editLine`, `tickAsk`, `tickAction`, `removeAction`, minutes
  ops). There is no op to add an action directly. `plan_actions` stores `owner_name` as text, not a person id.
- Undo: `useUndo()` and `canUndo` (`lib/undo.ts`) cover task changes. The plan board has no undo.
- Project setup: `ProjectForm.tsx` is both "Start a Project" and the Settings modal. It has no rhythm field.
  Members live in `project_members`. Empty boards say "No tasks in this project yet." or "No lines in this plan yet."
- No check-list, wizard or step-through component exists. `GuideNote` and `useRemembered` keep per-person view
  state in localStorage. There is no server-side onboarding flag.

## Part 1: the setup check-list for a new lead

### What it is

A card at the top of a project page, above the board. It lists the few things a new project needs before its first
meeting. Each step is ticked from data the app already holds, so nothing is stored to mark a step done. The card goes
away when every step is done, or when the person hides it.

### Who sees it

- The project's owner, its lead, a team lead and an admin (the same test as `canEdit` in
  `app/projects/[id]/page.tsx`).
- Members and viewers do not see it.
- In View as, the card shows as the viewed person would see it, with no buttons.

### The steps

| Key | Words on the card | Done when | The button opens |
|---|---|---|---|
| `members` | Add the people who work on it | `project_members` has at least one person who is not the owner or lead | The Settings modal, on the people field |
| `work` | Add the first tasks (task board) / Add the first lines (plan board) | One task or one plan line exists | `AddTaskForm` / the add-line form |
| `rhythm` | Set when the team meets | `meet_every` is set. Only if G1 is yes. | The rhythm form from `MeetingSection.tsx` (`RhythmForm`), in a `Modal` |
| `minutes` | Bring in the first minutes | A `meeting_held` event, a `plan_proposals` row or an accepted action exists for the project | The existing Import minutes panel (`IMPORT_EVENT`) |
| `partner` | Name the partner (plan board only) | `partner_name` is set and is not the default "Partner" | The Settings modal |

Order matters: the steps show in the order above, and the first open step carries the only primary button. The others
are outline buttons. That keeps one primary button per screen (DESIGN.md Buttons).

### Build

- `web/lib/setup.ts`, pure: `setupSteps(input) => { key, done, title, action }[]`, where `input` holds the project
  kind, member count, work count, `meet_every`, the minutes signal, `partner_name` and a `meetingsOn` flag (G1).
- A loader `setupState(db, me, projectId)` that runs the counts in one query each. It returns `null` for anyone who
  is not owner, lead, team lead or admin, and for archived projects.
- `web/components/SetupList.tsx`, a client component. Props: the steps, `projectId`, `kind`. It listens for the same
  events the board fires after a write, then calls `router.refresh()` so a step ticks without a reload.
- Hide: "Hide this list" stores `viewKey(meId, 'setup:' + projectId)` through `useRemembered`. Hidden lists do not
  come back on their own. The project's Settings modal gets a quiet link "Show the setup list" that clears the key.
- Mount in `app/projects/[id]/page.tsx`, above the board, for both kinds.
- No schema change. No new API route. Every write goes through the forms and routes that exist.

### Look and words

The full design is `docs/DESIGN-19-OCT.md` section 1. It wins over this summary.

- One card (`{rounded.card}`, `{colors.surface}`, 20px padding, level 1 shadow, no shadow at night).
- Heading "Set up this project" in `{typography.heading}`. A count "2 of 4 done" in `{typography.small}`. No eyebrow.
- Each step is one row: a tick mark, the step words in `{typography.line}`, the button on the right. Rows split by a
  hairline, 12px top and bottom.
- A done step keeps its row, with the tick drawn and the words in `{colors.ink-2}`. The tick draws over
  `--dur-draw-tick`, the same motion as a checkpoint tick. Reduced motion shows it at once.
- When the last step ticks, the card says "Ready for the first meeting." for `--dwell-confirm`, then folds away with
  `--dur-fold`.
- Phone (860px and under): the button drops under the words, full width, 40px tall.
- Help terms in `components/help.ts`: `setup_list` ("The few things a new project needs before its first meeting.
  Each step ticks itself when it is done."). `tests/help.test.ts` must pass.
- `/guide`, section "For leads and admins": one line about the list.

### Tests (`web/tests/setup.test.ts`)

- `setupSteps` on its own: each step done and not done, both kinds, the `rhythm` step absent when `meetingsOn` is
  false, the `partner` step only on plan boards.
- `setupState` on fixtures: a new project made with `createProject` (as in `tests/meetings.test.ts` `mk()`) starts
  with no step done. Adding a member, a task and a rhythm ticks each one.
- Who: `per_ada` (lead) and `per_fay` (admin) get steps. A plain member gets `null`. An archived project gets `null`.
- No write happens when the page loads (count the `events` rows before and after).

## Part 2: the run-the-meeting view (after G1)

### What it is

A page the lead opens when the meeting starts: `/projects/[id]/meeting`. It walks the agenda that
`meetingAgenda` already builds, one item at a time. The lead acts on each item as the team talks, adds new action
items, and ends with "Meeting held". Everything goes through the normal service rules, so the board, Home and the
update log show the same changes at once.

It is not the old meeting box. The project page gets only a button "Run the meeting" in `ProjectHeader`, shown to
people who pass `mayRunMeeting`.

### The flow

1. **Agenda.** The sections from `buildAgenda`, in its order, skipping empty ones. `comments` is skipped while
   comments are off (DECISIONS 2026-10-14). The current item is open, the rest are one line each.
2. **New business.** A short form to add action items: what, owner, due date. Repeat as needed.
3. **Close.** A summary of what changed in this meeting, the next date from `nextAfterHeld`, and the "Meeting held"
   button (`POST .../meeting/held`). After it: "Copy the notes" puts a plain text summary on the clipboard. The app
   sends nothing.

### Actions on the current item

| Item | Actions | Service call |
|---|---|---|
| Task (late, blocked, at_risk, soon) | Done, Move the date, Block / Unblock, Next | `closeTask` as done, `renegotiate` (reason required), `blockTask` (ask required) / `unblockTask` |
| Plan line | Set status, Move the date, Next | `planOp` `status` (reason for Blocked or Not started), `editLine` with `dateReason` |
| Ask | Done, Next | `planOp` `tickAsk` |
| Action | Done, Next | `planOp` `tickAction` |
| Changed, finished | Next | none, read only |

- "Next" changes nothing. It only moves the focus.
- Dropping a task stays on the task drawer, not here. The meeting view keeps to the five verbs the lead needs most.
- If G2 is no, an action the person may not take is hidden, and the row says "Only the owner or a lead can change this."

### Adding an action item

- Task board: `createTask` with `projectId`, owner and due date. The due date must not be in the past (existing rule).
- Plan board: a new `planOp` op `addAction { task, ownerName, ownerWith?, dueOn?, lineId? }`. It inserts into
  `plan_actions` like `accept()` does, with `source = { title: 'Meeting', date: today }` and `proposal_id` null, and
  logs "added action ... from the meeting". Same visibility gate as the other ops.
- The owner picker uses the project's people first, then the team.

### The session list

- The page keeps a list of what the lead did in this meeting, in client state only: done, moved (old date, new date,
  reason), blocked, new actions. It is built from the API answers. Nothing new is stored.
- A reload loses the list, not the changes. The close step says so in one line.
- "Copy the notes" turns the list into plain text: project name, date, then one line per change. No names beyond the
  owners already on the tasks.

### Undo

- Task changes use `useUndo().announce`, so the toast offers Undo for `UNDO_DWELL_MS`, under the same `canUndo` rules.
- Plan ops have no undo today. Their toast says what changed, without Undo. Adding plan undo is out of scope.
- An undone change also leaves the session list.

### Who can use it

- The page: anyone who can see the project. People who fail `mayRunMeeting` see the agenda read only, with no
  buttons and no "Meeting held".
- View as: read only. `route()` already refuses every non-GET call with `viewing_as`. The client hides the buttons
  through `useReadOnly()`.
- Hidden project: `notFound()`, as on the project page.

### Keys

Add to `SHORTCUTS` in `components/keys.ts`, active only on this page, never while typing (`isTyping`) or inside a
modal:

| Key | Does |
|---|---|
| `j` / `k` | Next item / previous item |
| `d` | Done on the current item |
| `m` | Move the date |
| `b` | Block or unblock |
| `s` | Set the status (plan line) |
| `a` | Add an action item |

The Guide and the Shortcuts pop-up read from `SHORTCUTS`, so they update on their own.

### Look and words

The full design is `docs/DESIGN-19-OCT.md` section 2. It wins over this summary.

- One column, max width as the project page. The section headings in `{typography.heading}` with a count in
  `{typography.small}`.
- The current item is a card. The others are rows with a hairline between them. Late and Blocked use `{colors.late}`,
  At risk uses `{colors.off}`. Nothing else takes a colour.
- The date on the current item is the biggest text on its line (`date-lg`, tabular figures).
- Moving between items: `fadeShift` under 200ms. The Move and Block forms open in `Modal` (`modalMotion`).
  A done tick draws over `--dur-draw-tick`. Reduced motion makes all of it instant.
- Phone: the actions sit in a bar at the bottom of the current card, 40px buttons, wrapping to two rows if needed.
- Words: Done, Move the date, Block, Unblock, Next, Add an action, Meeting held, Copy the notes. Never
  "renegotiate", "outcome", "event" or "approve". No exclamation marks. Title Case only on form labels and headings.
- Help terms: `meeting_run`, `meeting_new_business`, `meeting_notes`. The existing `meeting_agenda` and
  `meeting_held` terms are reused.
- Every reason, ask and action field follows the mobile keyboard rule. `KeyboardDismiss` covers taps outside, return
  and scroll. Check that return in a reason field submits the form and closes the keyboard.

### Build

- `app/projects/[id]/meeting/page.tsx`: server page, `force-dynamic`, `requireMe()`, `projectFor` (404 if hidden),
  loads `meetingAgenda` and the project people.
- `components/MeetingRun.tsx`: the client view. It reuses `api`, `Modal`, `moveWithWords` and the forms in
  `task-ui.tsx`. No copy of their logic.
- `lib/plan.ts`: the `addAction` op and its type in `PlanOp`.
- If G2 is yes: widen the task write check in `lib/service.ts` (`mutate()`) to accept the project's `owner_id` and
  `lead_id` for tasks in that project. This also changes the board and the drawer, on purpose. Update `canUndo` so a
  project lead counts as a lead for that project's tasks.
- `ProjectHeader.tsx`: the "Run the meeting" button.
- No schema change unless G2 needs one (it does not: owner and lead are columns already).

### Tests

- `tests/meeting-run.test.ts`:
  - The page loader: a hidden project is a 404. A member gets the agenda without run rights.
  - Each action on a fixture task through the real routes: done, move with reason, move without reason refused,
    block, unblock. The agenda after each one has the item in its new section.
  - `addAction` on `prj_studio`: inserts one `plan_actions` row, logs once, refused on an archived project, refused
    for a project the person cannot see.
  - New action on a task board: `createTask` with `projectId`, past date refused.
  - View as: every write route answers 403 `viewing_as`.
  - Meeting held twice on one day: `already_held`.
- If G2 is yes: a project lead who is a plain member can close, move and block a task they do not own in their
  project, and still cannot in another project. Add these next to the existing "project lead who does not own it"
  test in `tests/archive.test.ts`.
- `tests/help.test.ts`, `tests/motion-rules.test.ts` and `tests/guide.test.ts` pass with the new terms and keys.

## VERIFY (both parts)

```
python3 -I evals/meetings/check.py
python3 -I evals/paste/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/
cd web && rm -rf .next && npm run typecheck && npm test && npm run build
```

Expected: `OK: 20 cases` twice, no grep output, typecheck silent, the test count above 742 with none failing, build
green. Update the count in `CLAUDE.md` VERIFY to the new number.

Then run the app (`npm run dev --prefix web`, port 3100) and check, at desktop and 375px, day and night, in the
Warm and Cool skins:

- A new project as `per_ada`: the list shows, each step ticks after its form, the list folds away.
- The same project as a plain member: no list.
- `/projects/prj_landing/meeting` and `/projects/prj_studio/meeting`: walk every section with the keys, add an action,
  press Meeting held, copy the notes.
- View as a member: no buttons on either surface.

## DECISIONS lines to add (bottom of `docs/DECISIONS.md`)

- `2026-10-xx · <model> · Setup check-list for a new lead.` Derived from data, hidden per person in the browser, no
  schema. Rollback: `git revert` the commit.
- `2026-10-xx · <model> · The PM's answer to G1.` Quote the answer in plain words.
- `2026-10-xx · <model> · Run-the-meeting page and the addAction op.` Rollback: `git revert` the commit. No data to
  remove, since `plan_actions` rows made by it are ordinary actions.
- If G2 is yes: `2026-10-xx · <model> · A project's owner and lead may change that project's tasks.` Rollback:
  `git revert` the commit.

Then update `docs/ROADMAP.md`: the two "Still needed" cells become built, with the date.

## Rules for the session that builds this

These come from `CLAUDE.md` and the global rules. They bind.

- **Ask first:** push, deploy, any live database change, and anything sent. Each yes covers one action.
  Commits and `CLAUDE.md` edits go ahead.
- **No hosted data.** Never read rows from the production database. Never read or print `.env*` values or secrets.
  Never open `web/.data` or `web/pilot`. Test on PGlite with the fixtures only.
- **No schema change is planned.** If one turns out to be needed, it goes into `upgrade()` too, and the hosted
  database needs `npm run db:upgrade` (run by the repo owner) before the build is promoted.
- **Never** run `db:remote` on production without `NICO_ROSTER=pilot/roster.local.json`. Never promote `nico-desk-v2`.
- **Public repo.** No real names (use roles), no real Nicobar data, no credentials, no internal URLs. Fixtures stay
  synthetic. The denylist grep must stay empty.
- **One rule set.** Every write goes through `lib/service.ts` or `planOp`, behind `route()`. No write path outside
  `route()` without `assertNotViewing`. Undo is a new change, never a delete.
- **Status words** are the five only. Late, At risk and Ahead are flags from dates, never picked.
- **Nothing sent.** "Copy the notes" copies. No email, chat or nudge goes out.
- **Model use.** The run view and the list call no model. Jev stays synthetic-only.
- **Design.** `DESIGN.md` is the only visual reference. Tokens from `web/app/tokens.css` only, a new value goes into
  both files in one commit. No eyebrows, no em dashes, no exclamation marks, no whimsy, no new colours.
- **Motion** is transform and opacity, under 300ms, and stops under reduced motion.
- **Mobile keyboard rule** for every new field: tap outside, return or scroll closes the keyboard.
- **Help** terms for every new control. Shortcuts only through `SHORTCUTS`.
- **Agents** get an explicit model: Sonnet for build agents.
- **Commit trailer:** `Co-Authored-By: <the model> <noreply@anthropic.com>`.
- **Done** means VERIFY green, the browser check done at both widths in both themes, the DECISIONS lines written, and
  `CLAUDE.md` VERIFY count updated.
