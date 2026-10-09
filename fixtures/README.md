# Fixtures

All data here is synthetic. The people, tasks and Sheet ids are invented. The company name and its public context are used on purpose: two teams called E-commerce and Design, and projects about a festive website, a festive edit shoot, a loyalty tiers pilot and home linen samples, with stores in Mumbai, Delhi and Bengaluru. No real people, dates, numbers or sheet data are here. Emails use `example.test`, a reserved name.

The files match the DDL in `SPEC.local.md` section 3.3, one JSON array per table: `people.json`, `teams.json`, `team_members.json`, `projects.json`, `tasks.json`, `events.json`, `notes.json`. Keys are exactly the DDL column names. Dates are ISO `YYYY-MM-DD`. Timestamps are ISO with `Z`. Generated and derived columns are left out: `search_tsv` and `version`. `python3 -I fixtures/check.py` checks all of this and prints `OK: fixtures`.

The pilot team is `team_run` (E-commerce, kind `run`): the six roster people, one lead (`per_ada`), one admin (`per_cy`), four members. `team_pipe` (Design, kind `pipeline`) has one extra person (`per_gus`), one project and two open tasks that are not due yet. They exist to test team scoping and add nothing to the ledger.

## Events

`events.json` is the full append-only history, in time order. Replaying it in file order gives exactly `tasks.json` and `projects.json`. Event kind is the `field` column. `before` and `after` are jsonb values.

| `field` | `before` | `after` | `reason` | Replay |
|---|---|---|---|---|
| `_created` | null | The row as an object: every column of the table except `id` (the `id` is `entity_id`) | none | Start the row |
| any task column | The old value | The new value | `due_on` always; `status_category` when `after` is `"dropped"` | Set the column |
| `_reopened` | `"done"` | `"open"` | always | No change; the `status`, `status_category`, `closed_at` and `closed_on` events that follow reopen the row |
| `_update` | null | The update text (string) | none | No change (log line only) |

Task fields used: `title`, `note`, `health`, `due_on`, `status`, `status_category`, `closed_at`, `closed_on`, `priority`, `blocked_on_id`, `blocked_ask`, `ask_state`. Project fields used: `status`, `status_note`.

Replay side effects, the only ones:

- `priority` also sets `priority_set_by` to the event's `actor_id` and `priority_set_at` to its `at`.
- `blocked_on_id` also sets `blocked_at` to the event's `at`, or to null when `after` is null (a clear).
- A project `status` or `status_note` event sets `status_at` to its `at`.

The three ask columns (`asked_by_id`, `for_task_id`, `ask_state`) are plain columns. They replay like any other column and have no side effects. They are null on every task that is not an ask.

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

Mix: 39 tasks in all. Origin: 27 app, 4 sheet, 8 notes. Pilot team: 37 tasks. `team_pipe`: 2 tasks.

## The asks

Four tasks were added for the week as of Fri 2026-10-09. None of them is in the ledger table above: all four are open and due after 2026-10-09, so the table did not change.

- `tsk_036` (owner `per_ada`, due 10-16, on track) is the line "Build the festive landing page". It is a plain task.
- `tsk_037` is an ask between members. `per_ada` asked `per_fay` for the final tier names, to unblock `tsk_036`, by 10-14. `ask_state` is `asked`: no answer yet.
- `tsk_038` is an ask between members with a "later, because" answer. `per_bo` asked `per_dee` for cropped hero images by 10-08, to unblock `tsk_030`. On 10-07 `per_dee` said yes but later, with the reason "Waiting on the final edit from the shoot". `ask_state` is `accepted`, `due_on` is 10-12, `first_due_on` stays 10-08, and `health` is `off_track`.
- `tsk_039` is an ask from the brand lead (`per_cy`) to the store lead (`per_eli`) for the staff list for the Bengaluru window install, due 10-13. `per_eli` said yes on 10-08. `ask_state` is `accepted`.

`tsk_037` to `tsk_039` are the only rows with `asked_by_id`, `ask_state` and (for the first two) `for_task_id` set. `tsk_036` is the line `tsk_037` unblocks; `tsk_030` is the line `tsk_038` unblocks.

## Notes

`notes.json` holds four synthetic meeting notes (`synthetic` true): three drafted (`ntn_001` to `ntn_003`, two from `granola`, one `paste`) and one waiting. Each drafted note names two or three commitments. The matching tasks have `origin` `notes` and an `origin_ref` of the form `<external_id or note id>#item-n`.

`ntn_004`, "Monday sync, 5 Oct", is from `granola` and has status `received` with `drafted_at` null. It has no tasks yet. Its body is a transcript with four clear "I will" commitments from four speakers, so the fixture drafter yields exactly four draft lines. Drafting it is how the drafting table is shown from a clean start.

## Guard rule

A test must fail if any `.json` fixture contains a real email domain, or any line from
`fixtures/denylist.txt`. A real email domain is any email whose domain is not `example.test`. The company name on its own is allowed, because the fixtures use the public company context. The denylist still holds `@nicobar`, so a company email address fails.
The check ignores case and reads the denylist file, so a new line extends the guard.
The test skips this README and the denylist, which name those strings on purpose.
