# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. Nothing is built yet; `HANDOFF.md` is the brief and the reading list.

## ARCHITECTURE

No code yet. Filled in at the first code commit.

- `HANDOFF.md`: the brief, push-backs, context map, sources, open questions, first-session steps.
- `INTENT.md`: hand-written intent, no model edits. `docs/INTENT-FABLE.md` is the model-written counterpart.
- `SPEC.md`: requirements, schema, API and acceptance tests for the pilot, built from `INTENT.md`. Draft. Changes `docs/DATA-MODEL.md` in four places (section 3.1), including on-time judged against the date first given.
- `docs/`: `BRIEF.md`, `RESEARCH-PLAN.md`, `HANDOFF-FABLE.md`, `HOW-TEAMS-WORK.md` (the sponsor's four team types), `USE-CASES-8-OCT.md` (requests mapped to intent, slice one or spec), `DATA-MODEL.md` (Postgres DDL: people, projects, tasks, append-only events; on-time ledger derived, never stored).
- `docs/team-page/`: the team question page, published as a private Artifact; `img/` holds vendor screenshots.
- `fixtures/`: synthetic people, projects, tasks and events. `events.json` replays to `tasks.json` exactly. `denylist.txt` guards against real data.
- `evals/meetings/`: 20 synthetic transcripts with expected drafts, and `check.py`.

## CONSTRAINTS

- Any Nicobar surface uses the UI already designed in `~/Code/Nicobar work` (`docs/SHEET-SPEC.md`,
  the `web/` tokens and components). No new visual language.
- Do not rebuild the tracker owner's tracker (`nicobar-okr-processor`). Read what it produces.
- Never write to the founder's Supabase or any department Google Sheet without access granted for
  that purpose.
- No real Nicobar data in git, fixtures or artifacts; synthetic fixtures only. Any exception is
  the repo owner's call, recorded in DECISIONS.
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

## VERIFY

```
python3 -I evals/meetings/check.py
```

expects `OK: 20 cases`. Then: `grep -rilf fixtures/denylist.txt fixtures/*.json evals/` expects no output (the company name is allowed in docs, not in fixtures). Until code exists, done still means `docs/BRIEF.md` answers the open questions in `HANDOFF.md` section 5, checked with the sponsor.
