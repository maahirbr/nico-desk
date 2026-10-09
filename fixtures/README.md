# Fixtures

All data here is synthetic. The names, projects, tasks and Sheet ids are invented. Nothing comes from a real company. Emails use `example.test`, a reserved name.

The files match the DDL in `SPEC.local.md` section 3.3, one JSON array per table: `people.json`, `teams.json`, `team_members.json`, `projects.json`, `tasks.json`, `events.json`, `notes.json`. Keys are exactly the DDL column names. Dates are ISO `YYYY-MM-DD`. Timestamps are ISO with `Z`. Generated and derived columns are left out: `search_tsv` and `version`. `python3 -I fixtures/check.py` checks all of this and prints `OK: fixtures`.

The pilot team is `team_run` (kind `run`): the six roster people, one lead (`per_ada`), one admin (`per_cy`), four members. `team_pipe` (kind `pipeline`) has one extra person (`per_gus`), one project and two open tasks that are not due yet. They exist to test team scoping and add nothing to the ledger.

## Events

`events.json` is the full append-only history, in time order. Replaying it in file order gives exactly `tasks.json` and `projects.json`. Event kind is the `field` column. `before` and `after` are jsonb values.

| `field` | `before` | `after` | `reason` | Replay |
|---|---|---|---|---|
| `_created` | null | The row as an object: every column of the table except `id` (the `id` is `entity_id`) | none | Start the row |
| any task column | The old value | The new value | `due_on` always; `status_category` when `after` is `"dropped"` | Set the column |
| `_reopened` | `"done"` | `"open"` | always | No change; the `status`, `status_category`, `closed_at` and `closed_on` events that follow reopen the row |
| `_update` | null | The update text (string) | none | No change (log line only) |

Task fields used: `title`, `note`, `health`, `due_on`, `status`, `status_category`, `closed_at`, `closed_on`, `priority`, `blocked_on_id`, `blocked_ask`. Project fields used: `status`, `status_note`.

Replay side effects, the only ones:

- `priority` also sets `priority_set_by` to the event's `actor_id` and `priority_set_at` to its `at`.
- `blocked_on_id` also sets `blocked_at` to the event's `at`, or to null when `after` is null (a clear).
- A project `status` or `status_note` event sets `status_at` to its `at`.

A close writes `status`, `status_category`, `closed_at`, `closed_on` at one time. `closed_on` is the Asia/Kolkata day of `closed_at`. A drop writes `status` and `status_category`, with the reason on `status_category`. A red rule change writes `health` then `due_on` with a reason. Sheet task events have `actor_id` null and `origin` `sheet`. A notes task's `_created` event has `origin` `notes`; its later events have `origin` `app`. For app and notes tasks `status` equals `status_category`. Sheet tasks keep the Sheet's own words (`To do`, `In progress`, `Done`).

## The four weeks

The weeks run Monday to Friday and end on 2026-10-09. The data is "as of" 2026-10-09. A task is judged against `first_due_on` and sits in the week of the Monday of that date. Counted means not dropped and either closed, or open with a current `due_on` before 2026-10-09. Dropped tasks and tasks not yet due are left out. Open-overdue uses the current `due_on`.

| Week | Counted | Ahead | On time | Late | Open overdue |
|---|---|---|---|---|---|
| 2026-09-14 | 6 | 0 | 5 | 1 | 0 |
| 2026-09-21 | 8 | 1 | 3 | 4 | 0 |
| 2026-09-28 | 8 | 0 | 6 | 1 | 1 |
| 2026-10-05 | 6 | 1 | 2 | 0 | 3 |
| Total | 28 | 2 | 16 | 6 | 4 |

Ahead plus on time is 18, late is 6, open overdue is 4: the same totals as before the schema change.

- Week of 09-14: `tsk_007` dropped, so it is not counted. `tsk_003` closed late, was reopened on 09-21 (reason given) and closed late again.
- Week of 09-21: `tsk_008` moved from 09-23 to 09-26 on 09-22 with a reason, then closed 09-25. Against the first date it is late, though it met its revised date. `tsk_015` closed a day early.
- Week of 09-28: `tsk_017` moved earlier from 10-02 to 10-01 on 09-30 with a reason, then closed 10-02. Against the first date it is on time. `tsk_020` moved on 10-05, after its first date of 10-02 had passed: a late renegotiation, a silent slip under the strict rule. `tsk_021` (a Sheet mirror) is open and overdue.
- Week of 10-05: `tsk_025`, `tsk_026` and `tsk_033` are open and overdue. `tsk_025` and `tsk_033` are blocked on a person; `tsk_026` was blocked and cleared. `tsk_027` to `tsk_030` are due 10-09 and not counted yet. `tsk_030` is `off_track` with a new date (10-14) and a reason.

Mix: 35 tasks in all. Origin: 23 app, 4 sheet, 8 notes. Pilot team: 33 tasks. `team_pipe`: 2 tasks.

## Notes

`notes.json` holds three synthetic meeting notes (`synthetic` true, status `drafted`): two from `granola`, one `paste`. Each names two or three commitments. The matching tasks have `origin` `notes` and an `origin_ref` of the form `<external_id or note id>#item-n`.

## Guard rule

A test must fail if any `.json` fixture contains `nicobar` (any case), a real email domain,
or any line from `fixtures/denylist.txt`. A real email domain is any email whose domain is not `example.test`.
The check ignores case and reads the denylist file, so a new line extends the guard.
The test skips this README and the denylist, which name those strings on purpose.
