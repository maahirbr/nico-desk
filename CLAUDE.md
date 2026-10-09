# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. Slice 1 of `SPEC.md` runs locally in `web/` on synthetic data; `HANDOFF.md` is the brief and the reading list.

## ARCHITECTURE

- `web/`: slice 1 of `SPEC.md`. Next.js 16 app, PGlite (Postgres in WASM) in `web/.data/`, seeded from `fixtures/`. `lib/service.ts` holds every rule; pages and `app/api/v1/` both call it. Local sign-in is a roster picker behind `NICO_DEV_SIGNIN=1`. `/projects` gives each project a page: a task board, or a plan board (`lib/plan.ts`, from the partner tracker artifact) with checkpoints, asks and minutes-to-proposals. Real names go only in the git-ignored `web/roster.local.json`, real projects only in the git-ignored `web/projects.local.json`. Reminders open drafts in the lead's own Gmail; the app never sends. Granola and Fireflies keys live only in git-ignored `web/.data/connections.json`. See `web/README.md` for what is not built and why.
- Hosting: `web/lib/db.ts` picks the database. `DATABASE_URL` set: postgres-js through `web/lib/pgRemote.ts` (Supabase transaction pooler), loaded by `npm run db:remote` (`web/scripts/db-remote.ts`: drops, reseeds, RLS on with no policies). Unset on Vercel: PGlite in tmpdir, seeded from `fixtures/` on each cold start, so edits do not last. Unset locally: PGlite in `web/.data/`. `NICO_OPEN_DEMO=1` skips sign-in: a visitor is the team lead and `/signin` switches person. On Vercel, secrets come from env or are derived (`web/lib/secret.ts`). `web/.env.example` lists every variable. Vercel project `nico-desk`, root `web`, serves https://nico-desk.vercel.app.
- Look: `DESIGN.md` (repo root) is the visual system and outranks everything visual. Every token lives in `web/app/tokens.css`; Geist comes from `next/font/google`. `web/components/motion.ts` holds the three motion gestures and `web/components/KeyboardDismiss.tsx` the mobile keyboard rule. `docs/design/moods.html` holds the three mood sketches, and each is a skin: `[data-skin]` token blocks in `tokens.css`, picked from the menu by the avatar and kept in the `nd_skin` cookie, which `layout.tsx` reads so the server HTML carries it. `web/components/keys.ts` holds the shortcuts (`/`, Cmd+K, `n`, `?`, Esc); `toast.tsx` and `skeletons.tsx` the confirmations and loading states.
- `web/` v2: the ask is a task row with `ask_state` (asked, accepted, countered, cant, declined) and stays off the desk until agreed (`ON_DESK` in `lib/service.ts`). `lib/commit.ts` turns "ask <person> to <thing> by <date>" and "I'll <thing> by <date>" in the top search into a draft, with no model. `/team?asof=<Monday>` rebuilds the desk at the end of any of the last 8 weeks from the events log (`asOfTasks`, read only). `weeklyLoad` gives open work per person for this week and next. Demo asks come from `lib/seedAsks.ts`, apart from `fixtures/`. UI in `components/Asks.tsx` and `components/TeamV2.tsx`.
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
- 2026-10-09 · Sonnet 5.5 · v2 built in four steps: the ask as the central object, the commit field in the top
  search, an as-of scrubber on `/team`, and per-person load. An ask is a task row with four additive columns
  (`ask_state`, `ask_due_on`, `ask_counter_on`, `ask_reason`). Agreement sets `first_due_on` once, so the on-time
  ledger judges against the agreed date. The as-of view rewinds the current row by undoing events after the week's
  end (IST midnight), so no snapshots are stored. The commit field is a plain parser, not a model, so it never
  guesses. A hosted database needs `npm run db:remote` run again, because it does not run `upgrade()`.
  Rollback: revert the v2 commits on the branch. The added columns are harmless if left in place.

## VERIFY

```
python3 -I evals/meetings/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/
cd web && rm -rf .next && npm run typecheck && npm test && npm run build
```

Expected: `OK: 20 cases`; no grep output (the company name is allowed; real people, emails and
internal hosts are not); typecheck silent; `56 passed`; build green. Then run the app
(`npm run dev --prefix web`, port 3100) and check `/team`, `/me` and a project page at desktop and
375px, day and night. After a deploy, open https://nico-desk.vercel.app/team. Done still means
`docs/BRIEF.md` answers the open questions in `HANDOFF.md` section 5, checked with the sponsor.
