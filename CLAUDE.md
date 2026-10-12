# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. Slice 1 of `SPEC.md` runs locally in `web/` on synthetic data; `HANDOFF.md` is the brief and the reading list.

**Working on `maahir/mvp` before or after the 12 Oct demo? Read `docs/HANDOFF-12-OCT.md` first:** what changed,
the baseline, the feedback and its state, the UI direction, and the work in flight.

## ARCHITECTURE

- `web/`: slice 1 of `SPEC.md`. Next.js 16 app, PGlite (Postgres in WASM) in `web/.data/`, seeded from `fixtures/`. `lib/service.ts` holds every rule; pages and `app/api/v1/` both call it. Sign-in is Google OAuth, direct to Google with no Supabase Auth (`web/lib/google.ts`, `web/app/api/auth/google/`), on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; the roster picker stays behind `NICO_DEV_SIGNIN=1`. Both end in the same signed `nd_session` cookie and the same `checkSignIn` roster and domain check. `/projects` gives each project a page: a task board, or a plan board (`lib/plan.ts`, from the partner tracker artifact) with checkpoints, asks and minutes-to-proposals. Real names go only in the git-ignored `web/roster.local.json`, real projects only in the git-ignored `web/projects.local.json`. Reminders open drafts in the lead's own Gmail; the app never sends. Granola and Fireflies keys live only in git-ignored `web/.data/connections.json`. See `web/README.md` for what is not built and why.
- Hosting: `web/lib/db.ts` picks the database. `DATABASE_URL` set: postgres-js through `web/lib/pgRemote.ts` (Supabase transaction pooler), loaded by `npm run db:remote` (`web/scripts/db-remote.ts`: drops, reseeds, RLS on with no policies). Unset on Vercel: PGlite in tmpdir, seeded from `fixtures/` on each cold start, so edits do not last. Unset locally: PGlite in `web/.data/`. `NICO_OPEN_DEMO=1` skips sign-in: a visitor is the team lead and `/signin` switches person. On Vercel, secrets come from env or are derived (`web/lib/secret.ts`). `web/.env.example` lists every variable. Vercel project `nico-desk`, root `web`, serves https://nico-desk.vercel.app from Supabase project `nico-desk` (Mumbai): `DATABASE_URL` is set for production only, so previews still use PGlite. The live site holds the real pilot, loaded by `NICO_ROSTER=pilot/roster.local.json npm run db:remote` from the git-ignored `web/pilot/` (`drop_samples` in its `projects.local.json` leaves the fixtures out). The weekly reseed cron is off; a daily cron at 09:00 IST calls `/api/v1/jobs/reminders` (in-app due and overdue notices only, needs `CRON_SECRET`); `/api/cron/reseed` (`web/lib/reseed.ts`) still exists and never wipes a database without the fixture marker task. Vercel project `nico-desk-v2` serves branch `maahir/mvp-v2` at https://nico-desk-v2.vercel.app on PGlite, since its ask columns are not in the Supabase schema.
- Look: `DESIGN.md` (repo root) is the visual system and outranks everything visual. Every token lives in `web/app/tokens.css`; Geist comes from `next/font/google`. `web/components/motion.ts` holds the three motion gestures and `web/components/KeyboardDismiss.tsx` the mobile keyboard rule. `docs/design/moods.html` holds the three mood sketches, and each is a skin: `[data-skin]` token blocks in `tokens.css`, picked from the menu by the avatar and kept in the `nd_skin` cookie, which `layout.tsx` reads so the server HTML carries it. `web/components/keys.ts` holds the shortcuts (`/`, Cmd+K, `n`, `?`, Esc); `toast.tsx` and `skeletons.tsx` the confirmations and loading states.
- `HANDOFF.md`: the brief, push-backs, context map, sources, open questions, first-session steps.
- `INTENT.md`: hand-written intent, no model edits. `docs/INTENT-FABLE.md` is the model-written counterpart.
- `SPEC.md`: requirements, schema, API and acceptance tests for the pilot, built from `INTENT.md`. Draft. Changes `docs/DATA-MODEL.md` in four places (section 3.1), including on-time judged against the date first given.
- `docs/`: `BRIEF.md`, `RESEARCH-PLAN.md`, `HANDOFF-FABLE.md`, `HOW-TEAMS-WORK.md` (the sponsor's four team types), `USE-CASES-8-OCT.md` (requests mapped to intent, slice one or spec), `DATA-MODEL.md` (Postgres DDL: people, projects, tasks, append-only events; on-time ledger derived, never stored).
- `docs/team-page/`: the team question page, published as a private Artifact; `img/` holds vendor screenshots.
- `fixtures/`: synthetic people, projects, tasks and events. `events.json` replays to `tasks.json` exactly. `denylist.txt` guards against real data.
- `evals/meetings/`: 20 synthetic transcripts with expected drafts, and `check.py`.

## CONSTRAINTS

- nico-desk has its own visual language, designed from the product's needs (decision 2026-10-09).
  The OKR page's sheet language in `~/Code/Nicobar work` is not a reference for it. The rule that
  any Nicobar surface uses that sheet language still holds for the OKR page itself.
- Do not rebuild the tracker owner's tracker (`nicobar-okr-processor`). Read what it produces.
- Never write to the founder's Supabase or any department Google Sheet without access granted for
  that purpose.
- No real Nicobar data in git, fixtures or artifacts; synthetic fixtures only. The company name and
  its public context (team names, kinds of project, product and place words from the public site)
  are allowed in fixtures (decision 2026-10-09). Real people, real dates, real numbers and anything
  from a department sheet or Supabase are not. Any other exception is the repo owner's call,
  recorded in DECISIONS.
- No people's names in repo files. Use roles: the repo owner, the sponsor, the pilot lead, the
  founder, the tracker owner, the context layer lead, the OKR backend developer.
- No customer PII. Nothing from `~/Code/personalised-NL/`, the Full Moon files or order exports.
- Nothing is sent on anyone's behalf (tags, nudges, emails) without their yes.
- Recording meetings needs consent from everyone recorded, and a stated storage and retention rule,
  before any recorder is built.
- The repo is public (decision 2026-10-08, see DECISIONS). So nothing internal beyond what is
  already in it goes in: no real Nicobar data, no credentials, no customer data, no internal URLs
  that are not already public.

## DECISIONS

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

## VERIFY

```
python3 -I evals/meetings/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/
cd web && rm -rf .next && npm run typecheck && npm test && npm run build
```

Expected: `OK: 20 cases`; no grep output (the company name is allowed; real people, emails and
internal hosts are not); typecheck silent; `134 passed`; build green. Then run the app
(`npm run dev --prefix web`, port 3100) and check `/team`, `/me` and a project page at desktop and
375px, day and night. After a deploy, open https://nico-desk.vercel.app/team. Done still means
`docs/BRIEF.md` answers the open questions in `HANDOFF.md` section 5, checked with the sponsor.
