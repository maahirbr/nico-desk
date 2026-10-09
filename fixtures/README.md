# Fixtures

All data here is synthetic. The names, projects, tasks and Sheet ids are invented. Nothing comes from a real company. Emails use `example.test`, a reserved name.

The files match `docs/DATA-MODEL.md`: `people.json`, `projects.json`, `tasks.json`, `events.json`.
`plan.json` holds the project-page details and one partner plan for the web app (`web/lib/seed.ts`); its free-text owner fields may name a person id (`per_bo`), which the seed swaps for that person's name.
`events.json` is the full history. Replaying it gives exactly the rows in `tasks.json` and `projects.json`.

## Six weeks and a seed-time shift

The weeks run Monday to Friday, from 2026-08-31 to 2026-10-09. The data is "as of" 2026-10-09 (`FIXTURE_ANCHOR` in `web/lib/shift.ts`).
At seed time the app moves every date and timestamp forward by whole weeks, so the anchor week becomes the current week and each date keeps its weekday.
The files on disk never change. A test run pins today to the anchor, so nothing shifts there.

- Weeks of 08-31 and 09-07: closed work only, on time, ahead and late. One due date moved and one task dropped.
- Weeks of 09-14 and 09-21: the original weeks. One task dropped, one due date moved later before close.
- Week of 09-28: some tasks late or open and overdue. One due date moved earlier.
- Week of 10-05: the demo week. The lead has one late task, one at risk and one due this week. Two tasks wait on the lead, one waits on a teammate, one is blocked with no person. One task is done early, one is dropped, one date was moved with a reason.

Mix: 50 origin app, 4 sheet, 3 granola. Ledger totals: 27 on time or ahead, 10 late, 4 open and overdue.

## Guard rule

A test must fail if any `.json` fixture contains `nicobar` (any case), a real email domain,
or any line from `fixtures/denylist.txt`. A real email domain is any email whose domain is not `example.test`.
The check ignores case and reads the denylist file, so a new line extends the guard.
The test skips this README and the denylist, which name those strings on purpose.
