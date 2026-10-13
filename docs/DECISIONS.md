# Decisions log

Append-only. Each entry: date · model · the change and the why, then a Rollback line. New entries go at the bottom.
Moved here from `CLAUDE.md` on 2026-10-13 to keep that file short; `CLAUDE.md` keeps the rules that still bind.
An entry that replaces an earlier one says so; the earlier text stays as written.

- 2026-09-30 · Opus 5.5 · Repo created as `nico-desk`, separate from `~/Code/Nicobar work` (the OKR
  page) and `~/Code/nicobar-recs`: the hub spans teams and sources, and the OKR page may become
  one part of it (open question 6 in `HANDOFF.md`) rather than the other way round. Meeting
  minutes default to reading Granola, which already feeds the tracker, not building a recorder.
- 2026-10-08 · Sonnet 5.5 · Repo made public at the repo owner's call, replacing the earlier "stays
  private" rule. I advised keeping it private, since a private repo also takes collaborators. Four
  teammates will be added as collaborators. Risk: public content can be cached or indexed.
  Rollback: set the repo private again with `gh repo edit maahirbr/nico-desk --visibility private
  --accept-visibility-change-consequences`. Copies already taken stay out of our reach.
- 2026-10-08 · Fable 5.1 · `INTENT.md` stays hand-written. No model edits it, because the teammate
  who drafted it found the model-written version unclear. Three intent files get compared
  (`INTENT.md`, `docs/INTENT-FABLE.md`, one by the repo owner) and one is kept. Granola is read
  through its public API with an admin-made workspace key, never a personal key, so no one person's
  credential carries the pipeline. Names in repo files were replaced with roles, since the repo is
  public. Vendor product screenshots sit in `docs/team-page/img/` for the comparison gallery; they
  come from the vendors' public pages and go if any vendor objects.
- 2026-10-08 · Opus 5.5 · The "`INTENT.md` stays hand-written" rule above is lifted for one
  rewrite. The teammate who drafted `INTENT.md` asked a model to rewrite it around the problem,
  the evidence and the goals, using an example intent file as the shape. The rewrite adds the
  overarching goal (every commitment gets done or openly renegotiated, without chasing), the
  sponsor's four pain points, the founder's and a business lead's use cases, and the four team
  types. Further model edits still need that teammate's ask. The three-way comparison with
  `docs/INTENT-FABLE.md` and the repo owner's file still stands. Rollback: `git revert` commits
  `0782139` to `38c6555`.
- 2026-10-08 · Opus 5.5 · Granola is read through each note-taker's own MCP sign-in, with their
  yes. This replaces "workspace key, never a personal key" above: Nicobar has no organisation-wide
  Granola licence, so no workspace key exists. Risk: ingestion depends on personal connections, and
  on the free plan MCP sees only the last 30 days of personal notes. A meeting's tasks come through
  whoever took its notes, so no one account carries the whole team. Open question 9 in `INTENT.md`.
- 2026-10-09 · Opus 5.5 · In `web/`, task status is picked from five words (Not started, In
  progress, Blocked, Done, Dropped); ahead, at risk and late are flags the app works out from the
  dates, at the call of the teammate who owns the local desk. This replaces SPEC.md FR-10 to
  FR-12's picked health and the Red rule: an early warning is now a date move. Blocked needs a block
  reason (a teammate it waits on is optional, since not every block is a person), dropped needs a
  reason; starting and done are one click. Rollback: revert the commit that makes this change.
- 2026-10-09 · Fable 5.1 · The sheet-language constraint is lifted for nico-desk at the repo owner's
  call, after they reviewed the v1 and rejected its direction (dull, hard to understand, the
  colleague dependency invisible). The redesign is briefed in `docs/DESIGN-HANDOUT.md` v2: three
  roles, five functions, the ask as the central object, three mood sketches before any build.
  The company name and public context are allowed in fixtures so the demo reads as Nicobar; the
  name is removed from `fixtures/denylist.txt`. The repo owner also said to bypass anything blocked
  on them: commits and `CLAUDE.md` edits proceed without a wait; push, deploy and sends still ask.
  Rollback: restore the two CONSTRAINTS lines and the denylist line from this commit's parent.
- 2026-10-09 · Opus 5.5 · Mood A (plain and familiar: Geist, white, one blue, pills) picked for
  the redesign, since the repo owner had not replied to the mood page and asked me to pick. It
  reads as an ordinary work tool on first use, which is the bar. Mood B stays a candidate for
  the lead and founder pages if A reads too soft there. `DESIGN.md` now outranks the handout on
  anything visual. Rollback: `git revert` this commit and pick again from `docs/design/moods.html`.
- 2026-10-09 · Opus 5.5 · The PM's app (branch `local-desk`) is the baseline for the MVP, at the repo
  owner's call, on branch `maahir/mvp`. The owner's own app on `maahir/v2-hosting` stays as a source
  of features. Its spec moved to `docs/LOCAL-DESK-SPEC.md` so no filename carries a name. The company
  name left `fixtures/denylist.txt` again, per the entry above. Rollback: point Vercel back at
  `maahir/v2-hosting`.
- 2026-10-09 · Opus 5.5 · Hosted without a database for now, at the repo owner's call: on Vercel
  with no `DATABASE_URL`, each instance seeds PGlite in tmpdir, so edits do not last and can differ
  between page loads. Setting `DATABASE_URL` and running `npm run db:remote` moves it to Supabase.
  Sign-in is removed for the demo (`NICO_OPEN_DEMO=1`) at the repo owner's call: a visitor is the
  team lead. Secrets are derived when unset, which is acceptable only for synthetic data with no
  real sign-in. Earlier the same day `maahir/v2-hosting` reached production by mistake (the API
  ignored the preview target); it was replaced by `maahir/mvp`. Rollback: unset `NICO_OPEN_DEMO`
  on Vercel and redeploy, which brings back the roster picker.
- 2026-10-09 · Opus 5.5 · The PM's app restyled to `DESIGN.md` mood A: white, Geist, one blue,
  quiet flag text, three motion gestures, the keyboard rule. Features and screens unchanged.
  Rollback: `git revert -m 1 7328ee2`.
- 2026-10-09 · Opus 5.5 · Demo data rebuilt as one Nicobar team's six weeks (57 tasks, 234 events),
  shifted by whole weeks to today on each seed (`web/lib/shift.ts`), so the demo never goes stale.
  Tests pin today to 2026-10-09. A lead or admin lands on `/team`, a member on `/me`, at the repo
  owner's call. Rollback: `git revert -m 1 f1bf356`.
- 2026-10-09 · Opus 5.5 · The three moods ship as skins, A the default, so the repo owner can compare
  them on real screens instead of sketches. Every skin passes AA contrast in day and night. Motion
  touches only transform and opacity and stops under reduced motion. On `/projects` the plan or
  board tag moved below the project name, since above it read as an eyebrow. Rollback:
  `git revert -m 1 47531a3`.
- 2026-10-09 · Opus 5.5 · The repo owner's v2 (branch `maahir/mvp-v2`) gets its own Vercel project,
  `nico-desk-v2`, so both versions can be compared side by side. It stays on PGlite: `db:remote` does not
  run the ask-column upgrade, and sharing the main database would mix v2 asks into the main tables.
  Rollback: delete the Vercel project `nico-desk-v2`.
- 2026-10-09 · Opus 5.5 · The main site moves to Supabase at the repo owner's call, so edits last.
  Production reads through the Mumbai transaction pooler (`aws-0-ap-south-1`, port 6543); the direct host
  is IPv6 only and Vercel cannot reach it. Supabase holds only the synthetic demo, RLS on with no policies.
  With the open demo, every visitor shares the same edits. The seeded dates go stale, so a weekly reseed
  is still to be set up. Rollback: `vercel env rm DATABASE_URL production`, then redeploy.
- 2026-10-09 · Opus 5.5 · Weekly reseed of the hosted demo, at the repo owner's call, so seeded dates
  stay current. A daily cron runs at 00:35 IST (daily is the Hobby limit); the route reseeds only when the
  first fixture task's `first_due_on`, which a trigger locks, differs from this week's shifted value. So it
  needs no secret: any extra call in the same week only reads one row. Visitor edits are lost each Monday.
  Rollback: delete `web/vercel.json` and redeploy.

- 2026-10-11 · Opus 5.5 · The live site moves from the synthetic demo to the real pilot, at the repo owner's call: the AI
  project with the pilot sponsor's 8 tasks and six real people, loaded into Supabase from git-ignored `web/pilot/`.
  The cron is removed so Monday no longer wipes it, and the reseed route refuses when the fixture marker task is
  absent. The open demo stays: a visitor is the first lead, so real names and tasks are readable by anyone with the
  URL. Production needs `NICO_ALLOWED_DOMAIN=nicobar.com`. Rollback: `npm run db:remote` without `NICO_ROSTER`
  reloads the fixtures, then restore `web/vercel.json` from this commit's parent.
- 2026-10-11 · Opus 5.5 · A fourth skin, Warm (`w`), is the default, at the repo owner's call: the pilot team's own build
  used it and they asked the hosted site to match. Accent, red and amber were darkened to pass AA; serif headings use
  Fraunces. Mood A stays in the menu as cookie `a`. The ledger now defines each category on the page, groups the
  finished outcomes, and splits late into flagged early and missed, derived from when each date move was logged.
  People with no tasks are hidden on `/team` and the ledger. Rollback: `git revert` this commit.

- 2026-10-12 · Opus 5.5 · Google sign-in, at the repo owner's call, after the sponsor named it the next step. It talks to
  Google directly instead of porting the Supabase Auth version from `maahir/v2-hosting`: no new dependency and no Supabase
  provider setup, and the session stays the signed cookie the rest of the app already reads. Only roster people on the
  allowed domain get in. Going live needs a Google OAuth client and `NICO_SESSION_SECRET` (on Vercel, Google sign-in stays off without it, since the derived secret would let anyone with `DATABASE_URL` forge a session), and then `NICO_OPEN_DEMO` and
  `NICO_DEV_SIGNIN` unset in production, which closes the open demo over real pilot names. Roster moved into the main
  nav for admins, since in the More menu the pilot team read it as missing. Rollback: unset `GOOGLE_CLIENT_ID` on Vercel
  and redeploy, or `git revert` this commit.
- 2026-10-12 · Sonnet 5.5 · Two more skins, Mac (`m`) and Ink (`i`), at the repo owner's call, to compare a native
  macOS look and a Notion-like look on real screens. The default stays W and skins W, A, B and C are untouched. Mac uses
  the system font stack, so nothing is downloaded. Ink reuses the loaded Inter. Both are token blocks plus a few
  skin-scoped rules in `web/app/tokens.css` for what tokens cannot do (sidebar tone, segmented pickers, field edges,
  status tags). Every pair passes AA in day and night. Rollback: `git revert` this commit.
- 2026-10-12 · Opus 5.5 · Skin W now matches the PM's build (`local-desk`) screen for screen, at the PM's call, on branch
  `mvp-local-desk-look` for the repo owner to review: Inter text, the logo tile, rust buttons, a colour per person,
  outlined status pickers, boxed Late and At risk flags (Late shows beside "3 days late" too), the moved-date mark, the
  card layout on `/projects`, a green progress bar. The PM's small-caps labels come back in normal case and bold, since
  eyebrows are banned. Amber and the faintest grey are darkened just enough for 4.5:1. Skins A, B and C are unchanged.
  Roster goes back under More, reversing the 12 Oct move. The ledger opens on the PM's view (tiles, then a habits card
  per person split ahead, on time, late); needs attention, finished and the full breakdown follow. Home folds done and
  dropped tasks into two closed lists. Also fixes the sidebar wordmark and name, which drew in dark ink on the dark
  sidebar. Rollback: do not merge the branch, or `git revert` its commit.
- 2026-10-12 · Opus 5.5 · An admin can now do everything a lead can (`web/lib/roles.ts`, `isLeadOrAdmin`), at the repo owner's call:
  before, an admin without the lead role could not edit, move, close or reopen others' tasks. Block stays owner-only, and the
  status buttons now offer only moves the service allows. The update log reads one sentence per action. The phone nav starts
  at the gutter in every skin. On the live site the repo owner, the PM, the pilot sponsor, the sponsor and the product teammate
  are admins; the open demo is off, so the first screen is Google sign-in. Rollback: `git revert` the two fix commits.
- 2026-10-12 · Sonnet 5.5 · "View as" for admins, so they can check each person's screens before the pilot team sees them. A
  signed `nd_view` cookie (`web/lib/auth.ts`) counts only when the real session person is an active admin. `currentMe` returns the
  effective person plus `realPerson`. Every non-GET `/api/v1` call is refused with 403 `viewing_as` in `route()`
  (`web/lib/http.ts`), before the rate limit, so nothing is written as the person viewed. Pages and components hide or disable
  write controls through `ReadOnlyProvider`; page-level writes (assigned-seen, notice-read, seen cookie, reminder log) are
  skipped. The service layer itself still takes an actor id, so any new write path outside `route()` must call
  `assertNotViewing`. Rollback: `git revert` the commit.

- 2026-10-12 · Opus 5.5 · The daily 09:00 IST notice job is back, at the repo owner's call: removing `web/vercel.json` on 11 Oct
  to stop the reseed also stopped the due-tomorrow, due-today and overdue notices. The cron now calls only
  `/api/v1/jobs/reminders` by GET with Vercel's `CRON_SECRET`, and the route refuses while that secret is unset. It writes
  notices and never sends or wipes anything. Reminders stay Gmail drafts the lead sends. Rollback: delete `web/vercel.json`.

- 2026-10-12 · Opus 5.5 · Everyone, lead and admin included, now lands on Home (`/me`) after sign-in, at the repo owner's call.
  This replaces "a lead or admin lands on `/team`" from 2026-10-09. `/team` stays one click away in the nav.
  Rollback: `git revert` this commit.

- 2026-10-12 · Opus 5.5 · The PM's account menu (branch `mvp-local-desk-look`) merged: one button at the bottom left opens
  name and email, View as someone else (admins), Appearance, Keyboard shortcuts and Sign out. Its View as now calls the
  real view-as API instead of the dev roster picker, so it works on the live site. Rollback: `git revert -m 1 68b6498`.
- 2026-10-12 · Opus 5.5 · Single addresses outside the company domain can sign in, at the repo owner's call, for one
  pilot member on a partner domain. The list lives only in the env var `NICO_ALLOWED_EMAILS` (comma-separated), so no
  address sits in this public repo. Each one must still be an active roster person. Google's `hd` hint still names the
  company domain, so that person may need "Use another account". Rollback: unset `NICO_ALLOWED_EMAILS` on Vercel and
  redeploy.
- 2026-10-12 · Opus 5.5 · Four rule changes at the PM's call, on branch `mvp-local-desk-look`. Any written reason will do
  for blocking, dropping, moving a date, reopening or going back to not started (was 10 to 280 characters), since the
  10-character floor kept the save button greyed with no word why; a reason is still required. A project's "what done
  looks like" is optional. An admin can do anything a lead can, such as reopening. A task in a project goes only to
  that project's people: owner pickers list them, "+ Add someone to this project" brings a person in with a role, a
  task reaching an outsider another way (minutes) adds them as Member, and no one leaves a project while they own open
  tasks in it. The hosted database needs `npm run db:upgrade` once (relaxes the block-reason check, adds open-task
  owners to their projects; keeps all data). Status pickers in skin W fill by status: grey, yellow, red, green, dark
  grey. Rollback: `git revert` the commit and leave the database as is (the relaxed check accepts the old data).
- 2026-10-12 · Opus 5.5 · The company's logo goes in `web/public/brand/`, at the repo owner's call, for the sign-in page:
  the header wordmark as an SVG (fill set to `currentColor`, so each skin can tint it) and the stacked mark as a white PNG.
  Both come from the public nicobar.com site, so they add nothing internal to this public repo. They go if the company
  objects. Rollback: delete `web/public/brand/` and its uses.
- 2026-10-12 · Opus 5.5 · Only the project owner, a lead or an admin can bring someone new onto a project, at the repo
  owner's call, after a security review found that any member could add any teammate by assigning them a task. The rule
  lives in `joinProject` (`web/lib/service.ts`), the same rule as `updateProject`; the owner picker shows "+ Add someone
  to this project" only on projects in `projectsMayAddTo` (`web/lib/plan.ts`). A member can still give a task to the
  project's own people, and accepting minutes for an outsider now needs one of those three. Rollback: `git revert` this commit.
- 2026-10-12 · Opus 5.5 · The row status picker is a menu, at the repo owner's call (`StatusMenu` in
  `web/components/task-ui.tsx`). Each status shows its icon (circle, half circle, bar, tick, cross) in its tone colour, so
  it reads without colour. Under the statuses: Unblock when blocked, Move date… and, for leads and admins, Reassign…,
  which open the side panel. A lead or admin can now block a task (`blockTask`), since they often hear of a block
  first. Unblock is one step: `unblockTask` with `resume` clears the block and sets In progress in one change, with an
  optional note; the person a task waits on can still clear a block but not set it in progress. The menu is fixed to
  the viewport, since the task list clips overflow. View as still shows the plain status chip. Rollback: `git revert`
  this commit.
- 2026-10-12 · Opus 5.5 · The project page's task table now uses the same status menu (`web/components/TaskBoard.tsx`),
  found in the browser check: it still had the native select, so project pages lacked the icons, Unblock, Move date…
  and Reassign…. Closed tasks show the plain chip; a done task reopens from its checkbox. Two fixes to the menu: it
  stays on screen when it opens upward or when its button sits at a phone's left edge, and Dropped's icon in skin W
  uses the faint ink, since its own tone colour is light on a dark fill. Rollback: `git revert` this commit.
- 2026-10-12 · Opus 5.5 · The sign-in page shows the company wordmark beside the product name, at the repo owner's
  call. It is a CSS mask of `web/public/brand/nicobar-wordmark.svg` filled with `--ink`, so every skin tints it in day and
  night with no copy per skin, and forced-colours mode paints it in the system text colour. Rollback: `git revert` this
  commit.
- 2026-10-12 · Sonnet 5.5 · The Reminders page now says plainly, under its title: "Opens a draft in your Gmail, from your
  address. You press Send." It replaces the older line "It opens in your own Gmail; you press Send", so the page says it
  once. The cron check found `web/vercel.json` already runs `/api/v1/jobs/reminders` daily at 03:30 UTC (09:00 IST), and
  the route refuses while `CRON_SECRET` is unset, so neither changed. The optional Monday digest is not built.
  Rollback: git revert this commit.
- 2026-10-12 · Sonnet 5.5 · Foundations for the UI pass. Each status has one fg and bg token pair in every skin, day and
  night (`--status-*` at the end of `web/app/tokens.css`): grey, blue, red, green, and a muted Dropped with a strike. Skin W
  keeps yellow for In progress. Every pair passes AA. One `Select` (`web/components/Select.tsx`) replaces every native
  select, and `DateField` (`web/components/DateField.tsx`) adds Today, Tomorrow, Friday and Next Monday to every date input.
  Both sit on one `Popover` (`web/components/popover.tsx`), which `StatusMenu` also uses: it is a bottom sheet under 768px and
  follows the keyboard rule. Shortcut dates come from `quickDates` in `web/lib/time.ts`. Motion presets live in
  `web/components/motion.ts`, stop under reduced motion and stay under 300ms; the `motion` package is new. Rollback: `git
  revert -m 1` the merge of workstream 1.
- 2026-10-12 · Sonnet 5.5 · Help mode. A `?` button in the top bar and the `?` key turn it on and off. The state is the
  `nd_help` cookie, which `layout.tsx` reads, so the page has no flash. When on, explained terms get a dotted underline and a
  short plain-words tooltip on hover, keyboard focus or tap. When off, they are plain text with no tab stop. The shortcut
  sheet moved inside help mode, as a button in the help bar, and the account menu still opens it. All the words live in
  `web/components/help.ts`, and one wrapper, `<Help term>` in `web/components/HelpMode.tsx`, applies them. It is a small
  custom tooltip, not the Popover, since the Popover moves focus and has menu roles. On a phone, with help on, the first
  tap on a control explains it and the second tap acts. Rollback: `git revert -m 1` the merge of workstream 2; the
  `nd_help` cookie then does nothing.

- 2026-10-12 · Sonnet 5.5 · People pages, task links and cross-links (workstream 3). Each person has `/people/[id]`
  (`personView` in `web/lib/service.ts`), and a name anywhere links there through `PersonLink` (`web/components/chips.tsx`).
  A task opens in the side panel from a `?task=` URL (`web/components/taskUrl.ts`), so a task can be shared by link. A task
  holds up to 10 links (`task_links`, `web/lib/links.ts`): http and https only, no user name or password in the URL, opened
  with noopener and noreferrer. Adding or removing a link needs the same right as editing the task, and logs an event.
  The new table has RLS on with no policies, like every other table. The hosted database needs the table before any build
  with this change is promoted: `cd web && npx tsx --env-file=.env.remote.local scripts/upgrade-task-links.ts` (adds the
  table only, keeps all data). `npm run db:upgrade` also creates it. Rollback: `git revert -m 1 7595485`, then
  `DROP TABLE task_links;` on the hosted database if it was created.
- 2026-10-12 · Opus 5.5 · The app is called "Nico Desk" wherever it shows a name (tab title, sidebar, sign-in, task origin),
  at the repo owner's call. The repo, package, Vercel project and URL keep `nico-desk`. The sidebar shows the company wordmark
  under the name, as the same CSS mask the sign-in page uses, tinted with the sub-label colour. The "Help is on" bar is gone,
  at the repo owner's call: the pressed `?` button shows that help is on, and the account menu opens the shortcut sheet.
  Rollback: `git revert` this commit.
- 2026-10-12 · Opus 5.5 · The PM's commit `ddd8ba2` (branch `mvp-local-desk-look`) merged: finished lists put the task
  finished most recently on top, on Home (done this week, dropped) and on project boards. A drop sets no close time, so its
  time comes from the task's last status event (`endedAt` in `web/lib/derive.ts`). At the repo owner's call, the ledger's
  drill lists take the same default, and every finished list gets a sort picker (`web/components/SortPick.tsx`): newest
  finished first, oldest finished first, or due date. In the ledger the date option sorts by the first due date, since the
  ledger judges on-time against that date. The choice lasts until the page reloads. Rollback: `git revert -m 1` the merge.
- 2026-10-12 · Sonnet 5.5 · Archive and restore a project (workstream 6b). The project owner, a lead or an admin can
  archive a project, and the same people can restore it. Archive is refused while the project has open tasks or open plan
  lines, so nothing open goes out of sight. Archived projects sit in a closed "Archived" group on `/projects`. When a task
  moves to a new owner, the previous owner gets an in-app notice (`MovedAwayCard`), so the task does not just vanish from
  their list. The view-as gutter on Home is closed. The hosted database needs the new columns before any build with this
  change is promoted: `cd web && npx tsx --env-file=.env.remote.local scripts/upgrade-project-archive.ts` (adds columns only,
  keeps all data). Rollback: `git revert -m 1 06c336a`. The columns can stay, since nothing else reads them.
- 2026-10-12 · Sonnet 5.5 · Motion and visuals (workstream 4), merged by Opus 5.5. `DESIGN.md` Motion now lists each
  move: page entry, a sliding tab and nav marker, spring drawers and dialogs, a first-load list stagger, status chips
  easing colour, a tick that draws itself, ledger numbers counting up once per session, and still dithered pictures in
  empty states, sign-in and the people page header. Two named exceptions to transform and opacity: chip colour and the
  tick stroke. Nothing passes 300ms except the stagger, and reduced motion stops all of it. The dither is our own
  (`web/lib/dither.ts`), since no DitherKit package was found. At merge, Opus fixed a hydration mismatch: each page
  streams in after the layout, so the count-up started at 0 where the server wrote the value. It now tells hydration
  from a client visit per component (`useSyncExternalStore`), `MotionBoot` is gone, and a hidden tab shows the value at
  once. Reduced motion was not emulated in the browser check. Rollback: `git revert -m 1` the merge.
- 2026-10-12 · Sonnet 5.5 · Ease-of-use pass (workstream 6a, commits `e5affa3` to `332e250`), merged by Opus 5.5. Undo in
  the toast makes a new change through the normal rules with the reason "Undone", never a delete (`web/lib/undo.ts`). A quick
  add line on the new-task forms ("Send deck to vendor fri @owner #project") fills title, due date, owner and project, which
  stay editable; it cannot pick an archived project (`web/lib/quickadd.ts`). A dot marks what changed since the viewer last
  looked. Project board, plan board and team page keep their last filter and tab per browser (`web/lib/remember.ts`). Every
  task, person and project page has Copy link. In the merge, the project header puts the archive refusal under its buttons,
  since beside them it squeezed the title. No schema change. Rollback: `git revert -m 1 a2dc79e`.
- 2026-10-12 · Sonnet 5.5 · Mac (`m`) and Ink (`i`) skins rebuilt (workstream 8), merged by Opus 5.5 at the repo owner's
  call, after the first pass read as a colour swap. A skin can now change material, depth, chrome, radius, spacing, type and
  motion. Mac is glass: a floating blurred sidebar and toolbar, glass pop-ups, a sliding segmented control and large radii,
  solid again under reduced transparency. Ink is a Notion and Craft page: a centred column, big quiet titles, block rows with
  a hover grip (a cue only, no drag), callouts and soft cards. Both fix the view-as banner contrast. Every rule is scoped to
  those two skins, so W, A, B and C render the same. Every text pair passes AA in day and night, on Mac over the worst glass
  backdrop. Only `web/app/tokens.css` changed. Rollback: `git revert -m 1` the merge.
- 2026-10-12 · Sonnet 5.5 · Five small fixes (branch `ws9-fixes`), merged by Opus 5.5. A date field's input name is now
  only its label text, since the quick-date chips sat inside the `<label>` and joined the name (`DateField`). The chips count
  from the viewer's pinned today (`quickChips` in `web/lib/time.ts`), not the browser clock. Finished-list sorts are kept per
  browser on Home, each project board and the ledger drill, through `useRemembered` (`endedSortOf` in `web/lib/remember.ts`).
  On Home a name no longer runs into "needs:". The roster has "Copy invite" after adding a person and on each active row: it
  copies the site address, a line to sign in with the Google work account, and the email added (`web/lib/invite.ts`). This
  is the plan's stand-in for an invite email until a mail sender exists. It sends nothing and is hidden under View as.
  Rollback: `git revert -m 1` the merge.
- 2026-10-12 · Sonnet 5.5 · QA fixes from the browser pass (branch `ws10-qa-fixes`). The project header no longer scrolls
  sideways on a phone: its buttons wrap under the title. The skin W "By pillar / By date" toggle shows a dark label on the
  selected button, 15:1. Plan board status chips in skin W are wide enough for their label, and the due note wraps. On a phone
  the plan line puts owner and partner on their own rows, and skins m and i keep the chevron off the label. Skin W day colours
  for green, amber, late and the project kind word are darker so every text pair reaches 4.5:1. Only disabled buttons stay under.
  Ledger links, count buttons and row openers get a 24px hit area on a phone with no change to the look. The phone nav and tab
  rows fade at the edge that still has more to scroll, driven by scroll position where the browser supports it. The Mac ledger
  count-up flash could not be reproduced in dev or in a production build, in any skin, so that code is unchanged.
  Rollback: `git revert -m 1` the merge.
- 2026-10-13 · Opus 5.5 · A project has an owner and a lead, at the PM's call, on branch `mvp-local-desk-look`. The
  owner is accountable for the outcome; the lead runs it day to day; one person can be both (the default). Both can
  edit the project. The two kinds are now called Internal and Partner / Collaboration; a partner project's
  sub-projects (pillars) are optional, and one with none keeps its lines in a single hidden group. Home lists the
  projects you are on. The target date is a Deadline, Launch, Event, Quarter End or a typed label. The hosted
  database needs `npm run db:upgrade` once more (adds `projects.lead_id`; keeps all data). Rollback: `git revert` the
  commit; the extra column can stay.
- 2026-10-13 · Sonnet 5.5 · The PM's Start a Project work (commit `e246790`, branch `mvp-local-desk-look`) merged onto the mvp
  base on branch `ws11-pm-lead`, at the repo owner's call. The merge keeps `Select`, `DateField`, archive, `task_links`, help
  mode and sentence case. It adds the lead, Internal and Partner kinds, optional sub-projects and Your projects on Home.
  The lead now has the owner's rights: archive, restore, edit and add people (`archiveContext`, `updateProject`, `joinProject`
  and `projectsMayAddTo`). Home leaves out archived projects. A change of owner or lead is a project event, shown in the update
  log. The form says why Start or Save is off, and clears a lead who is no longer valid. The description limit is 600 characters
  in the form and in `web/lib/projectBody.ts`. The plan board falls back to all lines when the sub-project controls are hidden.
  The hosted database needs `npm run db:upgrade` once before a build with this change is promoted (adds `projects.lead_id`; keeps all data).
  Rollback: `git revert -m 1 c13ecb3`. The extra column can stay.
- 2026-10-13 · Opus 5.5 · Updates and blocks, at the PM's call, on branch `mvp-local-desk-look`. "Updates for you" shows
  on Home only, with names in bold. A block on you leaves Updates and stays under "Waiting on you" until it is cleared;
  its Done button clears the block with a few words on what you did (required for the person waited on, still optional
  for the owner or a lead), and the owner and project lead see "X cleared the block" in Updates. "Seen" moved from a
  browser cookie to the account (`update_seen`): Mark all seen, a project's own Mark seen, and opening a task each clear
  lines on every device; the old cookie still counts so nothing comes back on the switch. The hosted database needs
  `npm run db:upgrade` once more (adds the `update_seen` table with RLS on; keeps all data). Rollback: `git revert` the
  commit; the table can stay.
- 2026-10-13 · Sonnet 5.5 · The PM's two commits `be45382` and `a06f720` (branch `mvp-local-desk-look`) merged onto the mvp base
  on branch `ws12-pm-waiting`, at the repo owner's call. They add "Waiting on you" with a Done button, a seen mark kept on the
  account (`update_seen`), and Updates on Home only. The merge keeps everything from workstreams 1 to 11. Six fixes went in with it.
  Waiting on you hides Done under View as. Unblock keeps its resume rules, and the person waited on must now give a note
  (`reason_required`) unless they are the owner or a lead. Sentence case: "Clear block". Mark seen and the task-open seen call
  do nothing under View as, and a refused call puts the lines back. `update_seen` has RLS on, in the reseed and in `upgrade()`.
  The note field has `enterKeyHint="done"`, and Escape or Cancel closes the form. The dot for new changes now reads the same
  account marks. The hosted database needs `npm run db:upgrade` once before a build with this change is promoted (adds the `update_seen` table; keeps all data).
  Rollback: `git revert -m 1 1bb9df7`. The table can stay.

- 2026-10-13 · Opus 5.5 · One person can sign in from more than one address, at the repo owner's call, for a pilot member
  who uses both a company and a partner address. `people.alt_emails` holds the extra addresses and `findPersonByEmail`
  matches either. A partner address still needs `NICO_ALLOWED_EMAILS`. Roster files take an optional `alt_emails` list.
  The hosted database needs `npm run db:upgrade` once (adds the column; keeps all data). The 13 Oct feature batch is
  planned in `docs/PLAN-13-OCT.md`. Rollback: `git revert` this commit; the column can stay.
- 2026-10-13 · Opus 5.5 · `CLAUDE.md` cut from 376 to about 100 lines, at the repo owner's call. The decisions log moved
  here word for word. `CLAUDE.md` keeps the rules from it that still bind, and the hosting detail moved to the Hosting
  section of `web/README.md`. A security audit and RLS policies are now a gate before active use (CONSTRAINTS, and
  `docs/PLAN-13-OCT.md`), raised by a partner teammate. Rollback: `git revert` this commit.
- 2026-10-13 · Sonnet 5.5 · Skins renamed to Nico names (NicoWarm, NicoPlain, NicoCalm, NicoSoft, NicoOS, NicoNote), light
  or dark made a separate choice, and 404 and error pages added (workstream 1 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5.
  The cookie ids w, a, b, c, m and i stay, so no one's saved skin changes. The account menu's Appearance gains System,
  Light and Dark; the `nd_theme` cookie sets `data-theme` on `<html>`, which `layout.tsx` reads so the page has no flash.
  Not checked at merge: `error.tsx` was not rendered in a browser, 375px was not checked in skins a and c, and the
  theme control's contrast was judged by eye. Rollback: `git revert -m 1 aa340de`; the `nd_theme` cookie then does nothing.
- 2026-10-13 · Sonnet 5.5 · Help coverage on every screen (workstream 2 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5. 54 more
  terms in `web/components/help.ts`, wrapped with `<Help>` on Home, Team, Projects, the task board, the plan board, the
  person page, the ledger, minutes and the status menu. Buttons and links use the `host` prop, so a click still acts.
  Plan-board tiles and the line-status picker stay unwrapped, since the custom Select flattens its options to strings.
  `web/tests/help.test.ts` requires the covered list to match HELP exactly, so a new term needs a test line. Not checked:
  the first-tap-explains behaviour on a phone. Rollback: `git revert -m 1 09fbed7`.
- 2026-10-13 · Sonnet 5.5 · People get a phone number and a photo (workstream 3 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5.
  An upload is cropped to a 256px square in the browser and stored under 200 KB in `person_photos` (bytea, RLS on, no
  policies). It is served only to signed-in members of the same team, with a private cache and an ETag. Google sign-in
  saves the picture address (https only) to `people.photo_url`, so the OAuth scope now includes `profile`. An upload wins
  over the Google photo, and initials are the last fallback. Phone is optional: digits, spaces, plus and hyphen, 7 to 20
  characters. Edit profile shows only on your own page, and every write is refused under View as. At merge, Opus fixed a
  finding from the commit security review: the upload route read the whole body before checking its size, so a chunked
  upload with no length header was buffered in full. It now reads in chunks and refuses at 200 KB. Not checked in a
  browser: the crop, the WebP encode and its JPEG fallback, 375px, day and night. The hosted database needs
  `npm run db:upgrade` once before a build with this change is promoted (adds two columns and the table; keeps all data).
  Rollback: `git revert -m 1 b26e162`. The columns and table can stay.
- 2026-10-13 · Sonnet 5.5 · Home at a glance (workstream 4 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5. Home shows four
  small charts in inline SVG and CSS drawn from tokens, with no chart library: this week (done, open, late), the viewer's
  own on-time rate over four weeks, open load per project, and for leads and admins a team load table. The sums live in
  `web/lib/glance.ts`. The trend uses the ledger's rule (a task counts in the week of its first due date; kept means
  closed ahead or on time) and is tested against `s.ledger` on the fixtures. Each chart has a screen-reader sentence, a
  link to its full list and an empty state. The strip collapses, and the choice is kept per browser. Draw-in plays once
  per tab (bars `scaleX`, the line `stroke-dashoffset` as a third named exception, 200ms) and stops under reduced motion.
  Not checked: measured contrast, light mode, skins other than W, and reduced motion. At 375px the cards stack and the
  task list starts about a screen and a half down. No schema change. Rollback: `git revert -m 1 ce8bfdc`.
- 2026-10-13 · Opus 5.5 · The repo owner sponsors Jev on real pilot data, on one condition: every request to TypeSafe
  goes through a masking layer (`web/lib/redact.ts`, built in the Jev workstream). Roster names, emails, project and
  workstream names, phone numbers, links and amounts become stable placeholders ("Person 1", "Project 1") for that one
  request. The answer maps back in memory, and the map is never logged or stored. With `NICO_JEV_LIVE=1` masking is
  required: if it fails, nothing is sent. Known gap: names that are not on the roster (vendors, partners) can pass
  through in free text. Turning `NICO_JEV_LIVE` on in production is still a deploy step that asks first.
  Rollback: unset `NICO_JEV` in Vercel env; Jev features fall back to today's behaviour.
- 2026-10-13 · Sonnet 5.5 · Guide page (section 13 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5. `/guide` is a short
  signed-in page in plain words: what the tool is for, a week in it, the five statuses, the one rule, when you are
  blocked, what leads see, help mode and shortcuts, and where to give feedback. It is linked from the account menu and
  from a dismissible first-visit note on Home (kept per browser). The shortcut list moved to `SHORTCUTS` in
  `keys.ts`, so the pop-up and the guide share one source. The rule reads "move a date before it passes, and say why"
  with the first date kept, to match the on-time rule (not "on time in spirit", as the plan first said). Not checked:
  light mode, skins other than W, the account-menu item in a browser, measured contrast. Rollback: `git revert -m 1 6cb4f68`.
- 2026-10-13 · Sonnet 5.5 · More visual data (section 12 of `docs/PLAN-13-OCT.md`), merged by Opus 5.5. Project cards and
  each project page show one status bar: done, in progress, not started, blocked, late. Late counts only in late,
  dropped is left out, so the parts add up to the total. Plan boards use the line words and `lineLate`. Blocked is
  hatched and late solid, since both are red in most skins, and the counts are written under the bar. Each project page
  has a six-week done-against-due chart in inline SVG. The person page reuses the Home "This week" and on-time cards,
  under the on-time record's visibility rule. Home charts start collapsed under 768px until the person uses the toggle,
  decided in CSS, so there is no flash. Not checked: light mode, skins other than W, measured contrast. No schema
  change. Rollback: `git revert -m 1 821c4f8`.
