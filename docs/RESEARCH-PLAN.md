# Research plan and first slice, 8 Oct 2026

Written by a model (Fable 5.1) for the repo owner. Order, owner, method and done-when for each open question. Then the recommended first build slice. Nothing here is decided.

## Order

Items 1 and 5 are decisions. Items 6 and 8 need no access and can start now.

| # | Question | Owner | Method | Done when |
|---|---|---|---|---|
| 1 | Pilot team, first user, and scope (project tool or task tool) | the strategy lead and the repo owner, with the teammate who raised the scope question | One 30-minute meeting. Compare the three intent files. Pick one. | Team named. Pilot lead named. One scope sentence in the kept intent file. A DECISIONS line in `CLAUDE.md`. |
| 2 | Granola access | a Granola admin | Confirm the plan is Business or Enterprise. The admin makes a workspace key. Confirm the pilot's meetings sit in the Team space or a space with API access on. Fetch one transcript as a test. Store nothing in the repo. | A key exists, with a named holder and a revocation rule. One transcript fetched. |
| 3 | Notetaker adapters | the repo owner asks the pilot team | Ask which notetakers the pilot team uses. Get one sample export per tool. Granola is first (item 2). | A list of the notetakers in use, with one sample export per tool. |
| 4 | Google Chat access | the founder | Ask for a yes or no on read access to Google Chat, and on consent from the people in it. Read only, proposals only. | A yes or no on read access and consent. |
| 5 | Where the data lives | the two people scoping the OKR backend, with the repo owner | Decide shared or separate Postgres, the account owner and the region. | An account exists. Owner named. A DECISIONS line. |
| 6 | Week 0 baseline | the pilot lead | Count overdue tasks and on-time closures in the pilot team's Sheet for the last four weeks. By hand or a read-only script. | Two numbers in the kept intent file, section 7. |
| 7 | Sheets read adapter | the tracker owner grants; the repo owner builds | List the Sheets. Read by header name, not column position. Test that a moved column still reads. | Read access granted. A fixture test passes. |
| 8 | Draft quality | the repo owner | 20 or more synthetic meetings with gold tasks. Score owner, date, critical recall, quote validity and injection cases. Add a classifier arm as a second check. See `docs/AI-AND-TECH.md` section 2. | Critical recall 100%. Invented dates 0%. Quote validity 100%. Owner precision 0.9 or better. All on synthetic data. |
| 9 | Model vendor approval for real minutes | whoever approves vendors at the company | Send the classifier vendor the five written questions in `docs/RESEARCH-8-OCT.md`. Check the extraction model vendor's enterprise terms the same way. | A written yes for a named vendor. Until then, synthetic minutes only. |
| 10 | Plane licence | nobody yet | Only if Plane is ever run. A lawyer reads the AGPL first. | Parked. |

## The first build slice

**Build "the week" on native tasks for the pilot team, with the on-time ledger.**

What it holds:

- A task with owner, due date, status and origin. Created in the app.
- An append-only events table. Every change is a row: entity, field, before, after, actor, origin, time. The current state is derived from it.
- The week view: open tasks by person, overdue first. Colour plus a word.
- The on-time ledger, derived from the events: per person per week, on time, late or open.
- One Sheet read, read-only, by header name. Rows from the Sheet are read-only in the app and carry the Sheet as their origin.
- Synthetic fixtures and a test that fails on any real domain or name.

What it leaves out: Granola drafting, the triage inbox, nudges, sign-in beyond one user. Those are slice two.

Why this first:

- It needs only decisions 1 and 3. Granola drafting needs three more gates: the key, the vendor approval and the eval.
- It answers the teammate's three questions in code: an independent app, native tasks plus Sheet reads, one system of record per task.
- It produces the on-time number nobody has today, so success can be measured from week one.
- The events table is the base that the change feed, the ledger and the triage inbox all stand on. Nothing is thrown away in slice two.

What blocks it:

1. The pilot team and the scope sentence (item 1).
2. The data account (item 5).
3. Read access to one Sheet (item 7). Without it, the slice still works on native tasks only.

Can start now, with no decision: the synthetic fixtures, the events table schema, the eval set (item 8), the status model as words plus derived outcome, on the fixtures.

## On the project tool question

The research found four objects that make a tool "project management" rather than "task management": a milestone, a dated status update with health, a roll-up above projects, and a timeline. The cheapest to add is a milestone with a date that flags itself when overdue. Recommend: tasks first, a project record and a change feed in slice one, and milestones only if the pilot lead asks for them by week three.

The founder and the sponsor's doc (`docs/HOW-TEAMS-WORK.md`) both point to task-first. If the pilot team is a Run type, the first project-layer switch to build after the pilot is the Launch type's dependencies and countdown.
