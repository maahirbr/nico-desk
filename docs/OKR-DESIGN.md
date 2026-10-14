# OKRs in nico-desk: design

Written by a model (Opus 5.5) on 14 Oct 2026 for the repo owner. **A proposal, not a decision.** Whether and when to build this is still open. Nothing here changes `SPEC.md` or the schema until that is decided and recorded in `CLAUDE.md` DECISIONS.

## 1. The idea in one line

Put OKRs above projects. A key result's target is treated like a task's due date: set once, locked, and changed only in the open with a reason. Progress is derived from check-ins and never stored. The overarching goal in `INTENT.md` ("every commitment gets done or openly renegotiated, without chasing") then covers goals as well as tasks.

## 2. Before building: the overlap

OKRs already live in two places:

- **The department OKR Sheets** (the tracker owner's format). These are the source today.
- **The OKR page** (`~/Code/Nicobar work`). It models forums, metrics, initiatives and actions, read from a file (`docs/OKR-PAGE-SUMMARY.md`).

If nico-desk authors OKRs, it becomes a third place unless these are settled first:

- Open question 6 in `HANDOFF.md`: does the OKR page become part of the hub?
- Open question 8 in `INTENT.md`: one backend shared with the OKR page, or separate?

This design avoids a fork in two ways. First, it imports each team's Sheet OKRs as read-only mirrors. Second, a team switches to authoring in nico-desk only for a whole cycle at a time (section 8). Sign-off from the tracker owner and the OKR backend developer is a precondition to build.

**Lighter option, if the answer is "not yet":** build only the mirror (section 8, step 1) and the project-to-KR link. That gives the "unlinked work" view without nico-desk owning any OKR.

## 3. Shape

```
cycle ─┬─ objective ── key result ⇄ project ── task
       │      └─ parent objective (one level: company → team)
       └─ key result ── task          (run teams with no project)
```

- **Cycle:** a quarter. Its dates are in `Asia/Kolkata`.
- **Objective:** belongs to one team and one cycle. `parent_id` aligns a team objective to a company objective. One level is enough for the pilot.
- **Key result:** a measurable outcome with a baseline and a target. Its kinds are number, percent, currency and milestone (0 or 1).
- **Key result ⇄ project:** many-to-many, because one project often moves two KRs.
- **Key result → task:** optional, for run teams (`docs/HOW-TEAMS-WORK.md`) whose work has no project. A task reaches a KR through its project or directly, never both.

## 4. Schema

This extends `web/lib/schema.sql` and keeps its conventions: text ids, `team_id` on the top entity, append-only `events`, mirror rows marked by `origin`.

```sql
CREATE TABLE cycles (
  id         text PRIMARY KEY,
  name       text NOT NULL,                 -- e.g. 'Q3 FY27'
  starts_on  date NOT NULL,
  ends_on    date NOT NULL,
  CHECK (ends_on > starts_on)
);

CREATE TABLE objectives (
  id               text PRIMARY KEY,
  team_id          text NOT NULL REFERENCES teams(id),
  cycle_id         text NOT NULL REFERENCES cycles(id),
  parent_id        text REFERENCES objectives(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  owner_id         text NOT NULL REFERENCES people(id),
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  origin           text NOT NULL CHECK (origin IN ('app','sheet')),
  origin_ref       text,
  created_at       timestamptz NOT NULL,
  CHECK ((origin = 'app') = (origin_ref IS NULL))
);

CREATE TABLE key_results (
  id               text PRIMARY KEY,
  objective_id     text NOT NULL REFERENCES objectives(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  owner_id         text NOT NULL REFERENCES people(id),
  kind             text NOT NULL CHECK (kind IN ('number','percent','currency','milestone')),
  unit             text,                     -- 'orders', 'INR', '%'
  baseline         numeric NOT NULL,
  first_target     numeric NOT NULL,         -- locked, like tasks.first_due_on
  target           numeric NOT NULL,
  confidence       text CHECK (confidence IN ('on_track','at_risk','off_track')),
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  origin           text NOT NULL CHECK (origin IN ('app','sheet')),
  origin_ref       text,
  created_at       timestamptz NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  CHECK ((origin = 'app') = (origin_ref IS NULL)),
  CHECK (first_target <> baseline AND target <> baseline),
  CHECK (kind <> 'milestone' OR (baseline = 0 AND first_target = 1 AND target = 1))
);
CREATE UNIQUE INDEX key_results_origin_ref ON key_results (origin, origin_ref) WHERE origin_ref IS NOT NULL;

CREATE FUNCTION key_results_first_target_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_target <> OLD.first_target THEN
    RAISE EXCEPTION 'first_target is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER key_results_first_target_locked BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION key_results_first_target_locked();

CREATE TABLE project_key_results (
  project_id     text NOT NULL REFERENCES projects(id),
  key_result_id  text NOT NULL REFERENCES key_results(id),
  PRIMARY KEY (project_id, key_result_id)
);

ALTER TABLE tasks ADD COLUMN key_result_id text REFERENCES key_results(id);
ALTER TABLE tasks ADD CONSTRAINT tasks_one_kr_path CHECK (project_id IS NULL OR key_result_id IS NULL);

-- events: two new entity types; a check-in value and a target change both need a reason.
ALTER TABLE events DROP CONSTRAINT events_entity_type_check;
ALTER TABLE events ADD CONSTRAINT events_entity_type_check
  CHECK (entity_type IN ('task','project','objective','key_result'));
ALTER TABLE events ADD CONSTRAINT events_kr_reason
  CHECK (entity_type <> 'key_result' OR field NOT IN ('value','target') OR reason IS NOT NULL);

-- notices: a check-in reminder points at a key result, not a task.
ALTER TABLE notices ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE notices ADD COLUMN key_result_id text REFERENCES key_results(id);
ALTER TABLE notices DROP CONSTRAINT notices_kind_check;
ALTER TABLE notices ADD CONSTRAINT notices_kind_check
  CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned','checkin_due'));
ALTER TABLE notices ADD CONSTRAINT notices_one_target
  CHECK ((task_id IS NULL) <> (key_result_id IS NULL) AND (kind = 'checkin_due') = (key_result_id IS NOT NULL));
```

In a real migration the `ALTER`s fold into the `CREATE TABLE`s in `schema.sql`. They are written as `ALTER`s here so the diff is readable.

**No check-in table.** A check-in is an event on the key result:

| Field | `after` | `reason` |
|---|---|---|
| `value` | the number, e.g. `412` | required: where the number came from ("Shopify orders report, 13 Oct") |
| `confidence` | `"on_track"` / `"at_risk"` / `"off_track"` | optional |
| `target` | the new target | required: why it changed |

This keeps rule 1 of `docs/DATA-MODEL.md`: `events` is the only history. The current value is not stored on `key_results`. It is the latest `value` event.

## 5. Derived, never stored

**Progress** = (latest value − baseline) / (target − baseline), clamped to 0–1. This one formula covers "up" and "down" key results (for example, return rate down from 12% to 8%), because the sign of target − baseline carries the direction.

```sql
SELECT kr.id, kr.title, v.value, v.at AS checked_at, v.reason AS source,
  CASE WHEN v.value IS NULL THEN NULL
       ELSE LEAST(1, GREATEST(0, (v.value - kr.baseline) / (kr.target - kr.baseline)))
  END AS progress
FROM key_results kr
LEFT JOIN LATERAL (
  SELECT (e.after #>> '{}')::numeric AS value, e.at, e.reason
  FROM events e
  WHERE e.entity_type = 'key_result' AND e.entity_id = kr.id AND e.field = 'value'
  ORDER BY e.at DESC, e.id DESC LIMIT 1
) v ON true
WHERE kr.status_category <> 'dropped'
ORDER BY kr.id;
```

**Objective score** = the mean progress of its KRs that have a check-in. It is always shown with its coverage ("62%, 2 of 3 KRs checked in"), never on its own.

**Pace** = days elapsed ÷ days in the cycle. It is shown beside the owner's confidence, not instead of it, so a gap between the two is visible.

**End-of-cycle ledger.** This is the counterpart of the on-time ledger. For each KR it takes the last check-in on or before the cycle's last day (`$1` is the cycle id):

| State | Meaning |
|---|---|
| `HIT` | reached the first target |
| `HIT RENEGOTIATED` | reached the current target, not the first |
| `MISSED` | reached neither |
| `NO CHECK-IN` | no value by the cycle's end |

```sql
WITH last AS (
  SELECT kr.id, kr.baseline, kr.first_target, kr.target,
    (SELECT (e.after #>> '{}')::numeric FROM events e
      WHERE e.entity_type = 'key_result' AND e.entity_id = kr.id AND e.field = 'value'
        AND (e.at AT TIME ZONE 'Asia/Kolkata')::date <= c.ends_on
      ORDER BY e.at DESC, e.id DESC LIMIT 1) AS value
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  JOIN cycles c ON c.id = o.cycle_id
  WHERE c.id = $1 AND kr.status_category <> 'dropped'
)
SELECT id, value, CASE
  WHEN value IS NULL THEN 'NO CHECK-IN'
  WHEN (value - baseline) / (first_target - baseline) >= 1 THEN 'HIT'
  WHEN (value - baseline) / (target - baseline) >= 1 THEN 'HIT RENEGOTIATED'
  ELSE 'MISSED' END AS state
FROM last ORDER BY id;
```

**No invented numbers.** This rule comes from `docs/OKR-PAGE-SUMMARY.md`. Every value on screen links to its check-in and source. A KR with no check-in shows "no check-in", never 0%.

## 6. Who does what

These map onto the existing `team_members.app_role` values.

| Role | Can |
|---|---|
| Lead | Create objectives and KRs. Set or change a target, with a reason. Link projects. Drop a KR, with a reason. |
| KR owner | Check in weekly: value, source, confidence. |
| Member | See everything. Link their own tasks to a KR. |

Mirror rows (`origin = 'sheet'`) are read-only in the app, the same rule as Sheet tasks.

## 7. Surfaces

Everything here reuses the existing UI tokens, with no new visual language, and nothing is sent without a yes.

- **Goals view:** objective → KRs (progress, confidence word, pace, last check-in) → linked projects with their on-time rate.
- **KR detail:** the trail of check-ins and target changes, from `events`.
- **Unlinked work:** open projects and tasks that reach no KR. This is the view most likely to earn its place in a weekly review.
- **Check-in reminder:** `checkin_due` in-app notice to the KR owner, weekly.
- **Monday digest:** for people already opted in, a KR section with progress, confidence and last check-in date.

**Status words.** KRs reuse `on_track / at_risk / off_track`. That makes open question 4 in `INTENT.md` (amber means "on track" here but "at risk" on the OKR page) a blocker, because OKRs will sit next to the OKR page's RAG.

## 8. Rollout

1. **Mirror.** Read the pilot team's current OKRs from their Sheet with the existing reader (`web/lib/sheets.ts`, a `header_map` per tab). Store them as `origin = 'sheet'`. Value changes in the Sheet become `value` events with the reason "changed in Sheet".
2. **Link.** Leads link projects and tasks to the mirrored KRs. The Goals and Unlinked work views go live here.
3. **Author.** A team moves one cycle to nico-desk. From then on the reader skips that team's tab for that cycle. This needs a per-cycle flag on `sheet_sources`, which is not designed here. The Sheet stays the source for every other team.

Steps 1 and 2 do not need nico-desk to own OKRs. Step 3 does, and it waits on the questions in section 2.

## 9. Open questions

| # | Question | Owner |
|---|---|---|
| 1 | Does authoring OKRs here replace the OKR page's goals view, or feed it? | the tracker owner, the OKR backend developer |
| 2 | Who sets KRs on the pilot team: the lead only, or the lead and the sponsor? | the pilot lead |
| 3 | Is a weekly check-in right for a run team? For a pipeline team? | the sponsor |
| 4 | Confidence: set by the owner, or derived from progress against pace? Proposed: set by the owner, pace shown beside it. | the sponsor |
| 5 | Where do KR values come from? Typed by hand first. Automatic feeds (for example the founder's metrics) need access granted for that purpose. | the founder |

## 10. Out of scope

- Weighted KRs.
- More than one level of cascade.
- Grading rituals.
- Automatic metric feeds.
- The extractor suggesting a KR for a drafted meeting task (a later slice).
