# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. Nothing is built yet; `HANDOFF.md` is the brief and the reading list.

## ARCHITECTURE

No code yet. Filled in at the first code commit.

- `HANDOFF.md`: the brief, push-backs, context map, sources, open questions, first-session steps.
- `docs/`: `BRIEF.md` (answers to the open questions) and the data map land here.

## CONSTRAINTS

- Any Nicobar surface uses the UI already designed in `~/Code/Nicobar work` (`docs/SHEET-SPEC.md`,
  the `web/` tokens and components). No new visual language.
- Do not rebuild Aashi's tracker (`nicobar-okr-processor`). Read what it produces.
- Never write to Raul's Supabase or any department Google Sheet without access granted for that
  purpose.
- No real Nicobar data in git, fixtures or artifacts; synthetic fixtures only. Any exception is
  Maahir's call, recorded in DECISIONS.
- No customer PII. Nothing from `~/Code/personalised-NL/`, the Full Moon files or order exports.
- Nothing is sent on anyone's behalf (tags, nudges, emails) without their yes.
- Recording meetings needs consent from everyone recorded, and a stated storage and retention rule,
  before any recorder is built.
- The repo stays private.

## DECISIONS

- 2026-09-30 · Opus 5.5 · Repo created as `nico-desk`, separate from `~/Code/Nicobar work` (the OKR
  page) and `~/Code/nicobar-recs`: the hub spans teams and sources, and the OKR page may become
  one part of it (open question 6 in `HANDOFF.md`) rather than the other way round. Meeting
  minutes default to reading Granola, which already feeds the tracker, not building a recorder.

## VERIFY

Nothing to run yet. Until code exists, done means: `docs/BRIEF.md` answers the open questions in
`HANDOFF.md` section 5, checked with Khushi.
