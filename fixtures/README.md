# Fixtures

All data here is synthetic. The names, projects, tasks and Sheet ids are invented. Nothing comes from a real company. Emails use `example.test`, a reserved name.

The files match `docs/DATA-MODEL.md`: `people.json`, `projects.json`, `tasks.json`, `events.json`.
`plan.json` holds the project-page details and one partner plan for the web app (`web/lib/seed.ts`); its free-text owner fields may name a person id (`per_bo`), which the seed swaps for that person's name.
`events.json` is the full history. Replaying it gives exactly the rows in `tasks.json` and `projects.json`.

## The four weeks

The weeks run Monday to Friday and end on 2026-10-09. The data is "as of" 2026-10-09.

- Week of 09-14: 6 tasks counted, 5 on time, 1 late. One task dropped.
- Week of 09-21: 8 tasks counted, 5 on time, 3 late. One due date moved later before close.
- Week of 09-28: 8 tasks counted, 5 on time, 2 late, 1 open and overdue. One due date moved earlier.
- Week of 10-05: 6 tasks counted, 3 on time, 3 open and overdue. Some tasks are due 10-09 and not counted yet.

Mix: 27 origin app, 4 sheet, 2 granola. Ledger totals: 18 on time, 6 late, 4 open.

## Guard rule

A test must fail if any `.json` fixture contains `nicobar` (any case), a real email domain,
or any line from `fixtures/denylist.txt`. A real email domain is any email whose domain is not `example.test`.
The check ignores case and reads the denylist file, so a new line extends the guard.
The test skips this README and the denylist, which name those strings on purpose.
