# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. Nothing is built yet; `HANDOFF.md` is the brief and the reading list.

## ARCHITECTURE

`web/` is the v1 localhost app: Next.js 16 App Router, Drizzle over PGlite (file-backed at
`web/.data/pglite`, local only). Execution travels: a page in `web/app/*` calls a query in
`web/lib/db/queries*.ts`, renders with `web/components/*`, and posts a server action in
`web/lib/actions/*` that calls one mutation in `web/lib/db/mutations.ts`. Every mutation appends
to `events`; `first_due_on` is locked by trigger; outcomes are derived in the `task_outcome` view,
never stored. `web/lib/model/` turns a note into drafts (fixture drafter by default, Anthropic
drafter with a key, a stub checker in Jev's place) behind the vendor gate in `gate.ts`.
`web/lib/sends/` holds the draft → approved → sent state machine and writes to a local outbox.
`web/lib/jobs/` are the Monday, Friday and at-risk jobs, run from `/dev/jobs`. Login is a dev
"act as" cookie at `/dev/act-as`; `/dev/*` is 404 in production.

- Screens: `/me` (the week sheet), `/team` (the desk, with as-of scrubber), `/team/monday`,
  `/team/ledger` (printable), `/team/week`, `/team/by-status`, `/team/load`, `/notes/:id` (the
  drafting table), `/find` (find, ask or commit from one field), `/tasks/:id`, `/drafts`,
  `/sends`. `docs/DESIGN-HANDOUT.md` is the design brief these screens were built from.
- `DESIGN.md` (repo root) is the visual system for the v2 redesign and outranks everything
  visual, the handout included. `docs/design/moods.html` holds the three mood sketches.
- Local-only, never committed: `SPEC.local.md` (merged spec), `web/UI-REFERENCE.local.md` (sheet
  tokens and rules, cited to the OKR page repo), `web/public/fonts/` (licensed Euclid Flex),
  `web/.data/`, `.claude/launch.json`. All are in `.git/info/exclude`.

- `HANDOFF.md`: the brief, push-backs, context map, sources, open questions, first-session steps.
- `INTENT.md`: hand-written intent, no model edits. `docs/INTENT-FABLE.md` is the model-written counterpart.
- `SPEC.md`: requirements, schema, API and acceptance tests for the pilot, built from `INTENT.md`. Draft. Changes `docs/DATA-MODEL.md` in four places (section 3.1), including on-time judged against the date first given.
- `docs/`: `BRIEF.md`, `RESEARCH-PLAN.md`, `HANDOFF-FABLE.md`, `HOW-TEAMS-WORK.md` (the sponsor's four team types), `USE-CASES-8-OCT.md` (requests mapped to intent, slice one or spec), `DATA-MODEL.md` (Postgres DDL: people, projects, tasks, append-only events; on-time ledger derived, never stored).
- `docs/team-page/`: the team question page, published as a private Artifact; `img/` holds vendor screenshots.
- `fixtures/`: synthetic people, teams, team members, projects, tasks, notes and events. `events.json` replays to `tasks.json` exactly; `check.py` verifies it. `denylist.txt` guards against real data.
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

- 2026-10-09 · Fable 5.1 · v1 localhost app committed under `web/`, built to `docs/DESIGN-HANDOUT.md`
  (ten design ideas inside the sheet language, three moods, seven screens). The merged spec and the
  UI reference stay local-only files, since they cite the OKR page repo line by line and the font
  files are licensed. Login is a dev "act as" cookie until Google login is agreed. Hosted model
  calls stay behind the vendor gate (`GATE_VENDOR_APPROVED`, `GATE_TYPESAFE_ANSWERS`) until the
  vendor is approved; the fixture drafter runs by default. Rollback: `git revert` this commit.
- 2026-10-09 · Fable 5.1 · The sheet-language constraint is lifted for nico-desk at the repo owner's
  call, after they reviewed the v1 and rejected its direction (dull, hard to understand, the
  colleague dependency invisible). The redesign is briefed in `docs/DESIGN-HANDOUT.md` v2: three
  roles, five functions, the ask as the central object, three mood sketches before any build.
  The company name and public context are allowed in fixtures so the demo reads as Nicobar; the
  name is removed from `fixtures/denylist.txt`. The repo owner also said to bypass anything blocked
  on them: commits and `CLAUDE.md` edits proceed without a wait; push, deploy and sends still ask.
  Rollback: restore the two CONSTRAINTS lines and the denylist line from this commit's parent.
- 2026-10-09 · Opus 5.5 · The ask becomes a task with an asker: migration `0002_ask.sql` adds
  `asked_by_id`, `for_task_id` and `ask_state`, and the first-date lock now lets the owner set the
  first date once, when they answer "Yes, by then". Fixtures were rewritten with Nicobar public
  context (two teams, four projects, 39 tasks); the on-time record is unchanged at 28/2/16/6/4.
  Smoke grows from 20 to 29 items. The meeting evals keep their own fictional brand. Rollback:
  `git revert` this commit, then delete `web/.data/pglite` and reseed.
- 2026-10-09 · Opus 5.5 · Mood A (plain and familiar: Geist, white, one blue, pills) picked for
  the redesign, since the repo owner had not replied to the mood page and asked me to pick. It
  reads as an ordinary work tool on first use, which is the bar. Mood B stays a candidate for
  the lead and founder pages if A reads too soft there. `DESIGN.md` now outranks the handout on
  anything visual. Rollback: `git revert` this commit and pick again from `docs/design/moods.html`.

## VERIFY

```
python3 -I evals/meetings/check.py
python3 -I fixtures/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/ web/app web/components web/lib web/scripts
cd web && npx tsc --noEmit && npm run lint && npm run build && npm run smoke
```

Expected: `OK: 20 cases`, `OK: fixtures`, no grep output (the company name is allowed; real people,
emails and internal hosts are not), tsc and lint silent, build green, `smoke: all 29 items ok`. Then open
http://localhost:3000 (`npm run dev --prefix web`), act as a lead, and check `/me`, `/team` and
`/notes/:id` at desktop and 375px, day and night, static mode on. Done still means `docs/BRIEF.md`
answers the open questions in `HANDOFF.md` section 5, checked with the sponsor.
