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

- **2026-10-13 · Sonnet 5.5 (built), Opus 5.5 (merged) · Jev search by meaning and a status nudge (workstream 10a).**
  Jev (TypeSafe) re-ranks search by meaning and offers a status from a note. Off unless `NICO_JEV=1` and
  `TYPESAFE_API_KEY` are set, and off against a hosted database unless `NICO_JEV_LIVE=1`. Every request is masked
  first in `lib/redact.ts` (people, projects, emails, phones, links and amounts become labels, and the answer is mapped
  back). The app has no unmasked path. Extra names go in the git-ignored `web/pilot/jev-terms.local.json`, which must be
  filled before `NICO_JEV_LIVE` is set. The nudge only offers. A click applies it through the normal rules, and Blocked
  still needs its reason. Threshold 0.65 from the synthetic eval (40 notes): 90% status accuracy masked and unmasked,
  no wrong offer at any threshold from 0.5 to 0.95. Search hit at top 3: 12/15. Re-check the threshold on real notes.
  Rollback: unset `NICO_JEV` (local search, no nudge), or `git revert -m 1 a42ffa7`.

- **2026-10-13 · Opus 5.5 · The task title no longer collapses in a long drawer.** The drawer is a flex column, and
  `.drawer-title` had `min-height: 0`, so when the drawer content was taller than the screen (most phones) the title
  textarea shrank to 10px and the title vanished. `flex-shrink: 0` keeps it at its content height. Checked at 375px with
  the drawer scrolling: 37.5px. The reported missing nudge on a no-project task opened from a project page did not
  reproduce: the drawer stays mounted and the nudge shows. Rollback: remove `flex-shrink: 0` from `.drawer-title`.

- **2026-10-13 · Opus 5.5 · Project form wording, at the PM's call** (branch `mvp-local-desk-look`, built on `maahir/mvp`).
  Phase is gone from the form (a project that has one keeps it and still shows it). The description is one line ("In one
  line", same 600-character limit), "Category (optional)" replaces "Category line", the add button reads "+ Add person",
  and the "The project" and "Dates" headings are gone. Sentence case stays, as DESIGN.md asks; whether form labels move to
  title case is the repo owner's call. On a phone the target-date picker no longer stretches beside the date shortcuts.
  No schema change. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Start a project form tidied after the PM's QC against their build.** The "why Start is off"
  line no longer shows on a fresh form: Start stays pressable, and only a try with something missing shows the reason,
  in red above the buttons. This reverses the 13 Oct "the form says why Start or Save is off" for this form only. The
  date label picker sits on its own row with the date and its chips below, instead of stretching to their height. On
  the live database, at the repo owner's call: the `db:upgrade` steps ran (all idempotent; counts unchanged), one
  pilot member was added to the roster with a placeholder email, and a pilot project got a new owner, a separate lead
  and seven tasks finished before the desk existed, each closed on its first due date with its done events, so the
  ledger reads them as on time. Nothing of that data is in the repo. Rollback: `git revert` this commit; the live rows
  are ids `tsk_ns_h1` to `tsk_ns_h7`, their events, and the project event `evt_ns_owner_1310`.

- **2026-10-13 · Opus 5.5 · Jev goes live on pilot data with roster masking only, at the repo owner's call (as sponsor).**
  `NICO_JEV` and `NICO_JEV_LIVE` are set in production. Every request still goes through `lib/redact.ts`, which masks
  the roster's people and the team's projects, emails, phones, links and amounts. `web/pilot/jev-terms.local.json` is
  not filled, so other names written in notes or searches (vendors, studios, outside people) reach TypeSafe as written.
  This replaces the earlier rule that the terms file is filled first. Rollback: `vercel env rm NICO_JEV_LIVE production`,
  then redeploy (search goes local, no nudge).

- **2026-10-13 · Opus 5.5 · Security fixes from the 13 Oct audit (HANDOFF.md 8.2), code only.** The weekly reseed route
  is removed: the live site holds the real pilot, and a cron that can drop tables must not exist there. With
  `DATABASE_URL` set, a derived session or job secret is refused (`lib/secret.ts`), so `NICO_SESSION_SECRET` and
  `NICO_JOB_SECRET` must be set, and the roster picker and open demo stay off unless `NICO_ALLOW_DEMO_IN_HOSTED=1`.
  `db()` no longer reads the job secret on Vercel. `next.config.ts` adds framing, referrer, nosniff, HSTS and
  permissions headers, and a report-only CSP. Browsing connected meetings is lead and admin only; members paste
  minutes. `.env` and `.env.*` are git-ignored. The RLS revoke on the live database and the unused public Supabase env
  vars are left for the repo owner's yes. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Project visibility (HANDOFF.md 8.3).** An admin can mark a person "Own projects only"
  (`people.restricted`). That person sees projects they own, lead or are a member of, projects that list them under
  "Can also view" (`project_viewers`), and tasks they own or that are blocked on them. Leads, admins and unrestricted
  people see everything. Hidden reads as missing (404). Visibility follows the viewed person, so View as tests it.
  Viewers got their own table because `updateProject` re-inserts members. The Jev masking dictionary keeps the full
  project list, which masks more, not less. The team-wide week, by-status and ledger API views refuse a restricted
  person. The open questions took the proposed answers. Rollback: `git revert` the two visibility commits; the
  `restricted` column and the `project_viewers` table can stay, nothing else reads them.

- **2026-10-13 · Sonnet 5.5 · Sounds, off by default (workstream 7), and the status nudge on the full update form.**
  A "Sounds" switch sits in the account menu under Appearance and lives in the `nd_sound` cookie, off until a person
  turns it on, so a shared office is never surprised. Three Web Audio tones (no files, each under 200ms, quiet): a soft
  ping for a new notice, a light tick for Done, a low tone for a refused action. They live in `components/sound.ts`;
  the four fetch wrappers call it once a response is in, so no form needed a change. Home asks for the person's own
  notices every 60 seconds while the tab is visible, through the same sight-filtered `/api/v1/me/notices` call, so a
  hidden project never pings. A new notice pings once and an "N new notices" count eases in (transform and opacity,
  180ms, none under reduced motion). Nothing plays on page load. Reduced motion does not mute sounds, only the switch
  does. The full "Add an update" form on `/tasks/[id]` now asks the same `suggest-status` route as the drawer and shows
  the same `StatusNudge`; the click goes through the normal status calls (`moveWithWords` in `task-ui.tsx`, which the
  drawer forms now share). Under View as nothing is written, because the update post is refused first. The guide
  gained one line that a dictation app such as OpenWhispr works in any box. Rollback: git revert this commit.

- **2026-10-13 · Sonnet 5.5 · Real links and filters in the URL (HANDOFF 8.4, items 1 and 3).** Every task, project and
  person that opened from a click handler is now a real link, so middle click, Cmd or Ctrl click and "Open in new tab"
  work. A plain click keeps today's behaviour (a task row still opens the side drawer in place). `TaskLink` points at
  `/tasks/<id>` and `isPlainClick` (`lib/urlstate.ts`) is the only click it intercepts. The task rows, the board title,
  the Updates and Waiting cards, the person page lists and the top search results use it. Filters, tabs, view toggles and
  sorts on Home, Team, project boards, plan boards and the ledger now also live in the address (`?who=`, `?tile=`,
  `?closedSort=`, `?project=`, `?q=`). The address wins over the kept view when present, a default is left out, and
  other parts such as `?task=` and `?week=` are kept. It is written with `history.replaceState`, the way the task drawer
  is, not `router.replace`: the page already holds the state, so a server re-render per click would add cost for no
  change in what is shown. Suggested order stays a later choice in the sort menu and never the default. Nothing here
  makes room for it: there is no score and no hook, and due date remains the order for open work. Rollback:
  `git revert` this commit.

- **2026-10-13 · Sonnet 5.5 · Comments with @ and # (workstream 5).** Anyone who can see a task or a project can comment
  on it, in the task drawer under History and on the project page. Typing `@` picks a person and `#` picks a task or a
  project. The text is stored with id tokens (`[[person:ID]]`), the server checks every token again, and `comment_refs`
  holds the ids, so a mention never depends on a name matching. A reference the writer cannot see is refused. A reader
  who cannot see a referenced item gets "a hidden item", never its title. Only the author edits or removes a comment;
  a removed one keeps its row with an empty body and reads "Comment removed". Writes are refused under View as, and a
  hidden task or project reads as 404. A mention adds an in-app notice (`notices.task_id` is now nullable, with a new
  `comment_id` and the kind `mentioned`) shown on Home as "Mentioned you". Nobody is told who cannot see the item.
  "Urgent: also email" only shows Gmail links that open a draft in the writer's own browser; the app sends nothing.
  `KeyboardDismiss` no longer closes the keyboard on the scroll a note makes while it is typed into. The hosted
  database needs `npm run db:upgrade` before a build that uses this is promoted. Rollback: `git revert` this commit;
  the `comments` and `comment_refs` tables and the nullable `notices.task_id` can stay, nothing else reads them.

- **2026-10-13 · Sonnet 5.5 · DESIGN.md brought in line with the app (DESIGN-GUIDE section 8).** `DESIGN.md` outranks
  everything visual, so a stale `DESIGN.md` misleads every later change. It still described NicoPlain, Geist, a
  commit field, Asks and a top bar, while the app ships NicoWarm with Inter and Fraunces, a dark side nav, five status
  words and derived flags. Every row of the guide's section 8 was rewritten against `tokens.css`, `globals.css`, the
  components and `package.json`, and no value was copied from the guide without a check. Contrast was computed again
  for NicoWarm only, from the current hex values. The other five skins are marked as not measured since 12 Oct. The
  44px touch goal stays, with what the code does today stated beside it. The `npm run shots` line is gone because no
  such script exists. Fixture first names are replaced by generic words. Section 8 of `docs/DESIGN-GUIDE.md` is now one
  line. Docs only, no code. Rollback: `git revert <this commit>`.
- **2026-10-13 · Sonnet 5.5 · Threads: a "Connects to" panel on every item (workstream 6).** A task, a project and a person now show what they are part of, what they wait on, what waits on them and where comments mention them. `lib/threads.ts` works it out from fields and `comment_refs` that already exist, so there is no schema change and nothing new is stored. It builds every line from `seenTasks` and `seenProjects`, so a hidden task or project never shows, not as a title and not as a count. A task blocked on the reader stays visible by the sight rule, and its hidden project is left out of its panel. "Pillar" is not a task field, so the workstream stands in as the quiet second part of the "Part of" line. "From" is shown only for tasks made from meeting minutes, with no link, because the task does not hold a meeting title. The person panel leaves out their open tasks, because the page already lists them. The drawer reads `GET /api/v1/tasks/[id]/threads` through `route()`, and a task line opens in place so the browser back button returns to the first task. Rollback: `git revert <this commit>`.

- **2026-10-13 · Sonnet 5.5 · Stronger search, all local (workstream 9).** Search now forgives typos, reads filters, finds comment text, runs commands and remembers recent searches, with no outside model. Typo tolerance is an edit distance with a size rule: no edit up to 3 letters, one up to 7, two above (`lib/fuzzy.ts`). Exact matches rank above typo matches. The filters `is:` (the five statuses plus late, at risk, ahead, on time, mine, open), `due:today`, `due:week`, `@name` and `#project` are parsed in `lib/searchQuery.ts`. They use one flag derivation, `lib/flags.ts`, which the task rows now call too, so a filter and a row cannot disagree. `@` and `#` resolve only against people and projects the reader can see, so a filter never reveals a hidden project. Comment text is searched on the server. A comment hit shows only if its task or project is visible to the reader, and its text never shows the title of a hidden item. Cmd+K commands use only actions that already exist: pages in the side menu, New task, help mode, the shortcut list and the skins. Recent searches live in `localStorage` per viewer, every call in try/catch, and are not recorded in View as. The Jev path is unchanged. Comments are kept out of the candidates sent to Jev, and local comment hits are added after its ranked list. `is:late` is the Late flag, so it includes tasks finished after their first date, as the task rows do. Use `is:late is:open` for tasks late now. No schema change. Rollback: `git revert <this commit>`; no `upgrade()` step is involved.

- **2026-10-13 · Sonnet 5.5 · Motion pass (workstream 8).** Four moves were still missing from the plan: the dither pictures in empty states and on the 404 and error pages fade in by rows, the status icon morphs (old glyph out, new glyph in, ring stays), a posted comment rises in, and a picked mention shows a chip that pops in. Each runs on a new token in `tokens.css` (`--dur-dither`, `--dither-spread`, `--dur-glyph`, `--dur-pop`, `--pop-scale-from`), uses opacity and transform only, and the dither picture finishes within 280ms, so no new exception to the 300ms rule is needed. The Home charts already drew in once per tab, so they are unchanged. `tests/motion-rules.test.ts` now pins every duration token at 300ms or less, no number in any `animation:`, keyframes limited to opacity, transform and the stroke draw, no layout property in any transition, every animation class and token zeroed under reduced motion, and the new moves named in `DESIGN.md` Motion. Rollback: `git revert <this commit>`.

- **2026-10-13 · Sonnet 5.5 · Paste to tasks (HANDOFF 8.5).** A person pastes a chat or a WhatsApp `.txt`, and Claude
  proposes tasks, status or date changes and notes, each with a one-sentence reading and the message it came from. The
  parser (`lib/chat.ts`) and the checks on the model answer (`lib/paste.ts`) are plain code, so they are tested offline.
  Text is masked before the model sees it, and `lib/redact.ts` gained phone numbers. A sender who is not on the roster
  becomes "an outside person". The model can only point at tasks and projects the signed-in person can see, so a hidden
  one reads as missing. The chat is data: a line that gives orders to the tool is never acted on, and 4 of the 20 eval
  chats test this. Nothing is written until the person presses Approve. Approve runs the normal service call, one per
  proposal, so every rule (reasons, versions, View as refusal) and the client undo work as they do everywhere else. The
  raw text is dropped after the read and is not stored, and the screen says so. No schema change. The minutes flow in
  `lib/plan.ts` still sends unmasked text. This flow does not, and moving minutes onto the same masking is a later call.
  Residual risk: a name that is not on the roster or in the project list is not masked. Rollback: git revert this commit.

- **2026-10-13 · Sonnet 5.5 · Fathom note-taker connection, and env-var keys win.** Fathom is the third provider in `lib/connectors.ts`. A key is checked by listing the last 7 days from `GET api.fathom.ai/external/v1/meetings` (header `X-Api-Key`) before it is kept. Open action items become "(Name) task" lines that the minutes reader turns into proposals, with the summary as fallback, and nothing changes until a person accepts. Saving and removing a key stays lead or admin only. A Fathom key is per user and sees only its owner's own and shared meetings (research fix 4), so the Connections card says so. Keys set in the server environment (`GRANOLA_API_KEY`, `FIREFLIES_API_KEY`, `FATHOM_API_KEY`) now win over `.data/connections.json`, because the file does not survive a cold start on Vercel (research fix 2). The page says when a key comes from the environment and refuses to save a file key that would be ignored (409 `key_from_env`). The comments and README that said Wispr Flow has no API now say it has a read-only MCP server for its Notetaker (research fix 3). Fathom has no get-one-meeting call, so one meeting is found by paging the list. Unconfirmed: whether a free Fathom account can make a key (the docs say all plans). No schema change. Rollback: `git revert <this commit>`; no data to undo, since keys are stored as before.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · Install on a phone, dictation check, and feedback in the app.** Three small batch items. (1) PWA: a manifest, four icons, `appleWebApp` tags and a light and dark `themeColor`, and `public/sw.js`. The worker never touches `/api/`, non-GET requests or other origins, and it caches no HTML, because a page holds private team data. Only static files and the offline page are cached, under a versioned name. It registers in production only. The app has no middleware, so nothing blocks the manifest, worker or icons. The Guide gains an "On your phone" section, and says plainly that the app needs a connection. (2) Dictation (HANDOFF 8.6): only QuickAdd guarded Enter during a composition. The same guard (`isRealEnter` in `components/ime.ts`: `isComposing` or keyCode 229) is now on every Enter-to-submit box: task and plan boards, project form, both searches, minutes, comments and the keyboard-dismiss blur. No controlled input drops text, since each `onChange` is a plain `setState`. A `maxLength` cut was silent, so `LimitNotice` now says when a paste or dictation is cut, and `Count` shows what is left on the long boxes. (3) Feedback: a `feedback` table (`id, person_id, path, body, created_at, read_at`) in `lib/schema.ts` and `upgrade()`, idempotent, RLS on. Any signed-in person can send a note of up to 4000 characters. Only an admin can list or mark read, and View as is refused. The saved path is an in-app path only, with no query string, so no search text is kept. Nothing is emailed. Judgement calls: the manifest name is "Nico Desk"; the "about this page" box is ticked by default and shows the path; the nav link sits under More for admins. Rollback: `git revert <this commit>`; the hosted database needs `npm run db:upgrade` before the build is promoted, and the `feedback` table can stay (it is unused after a revert) or be dropped with `DROP TABLE feedback`.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · More Jev uses: suggested order, project health, draft checks, status from a comment, project guess.** Each is a suggestion. Code finds the candidates (`lib/jevUses.ts`), Jev answers a Score, Choice or yes/no, and code merges the result. The floor is 0.6 (yes/no 0.65), and below it nothing shows. An error, a timeout or a flag that is off gives no answer, and the screen stays as it was. `jevAsk` masks everything it sends. Nothing is stored, and no person-set field is written: the project is filled only while empty, a draft is never edited, and a health word never touches the project status. Every route sits behind `route()`, so View as refuses it, and the controls are hidden while viewing. Compute runs on demand behind a button or a pick, never on page load, and uses the existing 10 minute cache. Judgement calls. (1) `TRIES` in `lib/jev.ts` is now 4, one call and three retries on 429 and 529, because the brief said three retries and the code had one. (2) The client had no Jev flag, so `components/jevFlag.tsx` gives a boolean context that the server layout sets. Client code never imports Jev. (3) The minutes badge already enforces owner and date in code, so Jev only adds wording and duplicate notes. (4) A comment status check reuses the existing status banner. (5) Skipped: "is this reminder still needed", because reminder items have no ids and the draft is editable email text. Also skipped: the Team page sort, because the brief said "and/or". No schema change. Rollback: `git revert <this commit>`; unset `NICO_JEV` to turn every use off without a deploy.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · Meeting rhythm and agenda per project.** A project gets four new columns on `projects`: `meet_every` (weekly, fortnightly, monthly, as_needed), `meet_day` (ISO weekday 1 to 7, optional), `meet_next` and `meet_last` (dates). They are new columns, not `cadence`, because `cadence` on a plan board is only a display list of schedule entries and holds no date a rule can use. A real column can carry a CHECK, can be read in SQL and is the same on task boards and plan boards. The change is in `lib/schema.ts` and in the idempotent `MEETINGS_UPGRADE` run by `upgrade()` (and `scripts/upgrade-meetings.ts` for the host). It adds no table, so there is no new RLS step. The agenda is plain code (`lib/meetings.ts`, no model) and reads through `lib/visibility.ts`: a hidden project reads as missing. It lists late, blocked and at-risk tasks, tasks due on or before the next meeting (or 7 days ahead when there is none), open asks and actions and off-course lines on a plan board, what changed since the last meeting (the Updates reader in `lib/updates.ts`, given a `days` window and a stand-in lead viewer so nobody's own changes are hidden), what finished, and the newest 20 comments. A task sits in the first group that fits, so it shows once. Each section is capped at 25 and says how many more. "Since the last meeting" starts the morning after `meet_last` (IST), because the meeting day itself counts as discussed. With no last meeting it covers 7 days. Date rules: a stored next date that is still ahead is kept. A past one rolls forward by the frequency, and by a month with the month end kept (31 Jan to 28 Feb). Setting a rhythm with no date picks the next matching weekday, else one step on from today. A date that does not fall on the chosen weekday, or is in the past, is refused with a message naming both days. "As needed" has no automatic date. Meeting held sets `meet_last` to today and moves `meet_next` to the first date after today. A stored date a whole step or more ahead stays, because that was an extra meeting. Held is refused a second time on the same day. Who may set the rhythm or mark held: the project owner or lead, a team lead or an admin (`mayRunMeeting`, the same rule as editing or archiving a project). The brief said lead or admin for "Meeting held"; the owner is let in too so a member who owns a project can run it. If that is too wide, remove the owner and lead test in `mayRunMeeting`. Both writes go through `route()`, so View as refuses them, and an archived project refuses them. Both write an audit event (`meeting_rhythm`, `meeting_held`) on the project. The project log does not show these two yet. No real names or dates in the fixtures: `prj_landing` weekly Thu, `prj_shoot` fortnightly Tue, the partner plan weekly Wed, `prj_tiers` none. Rollback: `git revert <this commit>`. The four columns are harmless if left in the hosted database, and `ALTER TABLE projects DROP COLUMN meet_every, DROP COLUMN meet_day, DROP COLUMN meet_next, DROP COLUMN meet_last` removes them with the data in them.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · Google Meet notes as a source of minutes.** Many meetings already have Gemini notes or a transcript in Google, so a lead can pull them in the way Fathom works, with no recorder of ours. The repo owner approved one new Google permission, asked only of the lead who connects it (incremental authorization, `include_granted_scopes=true`), never at sign-in. Scopes: `meetings.space.readonly` (Sensitive) lists conference records, notes, transcripts and entries, and `drive.meet.readonly` (Restricted) exports the notes Doc as text. Docs: https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords/list, https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords.smartNotes/list, https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries/list, https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords.participants/list, https://developers.google.com/workspace/drive/api/guides/api-specific-auth. Only the refresh token is kept, in the new table `google_links`, sealed with AES-256-GCM (key from `NICO_TOKEN_KEY`, bound to the person id). Access tokens stay in memory. The feature is off unless `NICO_MEET=1`, the Google client is set, and (on a hosted server) the token key is set; when off, the routes answer 404 and no UI shows. The connect state is signed, expires in 10 minutes and is bound to the person and to a cookie nonce. The return is refused unless the Google address is the lead's own `email` or `alt_emails`. View as refuses every Meet route, reads too, because an admin viewing as a lead must not read that lead's meetings. Disconnect deletes the row, then asks Google to revoke. The text feeds the existing minutes reader, so nothing extra is stored. Known limits: a raw transcript has no Next steps heading, so without `ANTHROPIC_API_KEY` the plain reader is noisy; whether `drive.meet.readonly` opens a notes Doc owned by another organizer is unconfirmed (the code falls back to the transcript); `drive.meet.readonly` is Restricted, so a public app needs Google verification; nothing was run against live Google. Schema change: `google_links` in `lib/schema.ts` and an idempotent step in `upgrade()`; the hosted database needs `npm run db:upgrade` before promotion. Rollback: revert this commit; then run `DROP TABLE IF EXISTS google_links;` if the table was created, and remove the Meet redirect URI and scopes from the Google client. Tokens already granted can be revoked at https://myaccount.google.com/permissions.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · The thread map (key T).** The "Connects to" links now also draw as a graph around one item, at `/map?focus=task:<id>` (also `project:` and `person:`). It is built from the same lines as the panel: `lib/threads.ts` gained `threadWorld` and `linesFor`, and `threadsFor` now calls them, so the panel and the map cannot disagree. `lib/threadMap.ts` turns those lines into nodes and edges with a plain breadth-first walk (`assembleGraph`, no database), 2 steps by default, 3 at most, and about 60 items. Items cut by the cap are counted once in `more` and shown as "N more not shown". Items past the step limit are not counted. Every item comes from `seenTasks` and `seenProjects`, so a hidden item never appears, not as a node, a label or a count, and a hidden focus reads as 404. `GET /api/v1/threads/map` goes through `route()` with a Zod query, and View as may read it. The layout (`lib/threadLayout.ts`) is plain code with no graph library: one column per step, rows sorted by kind, label and id, so the same data always gives the same picture. Hover or focus lights the item, its direct links and its path back to the start, and the rest fades by opacity only. Tab moves between items, Enter opens, Escape goes back. Under 641px, and on the List toggle, the same items show as a text list, and on touch the first tap lights an item and the second opens it. Key T works on a task, project or person page, and with the task drawer open (no other key does). Judgement calls: (1) the edge kinds follow the panel words: Part of and People are `part_of`, Waits on and Waiting on it are `waits_on`, Mentioned in is `mentions`, Owner, Lead and Owns are `owns`. (2) A project's panel does not list its tasks, so a map from a project shows a task only when that task is reached by its own "Part of" link. (3) A task's panel has no owner line, so the map has none either. (4) The "From", "Links" and "Checkpoints" lines are left out, because they point at things that are not tasks, projects or people. No schema change. Rollback: `git revert <this commit>`; no data to undo and no `upgrade()` step.

- **2026-10-13 · Sonnet 5.5 (claude-sonnet-5-5) · Team chat inside the app.** The pilot measure is no WhatsApp reminders and no spreadsheets, so everyday back and forth now lives next to the tasks. There is one team room, and one room per project for whoever can see that project. There are no direct messages, because they would sit outside the visibility rules. A message is stored in `chat_messages`, with its refs in `chat_refs`, a read mark per person and room in `chat_reads`, and the tasks made from it in `chat_task_links`. `notices.message_id` lets a mention notice point at a message. The room id is the team id or the project id, so a hidden project's room reads as missing, the same as the project. `@person` and `#task` parse as comments do, and the server checks them again. A mention writes an in-app notice and sends nothing. Only the author edits or deletes, and a delete is soft ("Message removed"), so undo never hard-deletes. "Make a task" opens the normal new task form, filled in, and a person adds it. The link back is checked before the task is made, so a hidden message leaves no loose task. The URL carries the message id, not its text. Pages use a message-id cursor, because millisecond timestamps lose the microseconds. Updates come by polling every 10 seconds while the tab is visible, with no websockets. That is enough for a pilot team and keeps the hosting simple. The file is `lib/teamchat.ts` because `lib/chat.ts` is the WhatsApp paste parser. Judgement calls: the typed limit is 3500, so a name that is longer than its token still fits under the server's 4000. The keyboard closes after a send on a touch screen only. Known limit: an edit or removal of a message older than the newest page shows after a reload. Rollback: `git revert <this commit>`. The new tables and the column are additive and unused by older code, so the hosted database needs no change back. Run `npm run db:upgrade` before promoting a build that uses chat.

- **2026-10-13 · Opus 5.5 (claude-opus-5-5) · Restore the PM's Home and project layouts.** The PM asked for the original layout back after the 13 Oct batch. The baseline is the PM's last commit, f9d0fe7. Home loses the "At a glance" charts and the guide note, so it reads greeting, Updates for you, Waiting on you, then the date groups. The projects list goes back to one progress bar with "done · open · overdue" (`projectCounts`), in place of the five-part status bar. The project page loses the status bar under the header and the "Done against due" chart, so the header, the counts and the board sit together at the top. The Meeting section and the lead's health line move below the board, and the agenda starts closed. Connects to, Chat and Comments stay below the board. Every feature stays reachable, and `/guide` stays in the account menu. `components/ProjectVisuals.tsx`, `components/HomeGlance.tsx` (the person page still uses `PersonGlance`), `lib/glance.ts` and `lib/progress.ts` are kept, so the charts can come back by choice. No schema change. Rollback: `git revert <this commit>`.

- **2026-10-13 · Opus 5.5 · Two skins, Light by default, at the PM's call.** The Appearance menu offers two skins:
  Warm (W, was NicoWarm) and Cool (M, was NicoOS). Each comes in Light or Dark, and anyone can pick either. Warm and
  Light are the default. System is gone from the light/dark choice, so the OS setting no longer decides: `data-theme`
  is always set, and a missing or old `nd_theme` value (including `system`) reads as light. An old skin pick (`a`, `b`,
  `c`, `i`) reads as Warm. The cookie ids stay, so a Warm or Cool pick is kept. The search box gains "Appearance: Light"
  and "Appearance: Dark". The token blocks of the four retired skins stay in `tokens.css`, unused, so this is easy to
  undo. No schema change. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Title Case for form labels and form headings, at the PM's call.** The Start a project form
  reads "Project Name", "Project Description", "Category (Optional)", "Target Date", "Project Owner", "Project Lead",
  "Other People", "Can Also View", "Partner Name", "Their People", "Sub-Projects (Optional)", "Partner / Collaboration",
  and the titles "Start a Project" and "Project Settings". Hints, notes, placeholders, the target-date options and
  buttons keep sentence case. The target-date options are stored as the project's label, so "Quarter end" stays as it is,
  which keeps older projects matching. This narrows `DESIGN.md`'s "sentence case everywhere" and answers question 1 in
  `docs/DESIGN-GUIDE.md`. Other forms move over as they are touched. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Connects to and the thread map removed, at the PM's call.** The "Connects to" panel is gone from
  the task drawer, the task page, the project page and the person page, and so are the thread map page (`/map`), its API
  (`/api/v1/threads/map`, `/api/v1/tasks/[id]/threads`), key `T`, its help terms, its CSS and its tests
  (`lib/threads.ts`, `lib/threadMap.ts`, `lib/threadLayout.ts`, `ConnectsTo.tsx`, `ThreadMapView.tsx`). Comments with
  `@` and `#` stay; they never depended on threads. Nothing was stored for threads, so there is no data or schema to undo.
  Tests drop from 833 to 763. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · The Appearance row says "Default", at the PM's call.** The closed row reads "Default" on Warm
  and Light, the setting everyone starts on, and otherwise the skin picked ("Cool", or "Warm" on Dark), so it never says
  Default when it is not. The list reads "Warm (Default)" and "Cool". The skin names in the search box stay Warm and Cool.
  Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Team chat removed for V1, at the PM's call.** V1 should be simple, clear and easy to pick
  up, and the team already talks on WhatsApp and Google Chat, so a third place to talk splits the conversation. Talk
  about a task stays in its comments, and "Paste a chat" (WhatsApp to tasks) stays. The chat merge (`8de69f0`) is
  reverted in code: the Chat tab, `/chat`, the project-page chat card, the chat API, "Make a task" from a message, the
  unread count, chat mentions on Home, its help terms, CSS, fixtures and tests. The tables (`chat_messages`, `chat_refs`,
  `chat_reads`, `chat_task_links`, `notices.message_id`) stay in `lib/schema.ts` and `upgrade()`, so messages already on
  the live database are kept and nothing there needs a change. The idea for later is an assistant that answers
  questions from the desk's data (ROADMAP, Later). Tests drop from 765 to 715. Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Anyone on the team can start a project, at the PM's call.** A project need not be a big one:
  a team's own internal work is a project too. `createProject` now asks only that the person is on the team, and
  "+ New project" shows for everyone except under View as. Editing, archiving and adding people stay with the project's
  owner, its lead, a team lead or an admin. Adding tasks was already open to every member (inside a project, only to its
  people). Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · New task form labels, at the PM's call.** The New Task page and a project board's add form
  use Title Case for labels (New Task, Due Date, Sub-Project, Note (Optional)), following the form-label rule in
  `DESIGN.md`. "What it's about (optional)" becomes "Details (Optional)" with the hint "Anything the owner should know".
  "Due date (kept as the first date)" on the board form is now "Due Date". Rollback: `git revert` this commit.

- **2026-10-13 · Opus 5.5 · Quick Add reads a sentence, takes a pasted chat, and listens, at the PM's call.** A person
  types or says what needs doing the way they would tell someone ("ask Sam to send me the design files by Monday for
  Autumn landing page"), and the form fills in the task name, owner, due date and project to check before Add task.
  With `ANTHROPIC_API_KEY` set the sentence goes to Claude masked (`lib/redact.ts`, as Paste a chat does) and the answer
  is checked against the roster and the projects the person can see; otherwise, or on a bad answer, plain rules read it
  (`lib/sentence.ts`). Nothing is written or stored. The separate "Paste a chat" button is gone: a chat pasted into
  Quick Add opens the same review, so status and date changes from a chat still work. The mic uses the browser's own
  speech service (Web Speech API), which in Chrome sends the audio to Google to turn into text; it is hidden where the
  browser has none, and nothing is recorded or kept by the app. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · Quick Add takes several tasks at once, at the PM's call.** One Quick Add can hold up to ten
  tasks, typed or said ("Sam, can you schedule the review by Friday? And then Kabir, can you get back to the vendor by
  Monday"). One task fills the form as before; several open a list of cards to check, each with Add and Skip, and Add
  all. Each card goes through the normal task route, so the project-people rule, View as and the log all hold. The model
  answers a list; the rules split on lines, list markers, sentence ends and joining words, and read a name spoken to
  ("Sam, can you ...") and "I need to ..." as the owner. The label reads "Quick Add", without "(Optional)".
  Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · New task form wording, at the PM's call.** Quick Add and the form sit on one card with a soft
  rule between them labelled "Fill It In Yourself". The page line reads "Say it in one line, or fill it in yourself." The
  description is "Details (If Any)", hint "Anything the owner should know"; Note stays "Note (Optional)" with no hint.
  The project list's empty choice reads "None (one-off task)". The line "The due date is kept as the first date. Moving
  it later needs a reason." leaves the form: the move-date form already asks for the reason when it applies.
  Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · The ledger's week-by-week tables are gone, at the PM's call.** The tiles, the Delivery habits
  cards (per person, last 4 weeks), the done split and Needs attention already show every number the tables held, so
  the tables only repeated them by week and made the page read like a spreadsheet. The collapsed section keeps the
  definitions and is now called "Definitions". The intro reads "Kept dates, per person, over the last 4 weeks." Every
  number on the cards still opens the tasks behind it. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · "(optional)" and "(if any)" are lower case, at the PM's call.** Wherever they appear, even
  inside a Title Case label ("Category (optional)", "Details (if any)"). Other notes in brackets are not covered by this
  rule ("Warm (Default)" keeps its capital). `DESIGN.md` Typography holds the rule. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · Feedback lives on the Feedback tab, open to everyone, at the PM's call.** "Send feedback"
  leaves the account menu, where it was hard to find, and the Feedback tab is now in everyone's sidebar under More.
  The tab has the writing box at the top and the team's notes below, newest first, with name, date and time. Everyone
  reads every note, whatever their role, so the team sees what others raised. Only an admin marks a note read, and a read
  note stays on the list. The page a note is about is now picked from the main screens, since the box no longer sits on
  the page in question. Rollback: `git revert` this commit; `listFeedback` would then need its admin check back.

- **2026-10-14 · Opus 5.5 · Feedback gets screenshots and "Me too", at the PM's call.** A note holds one thought and up
  to three screenshots, pasted, dropped or picked, shrunk in the browser to under 600 KB and kept in the database
  (`feedback_images`, like `person_photos`: no new service, works on previews). Only the writer adds pictures; any
  teammate sees them. "Me too" (`feedback_votes`) lets teammates back a note instead of writing it again; never on your
  own note, once per person. Both tables have RLS on and come through `upgrade()`. The hosted database needs
  `npm run db:upgrade` once before a build with this change is promoted. Rollback: `git revert` this commit; the two
  tables can stay, nothing else reads them.

- **2026-10-14 · Opus 5.5 · Feedback moves to the top bar, at the PM's call.** A "Feedback" button sits left of the help
  button on every page (the icon alone below 1180px and on phones), and Feedback leaves More, so there is one place for
  it. The page line reads "You're one of the first users of Nico Desk, and we'd love to hear your thoughts."
  Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · "Me too" is now "+1", at the PM's call.** The button on a teammate's note reads "+1" (pressed:
  "✓ +1"), and the form hint reads "One thought per note, so others can +1 it." The page line on Feedback sits on two lines,
  one sentence each. Replies to feedback wait for later. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · Feedback replies, no mark read, and a Roster for everyone, at the PM's call.** Notes pile up:
  "Mark read" and its route are gone (the `read_at` column stays, unused). Replies come only from people with
  `people.replies_feedback`, a Roster switch an admin turns on for the people building the app; no names are in the code.
  Everyone reads replies under each note. The writer sees new replies on Home ("Replies to your feedback"), cleared by
  opening Feedback or Mark seen (`feedback_replies.seen_at`). The Roster is in everyone's sidebar; only admins see the
  buttons that change it and the add form, and the service still refuses anyone else. The Roster gains "Make admin" so
  an admin can grant admin from the app; you cannot remove your own. The Roster's intro line is gone while who-sees-what
  is rethought. The hosted database needs `npm run db:upgrade` (adds `feedback_replies` and `people.replies_feedback`).
  Rollback: `git revert` this commit; the table and column can stay.

- **2026-10-14 · Opus 5.5 · Meeting box, agenda and comments off for V1, at the PM's call.** Project pages keep the
  header, counts, board, update log and completed tasks. The meeting box (rhythm, Meeting held, Write the minutes) and its
  agenda are gone from them, and so are comments: on project pages, in the task drawer, the "Mentioned you" card on Home,
  and comment results in search. Import minutes on the board stays. The code and tables stay (`lib/meetings.ts`, the
  meeting routes, `lib/comments.ts`, the comment routes, `comments`, `comment_refs`, the `meet_*` columns), so data on the
  live database is kept and either can come back. "Updates for you" and "Waiting on you" do not read comments or meetings
  and are unchanged. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · Ledger definitions rewritten, and project people on a grid, at the PM's call.** The
  definitions read in three short groups (Finished, Still open, Date changes), one line each, so they can be scanned at a
  glance; the meaning of each word is unchanged. A project's people now sit on an even grid (three columns on a wide
  screen, two on a phone), so each row lines up under the one above, and a long role wraps instead of being cut off.
  Rollback: `git revert` this commit.

- **2026-10-15 · Opus 5.5 · Only admins see every project; the ledger by role, at the PM's call.** Who sees a project:
  an admin sees all of them. Everyone else, leads included, sees the projects they own, lead, are on or were added to
  as a viewer (project Settings, Viewers), and outside those only tasks they own, that wait on them, or that they
  created with no project. `people.restricted` is no longer read and its Roster switch is gone; the column stays.
  The Ledger: a lead or an admin sees everyone's record in full, whatever the project (a task outside their projects
  shows, but is not a link). A member sees their own record and the full record of the people they work with now
  (anyone on a live project they own, lead or are on, and anyone a task of theirs waits on or who waits on them).
  Every task counts in those numbers; one the member may not see reaches the browser stripped of its title, words,
  project and reasons, and shows as "N more in projects you are not on". A person page's on-time record follows the
  same rule. Feedback: an admin can always reply, as can anyone with "replies to feedback". Unchanged: anyone creates
  tasks and projects, every people list holds the whole roster, and anyone on a project can paste minutes into it.
  No schema change. Shared with the team as the doc "Nico Desk: who sees what". Rollback: `git revert` this commit.

- **2026-10-15 · Opus 5.5 · "Moved off your plate" still shows when the task leaves your sight, at the PM's call.** Since
  only admins see every project, a task with no project that someone else made disappears for its old owner once it is
  given to another person. Their "Moved off your plate" notice now still shows on Home, with the task's title only and
  no link; every other notice on a task they cannot see is still dropped. Rollback: `git revert` this commit.

- **2026-10-15 · Opus 5.5 · A search box on Reminders, at the PM's call (14 Oct).** Above the drafts, when there is more
  than one, a "Find a person" box narrows them by name; Escape or "Clear search" brings them all back. Nothing else on
  the page changes. Rollback: `git revert` this commit.

- **2026-10-14 · Opus 5.5 · Mic allowed for this site, and a new project loads its people.** The `Permissions-Policy`
  header said `microphone=()`, which blocked the Quick Add mic in every browser even when the person allowed it. It is
  now `microphone=(self)`: this site only, camera and location stay blocked. A new project opened with `router.push`
  kept the layout's old project-people map, so its Owner list was empty until a reload. `ProjectForm` now refreshes
  after the push. Rollback: `git revert` this commit.

- **2026-10-16 · Opus 5.5 · Clickable text gets a soft tint, motion settles, and Cool uses Geist.** The repo owner asked
  for hovered text with no underline, for better motion and structure taken from the handoff design system of another of
  their projects (they approved the borrowing), and for more drawn SVG motion. A text link or text button now fades in a
  faint accent tint behind it and turns the accent with a hairline stroke, so nothing reflows. A glow was asked for, but
  DESIGN.md bans glows, and the repo owner picked the tint instead. From the handoff: the settle curve for `--ease`, press
  scales of 0.96 for buttons and 0.98 for cards, a focus ring that fades in, fold-outs that open on grid rows and go inert
  when closed, and Escape in the account menu that closes an open flyout before the menu. New drawn motion: a tick in
  plan checkpoints and asks, a tick after Copy link and Copy invite, and a ring beside the ledger's kept share. Each new
  stroke or height move is a named exception in DESIGN.md Motion. Cool now uses Geist and Geist Mono, which `layout.tsx`
  already loaded, in place of the system face. Rollback: `git revert` this commit.

- **2026-10-16 · Opus 5.5 · Cool's top edge from the Tare handoff, a Roster tick and folds that scroll into view.** The
  repo owner sent a Roster screenshot: on Cool at desktop width, rows peeked above the floating top bar and around its
  corners, and the bar was wider than the cards below it. They picked the handoff's top edge and a bar that matches the
  cards. A literal mask on the scroll area would also clip the modals, drawers and search dropdown, which render inside
  it, so the top bar is an opaque cap instead: the page sheet scrolls on its own, the cap is in the sheet colour, and the
  glass pill inside it lines up with the page's column. Content fades out over up to 16px under the cap
  (`components/MainScroll.tsx`), and a new page starts at the top. The cost: on Cool at desktop width, Back and Forward no
  longer bring back the scroll position, and content no longer blurs under the bar. Also asked for: a drawn tick after a
  Roster role change, a fold that scrolls into view when it opens, and a stronger hover tint (20% of the accent).
  Warm and the phone layout do not change. Rollback: `git revert` this commit.

- **2026-10-16 · Opus 5.5 · Line icons redraw on hover, empty states and the sign-in wordmark draw in.** The repo owner
  asked for more drawn SVG motion, including on hover over Feedback and the help button. The sidebar and top bar icons
  move to `components/icons.tsx` with a pathLength of 1, so one `tick-draw` keyframe redraws any of them. The help
  button's typed "?" becomes a drawn one. Empty states with no picture get the page's own icon, drawn in. The sign-in
  wordmark is inline (`components/Wordmark.tsx`) so its letters can draw, then fill, within 300ms. There is no notice
  bell and no on-time bar on Team, so neither was added. All of it stops under reduced motion.
  Rollback: `git revert` this commit.
- **2026-10-17 · Opus 5.5 · Stroke draws slow down so they read as drawn.** The repo owner found the line draws too
  fast: at 160 to 240ms on the settle curve, a stroke looked like a flicker. Every stroke draw now runs on its own even
  curve `--ease-draw`, a tick over `--dur-draw-tick` (320ms) and a longer line (line icons on hover, empty-state marks,
  the sign-in wordmark, the Home trend line and dot, the ledger ring) over `--dur-draw` (480ms). This is a named
  exception to the 300ms rule for stroke draws only. The motion test caps `--dur-draw*` at 500ms and keeps 300ms for
  every other token. Reduced motion still sets both to 0ms.
  Rollback: `git revert` this commit.
- **2026-10-18 · Opus 5.5 · A line icon draws one path per stroke.** The repo owner found the Team, Ledger and Roster
  icons rushed and odd on hover. Each icon was one path of several strokes with one shared pathLength, and the dash
  restarts on each stroke, so every stroke started together and a short one finished early. `Icon` now splits the
  path at each move, so every stroke draws over the full `--dur-draw`.
  Rollback: `git revert` this commit.
- **2026-10-19 · Opus 5.5 · Reminders check that each item is still needed.** The repo owner chose rules first, then
  Jev, and a flagged item left out with a way to add it back. Code flags an item when it is blocked on someone else,
  when its owner changed it or commented on it in the last 2 days, or when it was in a reminder to that person in the
  last 2 days. Then Jev, only when `jevOn` (so not on the live pilot), reads the owner's latest note on each task still
  unflagged and flags it at 0.65 when the note says done or no longer needed. Each item on the Reminders page has a
  tick box. A flagged item starts unticked with its reason, and ticking rebuilds the subject and the text (a hand edit
  is replaced). Items carry a key, and a logged reminder keeps the keys in the new `reminders.item_keys` column (added
  in `upgrade()`; an older row has none and flags nothing). The hosted database needs `npm run db:upgrade` before this
  build is promoted.
  Rollback: `git revert` this commit. The `item_keys` column can stay: nothing else reads it.
- **2026-10-19 · Opus 5.5 · Security fixes before active use (audit 19 Oct, A to D).** The repo owner said yes to four
  fixes. A: reminders now follow the lead's own sight (`lib/sight.ts`), so a draft never names a task or a plan line
  the lead cannot see, and a hidden project id reads as missing. B: the minutes, chat and sentence model reads stay off
  against the hosted database unless `NICO_MODEL_LIVE=1` (`modelOn` in `lib/model.ts`), the same rule as Jev, because
  the live pilot holds real work text. Minutes are now masked like a pasted chat, with the partner names added.
  C: the connections status no longer returns the last 4 characters of a key. D: `PUBLIC_API_LOCK` in `lib/schema.ts`
  takes every right from the Supabase `anon` and `authenticated` roles and adds a restrictive `deny_public_api` policy
  on every table. It runs at the end of `reseed()` and `upgrade()`, only where those roles exist, so PGlite skips it.
  USAGE on the schema through PUBLIC stays, because Supabase's own roles need it, and it opens no table. Team-scoped
  policies under a non-owner role are not done yet. The hosted database needs `npm run db:upgrade` to get D.
  Rollback: `git revert` this commit. For D on the hosted database: `GRANT USAGE ON SCHEMA public TO anon,
  authenticated; GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;` (and SEQUENCES, FUNCTIONS), then
  `DROP POLICY IF EXISTS deny_public_api` on each table.
- **2026-10-19 · Sonnet 5.5 · Setup check-list for a new lead.** A project page shows a short check-list to its owner,
  its lead and any lead or admin: add people, add the first work, read the first minutes and, on a plan board, name the
  partner. Each step ticks from data already in the database (`lib/setup.ts`), so nothing new is stored and there is no
  schema change. Each button opens UI that already exists (Settings, the add form, Import minutes) through a window
  event. Hiding the list is kept per person and per project in the browser (`localStorage`), and "Show the setup list"
  in Settings brings it back. Under View as it shows with no buttons and no hide. The rhythm step is built but off
  (`MEETINGS_ON` in `lib/setup.ts`) until gate G1 in `docs/PLAN-19-OCT.md`: the PM has not said yes to meetings coming
  back. Rollback: `git revert` this commit.
- **2026-10-20 · Opus 5.5 · Setup list: new projects only, and each button lands on its part.** The repo owner picked
  option 1: the list shows only on a project whose `_created` event is at or after `SETUP_SINCE` in `lib/setup.ts`
  (20 Oct 2026, IST). Projects made before the list shipped, and every seeded project, never show it, so no lead
  opens an old project to a check-list. Two gaps found in the browser check are fixed. First, "Add people" and "Name
  the partner" open Settings at that part: the setup event carries the step key, the form scrolls it into view and,
  on desktop only (`focusOnDesktop`), focuses it one frame later. The frame matters: the scroll fires its own event,
  and `KeyboardDismiss` blurs a text field that is focused before that event. Second, "Import minutes" on a task board
  now brings the panel into view after the render that adds it, and both board scrolls stop below any sticky bar over
  the column (the Warm top bar on desktop, the side bar at phone width). Checked in Warm and Cool at desktop and 375px.
  Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · `web/.vercelignore` keeps local data out of a CLI upload.** A `vercel deploy --prod` from
  `web/` failed (the project root is `web`, so the CLI must not upload from inside it) after it had uploaded the
  folder with no ignore file. That upload likely carried the git-ignored `web/.data/` and `web/pilot/` to the repo
  owner's own Vercel account. The failed deployment was removed with the repo owner's yes. Production still builds from
  git: promote the `maahir/mvp` git preview (`vercel redeploy <preview> --target production`, or the dashboard).
  Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · Team fence: row level security that binds the app.** The app connects as the table owner,
  and RLS does not bind an owner, so the `deny_public_api` lock from 19 Oct did nothing for the app's own reads. The
  repo owner picked the team fence. `TEAM_FENCE` in `lib/schema.ts` makes the role `nico_app` (no login, no inherit,
  no bypass), grants it to the app's login and adds one `team_fence` policy per table, built from the `FENCE` map: a
  row is visible only when it belongs to the team in `app.team_id`, directly or through its project, task, comment,
  message, room or person. `scoped(d, teamId)` in `lib/db.ts` runs each call in a transaction that first sets
  `app.team_id` and the role with `set_config(..., true)`, so both end with the transaction and are safe with the
  pooler. No team set means no rows: the fence fails closed. `route()`, `lookups()`, the layout and the pages that read
  outside them use `scoped()`. Sign-in, the dev picker, the session route, the sign-in callback and the reminders cron
  stay on the owner connection, because they run before a team is known or across teams. Person sight stays in
  `lib/sight.ts`: the fence is a second wall, not a replacement. No new login or Vercel env var is needed. Limits: a
  query that ran `RESET ROLE` would leave the role (every query is parameterized, so the risk is low). Each scoped
  query costs about four round trips on the hosted database. On a database with many teams, `addPerson` cannot see a
  person on another team, so a duplicate email shows the database error, not the friendly one. Feedback is fenced by
  the writer's team. `tests/fence.test.ts` checks a policy on every table, nothing with no team, no cross-team reads
  or writes, and the owner role back after each call. The hosted database needs `npm run db:upgrade` before a build
  with this is promoted. Rollback: `git revert` this commit, then on the hosted database `DROP POLICY team_fence` on
  each table, `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM nico_app; REVOKE USAGE ON SCHEMA public FROM nico_app;
  DROP ROLE nico_app;`.
- **2026-10-21 · Opus 5.5 · Team fence rolled back on production until the database has it.** The fence build was
  promoted before `npm run db:upgrade` had run: the upgrade timed out because this network blocks ports 5432 and 6543.
  Every signed-in page failed with `role "nico_app" does not exist`. Production went back to the pre-fence build with
  the repo owner's yes. Lesson: before a promote, check that the upgrade printed success, not only that it was started.
  Next: run `db:upgrade` from a network that reaches the pooler, then promote the `2d67293` preview again.
  Rollback: not needed, this entry changes no code.
- **2026-10-21 · Opus 5.5 · Profile page, nickname and four UI fixes from the repo owner's screenshots.** A profile
  page at `/me/profile` (account menu: Your profile) replaces the Edit profile dialog. It edits the name, a nickname,
  the phone and the photo. The nickname is a new nullable `people.nickname` column (1 to 40 characters, in the schema
  and `upgrade()`); SQL reads `COALESCE(nickname, display_name)` and `Person.displayName` carries the nickname, so it
  shows everywhere with no change at each call site. The roster name stays as `fullName`: the Roster and the person
  page show it beside the nickname, and paste, minutes and reminders match either name, so a nickname never breaks a
  match. Redaction masks both. UI fixes: on narrow pages in the Cool skin the top bar reserves the button space at
  every desktop width and Feedback goes icon-only, so the search no longer runs under it; a person link's hover tint
  and stroke start after the avatar; the Roster email and access text go from 12px to 14px; a row of checkboxes with a
  button centres on the button height and puts the button at the end. The hosted database needs `npm run db:upgrade`
  before a build with this is promoted. Rollback: `git revert` this commit, then on the hosted database
  `ALTER TABLE people DROP COLUMN nickname;`.
- **2026-10-21 · Opus 5.5 · A name or nickname cannot be someone else's.** A security review of the profile commit
  found that a teammate could set their nickname to another person's roster name and so take that person's reminder
  items, pasted chat lines and minutes proposals. `setNames` now refuses a name or nickname that matches anyone else's
  name or nickname, ignoring case and spacing (`name_taken`). Name matching in reminders, paste and minutes now tries
  roster names before nicknames, so older clashing data still routes to the roster name.
  Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · The name check covers first names and cannot be raced.** A second review found two gaps in
  the check above. Paste and minutes fall back to a first name, so a nickname equal to someone's first name could
  still win over them; the check now also refuses another person's first word. Two saves at the same moment could
  both pass the check; the check and the save now run in one transaction behind an advisory lock.
  Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · The name check uses the matcher's key.** A third review found the check folded only case
  and spaces, while quick-add also folds accents and punctuation, so "Cée!" passed the check and still matched "Cee".
  The check now reads every name under the lock and compares with quick-add's own `norm`: the whole name with spaces
  removed and the first word, in both directions. A value the person already holds is not checked again, so a roster
  name that shares a first name with a teammate still saves. A value with no letters or numbers is refused.
  Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · Team fence and nicknames live on production.** `npm run db:upgrade` printed success on the
  hosted database, and a catalog check found `nico_app`, `people.nickname`, and a `team_fence` and a `deny_public_api`
  policy on each of the 31 tables. Then the `6cb4805` preview was promoted with the repo owner's yes. Signed-in calls on
  production now run as `nico_app`. Rollback: promote the pre-fence build `phc7c97t9` again. The database changes can
  stay, because the old build runs as the table owner and the policies do not bind it.
- **2026-10-21 · Opus 5.5 · Hover tints do not stack, and the narrow top bar keeps its gap.** In a row or card with
  its own hover fill, a link drops its tint and keeps the accent and the stroke: the two fills read as selected text. A
  person link's tint is one text line tall, not the avatar's height, and in a table cell the link takes one line, so the
  name centres with the other columns. In Cool, the room kept for the Feedback and help buttons on narrow pages and
  from 861 to 1180px was 4px short, so the search ran under Feedback. It is now `--bar-tools`, which leaves a 12px gap.
  DESIGN.md Motion says the tint rule. Rollback: `git revert` this commit.
- **2026-10-21 · Opus 5.5 · Clickable text has no hover fill anywhere.** The repo owner wanted the roster's look on
  every clickable text, so the accent tint behind hovered and focused links is gone site-wide, with the row-only
  exception it replaced. Hover and keyboard focus show the accent colour and the hairline stroke only. The
  `--link-tint` token stays for the two buttons that mix it into their own hover fill. DESIGN.md Motion says the new
  rule. Rollback: `git revert` this commit.

- **2026-10-21 · Opus 5.5 · Two page widths, and every title has the same space under it.** The repo owner found
  Your profile, and its search bar on Cool, much narrower than the rest of the site, with the card pressed up under
  the title. The 640px narrow column is retired: Your profile, New task, Search, Connections and the Guide now use the
  980px `calm` column, as Home and Team do. Form cards lose their 680px cap and fill their column like every other
  card. Your profile and Roster put their title in a `page-head`, as the other pages do. The look of the full and calm
  pages does not change. DESIGN.md Layout states the rule. Rollback: `git revert` this commit.
- **2026-10-26 · Opus 5.5 · Next.js 16.4.3 and Zod 4.6.7 for new advisories.** `npm audit` found a critical Next.js
  set (GHSA-2464-fhr4-w9xw, an unauthenticated remote code execution through the image optimizer with SVG files, and
  two more) and a high Zod memory advisory (GHSA-mrhx-c7xc-m3w5). Next 16.4.0 now refuses to build while affected. Both
  are patch bumps, and the tests and build pass on them. Rollback: `git revert` this commit, which will not build.
- **2026-10-26 · Opus 5.5 · Archive drops open work, and an admin can delete an archived project.** A pilot lead could
  not remove projects: production logs showed each archive refused with `open_work`, because the old rule asked for
  every task to be closed by hand first. Archive now names what is open and asks for one reason. With it, open tasks
  are marked Dropped through the normal rules (one event each, carrying the reason), open plan lines are removed,
  and the project is archived in one transaction. A task mirrored from a Sheet still stops it, because the app does not
  own those (production has none). Leads, owners and admins archive, as before. On an archived project, an admin also
  sees Delete for good, which needs the project name typed. It writes a `_deleted` project event first, while the team
  fence can still see the project, then deletes the project, its tasks and everything hanging on them. Events stay,
  so the record of the project outlives it, readable only on the owner connection. `plan_activity` is append-only, so
  its guard now lets a delete through only for the project named in the transaction-local `nico.purging` setting,
  which only `deleteProject` sets. The guard is in `upgrade()`: the hosted database needs `npm run db:upgrade` before
  this build is promoted, or deleting a partner plan fails (other deletes and archive work without it). Rollback:
  `git revert` this commit. The new guard can stay: with no `nico.purging` set it behaves as the old trigger.
- **2026-10-26 · Opus 5.5 · Archive with drop, admin delete and the patched Next.js live on production.** With the
  repo owner's yes: pushed `5eaa1ab`, ran `npm run db:upgrade` (a catalog check shows `plan_activity_no_change` now
  runs `plan_activity_guard`), and promoted the preview as `nico-desk-j75v7r3xz`. `/team` answers 200. Rollback:
  promote `nico-desk-1tojabz51` again. That build is on the vulnerable Next.js, so use it only as a stopgap. The guard
  can stay.
- **2026-10-26 · Opus 5.5 · OKR weekly meeting actions copied onto its new partner board.** A lead moved the AI OKR
  weekly meeting from a task board to a new partner (plan) project. To archive the old one they ticked its 17 open
  tasks Done, one by one. A plan page shows plan actions only, so the team saw every action vanish. With the repo
  owner's yes, one SQL statement on production copied the 32 tasks that were not dropped into the new project as
  `plan_actions`: 17 open (closed only to archive), 15 done (closed before that day). Each keeps its title, owner,
  due date and creator, with `source = {title, from_task}` pointing at the old task. One `plan_activity` line records
  it. The archived project and its events stay as the history. The gap stays open: there is no way to switch a
  project's kind or move its tasks, and archive pushes people to tick work Done. Rollback: `DELETE FROM plan_actions
  WHERE project_id = 'prj_mvow718w1pqejc' AND source ? 'from_task'` (the activity line stays, append-only).
- **2026-10-26 · Opus 5.5 · Sounds leave the account menu and are off.** The PM asked for the Sounds on/off item to go
  from the menu under their name. With no switch left, `play()` in `components/sound.ts` returns at once
  (`SOUNDS_OFF`), so a person who had turned sounds on before is not left with tones they cannot stop. The tones, the
  `nd_sound` cookie and the help word stay, so they can come back with the switch. Rollback: `git revert` this commit.
- **2026-10-26 · Opus 5.5 · Line icons stay still.** The PM saw the sidebar icon draw itself each time they switched
  tabs: the redraw on hover replayed on every click. The sidebar icons, Feedback and the help button no longer move on
  hover. An empty state's mark still draws in once. DESIGN.md Motion says the rule. Rollback: `git revert` this commit.
- **2026-10-26 · Opus 5.5 · Sounds off and still line icons live on production.** With the repo owner's yes: merged
  the design branch into `maahir/mvp` as `0b002d2` (only DECISIONS conflicted, both sides kept), pushed it, and
  promoted its preview as `nico-desk-p6uramot3`. No schema change, so no `db:upgrade`. `/team` answers 200, and the
  live CSS has no hover redraw on the line icons. Rollback: promote `nico-desk-j75v7r3xz` again.
- **2026-10-26 · Opus 5.5 · Pasted notes read as blocks, not one task per line.** The repo owner said the text-to-task
  reader made a task of every line and lost the context. `lib/blocks.ts` now reads pasted lines for both Quick Add
  (`readTasksRules`) and the minutes reader (`plainParse`): a heading gives its project or owner to the lines under
  it, sub-bullets and plain statements become the task's details, a wrapped line is one line, greetings, attendee
  lists and thanks are dropped, "All by Friday" dates its section, and "he should also" keeps the owner before it.
  Quick Add drafts carry the details into a Details box, and a multi-line paste goes straight to drafts. The model
  prompt gets the same rules and a `details` field. Outside check on the 20 synthetic meeting transcripts: steps
  drafted 275 to 235, expected tasks found 67 of 69 both before and after. A further rule (drop a "Name: statement"
  line) cut wrong steps 49 to 30 but lost 7 real ones, so it was not kept. 21 new tests, 797 pass. Rollback:
  `git revert` this commit.
- **2026-10-26 · Opus 5.5 · Check drafts asks whether a draft commits anyone to work.** The repo owner asked for more
  Jev uses. Check drafts now asks one more yes/no per draft, on the stored `owner: task` text: does it commit or ask a
  person to do a piece of work after the meeting? Below `NOT_TASK` (0.2) the draft is noted as a remark. Jev still
  writes nothing. Outside check on the 20 synthetic meeting transcripts (235 drafts, one batched call each, 8 seconds
  in all): the old clarity score marked 30 of 49 known remarks and 0 real steps; the new question puts 40 of 49
  remarks below 0.2 and 0 of 68 real steps (the lowest real step scored 0.37). It misses steps cancelled later in the
  meeting and injection lines; those need their own checks. Jev stays off in production until the repo owner turns it
  on. 1 new test, 798 pass. Rollback: `git revert` this commit.
- **2026-10-26 · Opus 5.5 · Minutes from a Google Doc become tasks the same way as Granola.** The repo owner asked for
  a Google Doc source for minutes. It reuses the Google Meet link: `documents.readonly` joins `MEET_SCOPES`, so one
  connect covers Meet and Docs, and a lead linked earlier gets `docs_reauth` and connects again. The lead pastes a Doc
  link in a new Google Doc tab; `readGoogleDoc` reads it with the Docs API and writes headings, bullet depth, person
  and date chips, tabs and an Owner/Task table as lines for the existing minutes reader, so nothing new decides what a
  step is. The route is POST so the Doc link stays out of request logs, lead or admin only, refused under View as.
  The source id is `docId@date`, so a running weekly Doc imports once per meeting. Not chosen: `drive.file` with the
  Google Picker, which asks less of Google but needs a picker key and more UI; it stays an option if verification
  becomes a problem. Not yet checked against a live Google account. 8 new tests, 806 pass. Rollback: `git revert`
  this commit; leads who reconnected keep a link with one unused scope.
- **2026-10-26 · Opus 5.5 · An admin adds a whole team in one paste.** The access check found that a company address
  gets in only when an admin has put that person on the roster, and the repo owner kept that rule over any company
  address joining on first sign-in. To make adding an adopting team quick, the Roster page gets an "Add several
  people" box: one person per line (name, job title, department, email), tabs from a sheet or commas. Everyone joins as
  a member; lead and admin are set after, one by one. `addPeople` runs in one transaction, and an email already on
  the roster is skipped and named back, so the same paste twice adds nobody twice. The route takes 1 to 100 rows. The
  consent screen is Internal (the repo owner's word), so only company Workspace accounts pass Google's side: an
  outside address in `NICO_ALLOWED_EMAILS` cannot sign in by Google while that holds. 1 new test, 807 pass. Rollback:
  `git revert` this commit; people added by it stay on the roster and are marked inactive by hand if needed.
- **2026-10-26 · Opus 5.5 · Security review fixes, a steady build, and nightly backups.** The review before the first
  adopting team found two things worth fixing now. (1) A Granola, Fireflies or Fathom key saved from the page served
  every lead on the team, so any lead could read the meetings of whoever saved it, or replace it. On Vercel the key
  file is now ignored and saving or removing a key is refused (409 `key_env_only`); keys there are env vars only.
  (2) The roster picker and open demo were locked only by `DATABASE_URL`. A Vercel production deploy is now locked as
  well, with no override; previews stay open because they run the demo on fixtures. The flaky build (`Aborted()` while
  prerendering `/status`, `/week` or `/_not-found`) came from `currentMe()` opening PGlite before it read cookies, so
  nine build workers opened the same folder at once. Cookies are read first now: 2 of 2 builds failed before, 0 of 5
  after. The free Supabase plan has no backups and SPEC asks for daily ones kept 14 days, so `scripts/backup.sh` runs
  `pg_dump` (session port) to `~/Backups/nico-desk/`, checks the archive, and drops files older than 14 days. A restore
  into a throwaway Postgres 17 matched production: 108 tasks, 493 events, 62 policies, 31 tables with RLS. The nightly
  launchd job is installed by the repo owner. 2 new tests, 809 pass. Rollback: `git revert` this commit; to stop
  backups, `launchctl bootout gui/$(id -u)/com.nicodesk.backup`.
- **2026-10-28 · Opus 5.5 · A field guide for the team, and two stale docs fixed.** The repo owner asked for one easy,
  visual how-to for every feature before the first team adopts the app. `docs/guide/index.html` is a single static page
  in the Warm skin, light and dark, with working models of each screen and made-up example data. Features that are off
  in production sit on a "Not on yet" page, and unmounted parts (comments, mentions, sounds) are left out. The `sounds`
  help word goes from `components/help.ts`: no screen shows it since the switch left, and this replaces the 26 Oct note
  that it stays. The tones and the `nd_sound` cookie stay. `web/README.md` now says Feedback is in the top bar, not
  under More. Rollback: `git revert` this commit.

- 2026-10-28 · Opus 5.5 · `maahir/mvp` merged into `main` (fb3fedd), and production now builds from `main`. A partner
  teammate's local copy did not match the live app because production was promoted from `maahir/mvp` while `main`
  stood at 14 Oct. The sponsor asked for this on 26 Oct. The push to `main` built and served fb3fedd, which is cf53015
  plus the field guide commit and `docs/OKR-DESIGN.md`, with no schema change. Eight old unpushed commits on the repo
  owner's local `main`, from 9 Oct, were left out: `maahir/mvp` replaced that work. `web/README.md` Hosting states the
  flow. Rollback: `vercel promote nico-desk-75md6ijko-maahirbharatram-3547s-projects.vercel.app --yes` from `web/`.
- **2026-10-28 · Opus 5.5 · An MCP server, so a teammate can use the app from Claude.** The founder listed the v1
  tools in Slack on 27 Oct, and the sponsor asked for a serverless function on Vercel with Google sign-in, usable from
  Claude Desktop without first signing in to the app. `app/api/mcp/` answers JSON-RPC by hand (no SDK): the stateless
  2026-07-28 revision and the older `initialize` handshake. Seven tools (`list_my_tasks`, `search_tasks`, `get_task`,
  `create_task`, `update_task`, `add_comment`, `get_project_summary`) call `lib/service.ts` through `scoped()` as the
  signed-in person, so they see and change only what that person could in the app. Deletes, bulk edits and people
  changes are left out, as the founder asked. Writes run inside `via.run('claude')` (`lib/origin.ts`), so events get
  `origin = 'claude'` and comments `via = 'claude'`, and the history reads "(via Claude)". nico-desk is its own OAuth
  server: dynamic client registration, PKCE S256 and RFC 8707 resource checks. Only Claude's own callback pages and
  loopback addresses may receive a code. The person approves at `/connect`, with their app session or with Google.
  Client ids, codes and tokens are sealed values under `NICO_SESSION_SECRET` with their own labels, so nothing is
  stored. The cost of that: a code can be redeemed more than once inside its one minute, and an old refresh token stays
  good until its 30 days end. Every call still checks that the person is active and allowed, so deactivating someone
  stops them at once, and rotating the secret stops everyone. The report-only CSP `form-action` now lists Claude and
  loopback, so the consent form's redirect still works once the CSP is enforced. A schema change (the `events` origin
  check allows `claude`, and `comments.via`) needs `npm run db:upgrade` before the merge. 18 new tests. Rollback:
  `git revert` this commit. The added column and the wider check are harmless to the old build.
- **2026-10-28 · Opus 5.5 · An activity log for the admins.** The pilot lead asked to see "how many people are even
  updating, reviewing", for the three people running the pilot. `/activity` lists each active person with the days they
  opened the app, their changes (task and project events plus plan board actions), comments and chat messages, for the
  last 7 and 30 days by Kolkata day. Counts only, never content, so it reads as a pulse and not a surveillance log.
  Opening the app had no record, so a new `visit_days` table keeps one row per person per day, written on the first
  signed-in request (demo and View as visits are not counted, and a failed write never stops a page). It has RLS on
  and a `team_fence` policy like every table. Admins see it, and `NICO_ACTIVITY_EMAILS` narrows it to named admins,
  since production has more admins than the three. Needs `npm run db:upgrade` before the merge. 7 new tests.
  Rollback: `git revert` this commit, then `DROP TABLE visit_days` on the hosted database if wanted.
- **2026-10-28 · Opus 5.5 · "Added since" on the Team page, and fixes from a review of the MCP and activity work.**
  The founder enters to-dos in the app during a meeting and asked for a filter to see the ones entered after a time,
  to close the meeting by reading them back. It is a filter on the Team page and not a new page, so the person and
  status groups, the project filter and the task drawer all still work. The cutoff is a time and not a date, because a
  meeting is an hour, and it is read as India time (`istInstant`, fixed +05:30). The list ignores the week and runs in
  the order tasks were made, since that is the order the meeting agreed them. Dropped tasks are left out, because
  dropping is how a to-do is taken back. Visibility is unchanged: it filters the same `seenTasks` list. An independent
  review of the MCP and activity commits found, and this fixes: `comments.via` was only added by `upgrade()`, so a
  `db:remote` reseed would break every comment post (now also in `SCHEMA`). "Changes" counted sheet and Granola
  imports as the person's own (now app and Claude only). The activity order compared a UTC midnight with IST times (now
  IST). Accepted and not changed: MCP codes and refresh tokens are sealed and stateless, so a code can be redeemed more
  than once in its 60 seconds and a refresh token cannot be revoked alone (deactivating the person or rotating the
  secret stops it). The consent screen cannot tell which Claude account will receive the code, as with any public
  claude.ai connector. 5 new tests. Rollback: `git revert` this commit.

- **2026-10-28 · Opus 5.5 · A company account claims its placeholder row by name.** Seven pilot people were added
  before their addresses were known, so their rows hold a placeholder on the reserved `pending.invalid` domain and
  their Google sign-in was refused as "not on the roster". The repo owner asked for sign-in to work without collecting
  each address. Now a verified Google account on the company domain, with the Workspace `hd` claim on that domain,
  that matches no row takes the one active placeholder row whose full name (or nickname) equals Google's name, and
  signs in. It is refused when anyone else on the roster shares that name, and a row with a real address is never
  claimed. Accounts let in through `NICO_ALLOWED_EMAILS` never claim. A personal account now gets its own message
  ("not a company Google account") in place of "not on the roster". No schema change. Rollback: git revert the commit;
  claimed rows keep their real addresses, which is the wanted end state.
- **2026-10-28 · Opus 5.5 · Name claim hardened, and a deactivated member no longer locks a project.** A security
  review flagged the name claim: a Google name can be edited by its holder, so a company account not on the roster
  could rename itself and take a placeholder row. The claim now matches the full display name only, never a nickname,
  and never takes a row that holds the lead or admin role on any team (an admin sets those addresses). Separately, an
  admin deactivated a placeholder row that still sat on a project with open tasks, and from then on every save of that
  project failed, so no one could be added to it. `updateProject` now asks only people new to the project to be
  active. 3 new tests. No schema change. Rollback: git revert the commit.
- **2026-10-29 · Opus 5.5 · Voice Quick Add waits through pauses.** A teammate reported that the mic filled in the task
  while they were still talking, at the first pause to think. The browser's speech service ran with `continuous` off,
  which ends the take at the first short gap. It now runs continuous, and the app stops the take once nothing new is
  heard for 2.5 seconds (`QUIET_MS` in `components/QuickAdd.tsx`), or when the mic is tapped. Checked with a fake speech
  service: a 1.5 second gap kept listening, and the take ended 2.5 seconds after the last words. Not yet tried on a
  real Android or iPhone; Android Chrome is known to repeat words in continuous mode. Rollback: git revert the commit.
- **2026-10-29 · Opus 5.5 · Quick Add hears Indian names spelled other ways.** Most users are Indian, and speech to text
  spells their names many ways (Kabeer for Kabir, Sreya for Shreya, Mira for Meera), so the reader found no owner.
  `soundKey` in `lib/quickadd.ts` gives those spellings one sound (aspirate h dropped, ee and oo shortened, w as v,
  doubled letters once). `respell` rewrites a capitalised word that sounds like one roster name word to the roster's
  spelling, in `readSentence` before both the rules and the model, so typed and spoken text gain alike and the masker
  now hides the name it would have missed. A sound two roster spellings share is left alone. The capital is required
  because, checked against the system dictionary, lower-case words collide ("seeing" with Singh, "bath" with Bhatt);
  checked against the 983 words of the meeting and paste evals, nothing is rewritten. The mic now asks for 3 guesses
  per stretch (`maxAlternatives`) and keeps the first that holds a teammate's or project's name (`pickHeard`). Not yet
  tried on a real phone, and how often Chrome capitalises an Indian name it does not know is not measured. 5 new tests.
  No schema change. Rollback: git revert the commit.

## 2026-10-29 · Opus 5.5 · Every pilot name checked against the spellings speech gives

Each of the 20 pilot names went through `respell` and the rules reader, as the full name, the first name and 19 kinds of
respelling (aa/a, ee/i, sh/s, th/t, v/w, doubled letters and others). All 20 full and first names find their person. No two
people share a first name or a sound. The sound key now also meets ay and ai, ou and au, and a word-final h, which took the
pilot from 58 to 68 of 77 heard spellings. The misses left change the vowel itself (Neha heard as Niha), which a sound key
cannot meet without merging different names. An au-to-o rule was tried and dropped: it turned "Roll" into a roster name.
One new test.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · An admin edits a roster row: name, job title, email and access

The PM asked to edit people on the Roster. Each row's Mark inactive, Make lead, Make admin and feedback replies buttons
become one Edit window (name, job title, email, and Active, Lead, Admin, Can reply to feedback ticks); Copy invite stays on
the row. `patchPerson` now also takes `displayName` and `email`, admin only as before. A new email becomes the sign-in
address and the old one moves to `alt_emails`, so a typo or a slow switch never locks the person out; an email already on
the roster is refused, and an admin cannot change their own email, Active or Admin. The person's own nickname still shows
in place of the roster name. No schema change. 2 new tests.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · The Team page loses its "Added since" menu

The PM asked to remove the Team page's "Added any time" menu (last hour, last 2 hours, today, or an exact time). The
menu, its `?added=` reading in `app/team/page.tsx`, its help word and its README entry go. `addedSince` in
`lib/derive.ts` and its test stay, unused by any page, so the menu can come back in one change. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · Feedback: anyone replies, marks a note Done or Not now, and the +1s hear of it

The PM's call. Anyone on the team now replies to a note (the Roster's "Can reply to feedback" tick goes; the
`people.replies_feedback` column stays, unused). Anyone marks a note Done in one click, or Not now with a short reason
(2 to 280 characters) that shows on the note, and anyone reopens it. The note says who closed it and when, so a wrong
close is plain. Closed notes fold under Resolved and are never removed, and a closed note takes no new +1. Each reply,
Done, Not now and Reopen goes to the writer and everyone who gave +1, never the person who did it, as a "Feedback
updates" card on Home (`feedback_news`, RLS on, fenced by person and note) until they open Feedback or press Mark seen.
In-app only, nothing is emailed. "Not now" was picked over "Won't do", "Parked" and "Not planned".
Schema: `feedback` gains `status`, `closed_by`, `closed_at`, `closed_note`, and the new `feedback_news` table; the
hosted database needs `npm run db:upgrade` before the build that carries it is promoted.
Rollback: git revert the commit; the new columns and table can stay, unused.

## 2026-10-30 · Opus 5.5 · Feedback shows who gave +1

The PM asked to see who agrees with a note. Beside +1 the line now reads "+2 · You and Kabir": the count, then the
names, "You" first, the rest in the order they agreed. Up to three names show; past that, "and 2 others" opens the
full list. `listFeedback` and the vote route return `others` (the names, leaving out the reader). Everyone on the team
already reads who wrote each note, so names on +1 show to everyone too. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · A search result opens with a mouse click

Feedback from the team: in the top search, a result opened with the arrow keys and Enter but not with a click. The
mobile keyboard rule (`KeyboardDismiss`) blurs a focused text field on any press outside one, so pressing a result
blurred the search box, its blur closed the list, and the click landed on nothing. Safari and Firefox on a Mac also
blur the box themselves, since they never focus a link on click. The results list now carries `data-keep-focus`, which
the keyboard rule skips, and keeps the box focused on a mouse press anywhere in it. Checked with a real mouse click in
Chrome and Firefox on a local build (before: nothing; after: the result opens), and by the PM in Safari. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · Feedback switches between Open and Resolved at the top

The PM found the Resolved fold at the foot of the list hard to reach. A switch under "From the team" now shows Open
(newest first) or Resolved (most recently closed first), each with its count, in the same style as the Team page's
By person / By status. It opens on Open and keeps the choice in the address (`?show=resolved`). The count leaves the
heading, so it shows once. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · "Added since" on every project's tasks

A teammate asked to close each meeting by reviewing the to-dos its note-taker entered during it. The PM wanted it inside
projects, with a date, not a time. The first pill in a project's filter row, "Added since…", pops a small month calendar
open with a Today button on top; future days cannot be picked. Picking a day lists the project's tasks made from 12 am
India time that day, oldest first (the order the meeting agreed them), with a count line ("5 tasks added today") and ✕
to clear. It combines with the person pills and Clear filters; dropped tasks are left out. The day lives only in the
address (`?added=`), never in the remembered filters, so tomorrow does not open on yesterday's review. Partner plan
boards do not have it yet. This replaces the Team page's hour-based menu removed earlier today. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · A project's Done tile shows the completed tasks

On a project, the Done tile filtered the open-task list to finished tasks, which it never holds, and hid Completed tasks
while it was on, so pressing it showed an empty table. The PM's call: Done now shows the completed tasks in place of the
open list, open and sortable, straight under the tiles, and works with the person pills and Added since. Pressing it again
or Clear filters goes back. The other tiles are unchanged. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · New Task takes several tasks at once, and required fields carry a *

The PM's call. Under Note in the New Task form, "+ Add another task" adds a full task block (Task, Details, Owner, Due
Date, Project, Sub-Project, Note; no Quick Add), each starting empty with nothing carried over, headed "Task 2", "Task 3"
with a Remove button. The button counts ("Add 3 tasks") and adds them in order through the normal task route; a missing
owner stops all of them, and if the server refuses one, those before it stay added and leave the form. In both task
forms (New Task and a project's Add task) a required field's label ends in a * in the accent colour (Task, Owner, Due
Date), "Details (if any)" becomes "Details", and the Task box has no example text. An empty owner with no project now
reads "Choose a person", as it does on a project, in place of the first name on the list. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · Quick Add's hint in plainer words

The PM picked new words for the line under Quick Add: "Type or say it the way you'd tell someone. Add one task or a few,
or paste a WhatsApp chat." (without the last part where the form takes no chat). Replaces "Type it, or tap the mic and
say it the way you'd tell someone. One task or several. You can also paste a WhatsApp chat." No other change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · The task form's Note loses "(optional)"

With required fields marked *, an unmarked field is optional, so "Note (optional)" becomes "Note" (the PM's call).
Other forms keep "(optional)" until they move to the * rule. No other change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · The app is called NicoDesk, one word

The PM's call: the name is written NicoDesk everywhere it shows (tab title, sidebar, sign-in and connect pages, the
installed app's name, the offline page, the invite text, the Guide, the Feedback page line, a task's origin), in the
README and in the current docs (DESIGN-GUIDE, the guide and demo pages). This replaces the 12 Oct spelling "Nico Desk",
which was the repo owner's call. The repo, package, Vercel project and URL keep `nico-desk`. Older entries in this log
and the 13 Oct plan keep the old spelling as they were written. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · A finished task shows the day it was finished

The PM asked to see when a task was completed, not only Ahead, On time or Late. Beside the flag, outside the chip, the
day it was done or dropped now shows small and in a quiet colour: "AHEAD 12 Oct". It does not repeat "Done", since the
status beside it says so. A dropped task, which has no flag, shows the day alone. It shows wherever the flag does
(project lists and the Done tile, Home, Team, the task drawer). The day comes from `endedAt`, read in India time.
No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · A finished task's aside: the day for Ahead, how late for Late

Refines the entry above (the PM's call). Ahead keeps the day it was done ("AHEAD 12 Oct"). Late shows how many days after
the first date it was done ("LATE 3 days"). On time shows nothing more, since that day is the due date. A dropped task
still shows the day it was dropped. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · A project's Update log shows the last 15 days

The PM's call. The Update log on a project lists the last 15 days (India time), with the count in its heading ("3 in
the last 15 days"). Older entries open with "Show older (N)" and close with "Hide older". Nothing is deleted: the events
stay append-only and keep feeding task History, the Ledger, Updates for you and Undo. The page now reads the latest 500
entries in place of 60, so Show older reaches further back. No schema change.
Rollback: git revert the commit.

## 2026-10-30 · Opus 5.5 · The profile form follows the * rule

The PM's call. On Your profile, Name (required) ends in a *, "Nickname (optional)" and "Phone (optional)" become
"Nickname" and "Phone", and the line under the photo buttons ("It is cropped to a square and shrunk on your device.
Teammates can see it.") is removed. No other change.
Rollback: git revert the commit.
