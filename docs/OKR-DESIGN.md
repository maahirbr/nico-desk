# OKRs in nico-desk: design

Written by a model (Opus 5.5) on 14 Oct 2026 for the repo owner. **A proposal, not a decision.** It assumes nico-desk becomes the system of record for OKRs, which is the repo owner's working assumption. Whether and when to build it is still open. Nothing here changes `SPEC.md` or the schema until that is decided and recorded in `CLAUDE.md` DECISIONS.

## 1. The idea in one line

nico-desk holds the company's OKRs: set, committed, checked in, closed. A key result's target is treated like a task's due date: committed once, locked, and changed only in the open with a reason. Progress is derived from check-ins and never stored. The overarching goal in `INTENT.md` ("every commitment gets done or openly renegotiated, without chasing") then covers goals as well as tasks.

## 2. What being the system of record means

Today OKRs live in the department OKR Sheets (the tracker owner's format) and are shown by the OKR page (`~/Code/Nicobar work`). Once nico-desk is the system of record:

- **One place to write.** Objectives, KRs, targets and check-ins are written only in nico-desk. A team's Sheet tab is imported once, at the start of a cycle, and then frozen. The Sheet's owner freezes it; nico-desk never writes to a Sheet.
- **Everything else reads.** The OKR page, the tracker owner's tracker and the founder's scorecard read OKRs from nico-desk through a read API and an export (section 8). They stop reading the Sheets for any team that has moved.
- **Duties that come with it.** Every change has a history and a reason, with no silent edits. A cycle is closed and its numbers frozen. OKRs are approved before they count. Past cycles stay readable. Exports and backups exist. Each of these is designed below.

This settles open question 6 in `HANDOFF.md` in one direction: the OKR page becomes a reader of nico-desk, and possibly a section of it. Open question 8 (shared backend) becomes "the OKR page reads nico-desk's API". Both still need a yes from the tracker owner and the OKR backend developer before build, because their tools change source.

## 3. Shape

```
cycle ─┬─ objective ── key result ⇄ project ── task
       │      └─ parent objective (one level: company → team)
       └─ key result ── task          (run teams with no project)
```

- **Cycle:** a quarter. Its dates are in `Asia/Kolkata`. It is open until a lead closes it, which freezes its numbers.
- **Objective:** belongs to one team and one cycle. It starts as a draft and counts only once committed. `parent_id` aligns a team objective to a company objective. One level is enough for the pilot.
- **Key result:** a measurable outcome with a baseline and a target. Its kinds are number, percent, currency and milestone (0 or 1).
- **Key result ⇄ project:** many-to-many, because one project often moves two KRs.
- **Key result → task:** optional, for run teams (`docs/HOW-TEAMS-WORK.md`) whose work has no project. A task reaches a KR through its project or directly, never both.

## 4. Lifecycle

| Step | Who | What happens |
|---|---|---|
| Draft | the lead | Objectives and KRs are created and edited freely. Targets can move. Nothing shows in ledgers. |
| Commit | the approver (open question 1) | Each KR's `first_target` is set to its current target and locked. The objective counts from here. |
| Run | KR owners, weekly | Check-ins: value, the source of the value, confidence. A target change needs a reason and stays visible. |
| Close | the lead, after the final numbers are in | The cycle is frozen. No more check-ins or target changes. The ledger becomes final. |
| Reopen | the lead, with a reason | Only to fix a wrong final number. It is logged like any other change. |

## 5. Schema

This extends `web/lib/schema.sql` and keeps its conventions: text ids, `team_id` on the top entity, append-only `events`.

```sql
CREATE TABLE cycles (
  id         text PRIMARY KEY,
  name       text NOT NULL,                 -- e.g. 'Q3 FY27'
  starts_on  date NOT NULL,
  ends_on    date NOT NULL,
  closed_at  timestamptz,                   -- set at close; the numbers are then frozen
  closed_by  text REFERENCES people(id),
  CHECK (ends_on > starts_on),
  CHECK ((closed_at IS NULL) = (closed_by IS NULL))
);

CREATE TABLE objectives (
  id               text PRIMARY KEY,
  team_id          text NOT NULL REFERENCES teams(id),
  cycle_id         text NOT NULL REFERENCES cycles(id),
  parent_id        text REFERENCES objectives(id),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  owner_id         text NOT NULL REFERENCES people(id),
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  committed_at     timestamptz,             -- NULL while a draft
  committed_by     text REFERENCES people(id),
  origin           text NOT NULL CHECK (origin IN ('app','import')),
  origin_ref       text,                    -- sheet id # row key, for an imported row
  created_at       timestamptz NOT NULL,
  CHECK ((committed_at IS NULL) = (committed_by IS NULL)),
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
  first_target     numeric,                  -- NULL until committed, then locked
  target           numeric NOT NULL,
  confidence       text CHECK (confidence IN ('on_track','at_risk','off_track')),
  status_category  text NOT NULL CHECK (status_category IN ('open','done','dropped')),
  origin           text NOT NULL CHECK (origin IN ('app','import')),
  origin_ref       text,
  created_at       timestamptz NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  CHECK ((origin = 'app') = (origin_ref IS NULL)),
  CHECK (target <> baseline AND (first_target IS NULL OR first_target <> baseline)),
  CHECK (kind <> 'milestone' OR (baseline = 0 AND target = 1 AND coalesce(first_target, 1) = 1))
);
CREATE UNIQUE INDEX key_results_origin_ref ON key_results (origin, origin_ref) WHERE origin_ref IS NOT NULL;

-- Once committed, the first target never changes. Same idea as tasks.first_due_on.
CREATE FUNCTION key_results_first_target_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF OLD.first_target IS NOT NULL AND NEW.first_target IS DISTINCT FROM OLD.first_target THEN
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

-- events: new entity types and origin; check-in values and target changes need a reason.
ALTER TABLE events DROP CONSTRAINT events_entity_type_check;
ALTER TABLE events ADD CONSTRAINT events_entity_type_check
  CHECK (entity_type IN ('task','project','cycle','objective','key_result'));
ALTER TABLE events DROP CONSTRAINT events_origin_check;
ALTER TABLE events ADD CONSTRAINT events_origin_check
  CHECK (origin IN ('app','sheet','granola','meeting','import'));
ALTER TABLE events ADD CONSTRAINT events_kr_reason
  CHECK (entity_type <> 'key_result' OR field NOT IN ('value','target') OR reason IS NOT NULL);
-- A cycle '_reopened' event already needs a reason: the existing events check covers any entity.

-- A closed cycle is frozen: no key result events until a lead reopens it.
CREATE FUNCTION events_cycle_frozen() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.entity_type = 'key_result' AND EXISTS (
    SELECT 1 FROM key_results kr
    JOIN objectives o ON o.id = kr.objective_id
    JOIN cycles c ON c.id = o.cycle_id
    WHERE kr.id = NEW.entity_id AND c.closed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'cycle is closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER events_cycle_frozen BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION events_cycle_frozen();

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

**Imported rows are not mirrors.** `origin = 'import'` records where a row came from. After the import it is an ordinary editable row, unlike Sheet tasks, which stay read-only mirrors.

**No check-in table.** A check-in is an event on the key result:

| Field | `after` | `reason` |
|---|---|---|
| `value` | the number, e.g. `412` | required: where the number came from ("Shopify orders report, 13 Oct") |
| `confidence` | `"on_track"` / `"at_risk"` / `"off_track"` | optional |
| `target` | the new target | required: why it changed |

Commit, close and reopen are events too (`committed_at` on the objective, `closed_at` and `_reopened` on the cycle). This keeps rule 1 of `docs/DATA-MODEL.md`: `events` is the only history. The current value is not stored on `key_results`. It is the latest `value` event.

## 6. Derived, never stored

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

**Cycle ledger.** This is the counterpart of the on-time ledger. It covers committed KRs only and uses each KR's latest value. Because a closed cycle accepts no new events, the latest value is the final one. Until close, the ledger shows as provisional. `$1` is the cycle id.

| State | Meaning |
|---|---|
| `HIT` | reached the first target |
| `HIT RENEGOTIATED` | reached the current target, not the first |
| `MISSED` | reached neither |
| `NO CHECK-IN` | no value recorded |

```sql
WITH last AS (
  SELECT kr.id, kr.baseline, kr.first_target, kr.target, c.closed_at IS NOT NULL AS final,
    (SELECT (e.after #>> '{}')::numeric FROM events e
      WHERE e.entity_type = 'key_result' AND e.entity_id = kr.id AND e.field = 'value'
      ORDER BY e.at DESC, e.id DESC LIMIT 1) AS value
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  JOIN cycles c ON c.id = o.cycle_id
  WHERE c.id = $1 AND kr.status_category <> 'dropped' AND kr.first_target IS NOT NULL
)
SELECT id, value, final, CASE
  WHEN value IS NULL THEN 'NO CHECK-IN'
  WHEN (value - baseline) / (first_target - baseline) >= 1 THEN 'HIT'
  WHEN (value - baseline) / (target - baseline) >= 1 THEN 'HIT RENEGOTIATED'
  ELSE 'MISSED' END AS state
FROM last ORDER BY id;
```

**No invented numbers.** This rule comes from `docs/OKR-PAGE-SUMMARY.md`. Every value on screen links to its check-in and source. A KR with no check-in shows "no check-in", never 0%.

## 7. Who does what

These map onto the existing `team_members.app_role` values. The approver is open question 1.

| Role | Can |
|---|---|
| Approver | Commit a team's objectives for the cycle. |
| Lead | Draft objectives and KRs. Change a committed target, with a reason. Link projects. Drop a KR, with a reason. Close and reopen the cycle. |
| KR owner | Check in weekly: value, source, confidence. |
| Member | See everything. Link their own tasks to a KR. |

## 8. Surfaces and interfaces

All views reuse the existing UI tokens, with no new visual language. Nothing is sent without a yes.

- **Set:** draft a cycle's objectives and KRs, then send them for commit.
- **Goals:** objective → KRs (progress, confidence word, pace, last check-in) → linked projects with their on-time rate.
- **KR detail:** the trail of check-ins, target changes, commit and close, from `events`.
- **Unlinked work:** open projects and tasks that reach no KR. This is the view most likely to earn its place in a weekly review.
- **Cycle ledger:** hit, hit renegotiated, missed, per team. Provisional until close.
- **Check-in reminder:** `checkin_due` in-app notice to the KR owner, weekly.
- **Monday digest:** for people already opted in, a KR section with progress, confidence and last check-in date.

**For other tools** (they now read from here):

- `GET /api/v1/okrs?cycle=` returns committed objectives, KRs, latest values with their sources, and links. It is read-only and needs sign-in.
- A per-cycle export as CSV, plus JSON in the OKR page's `Bundle` shape (`web/lib/types.ts` in that repo) so the OKR page can switch source without a rewrite. The mapping (KR → metric, project → initiative?) is to be confirmed with the OKR backend developer, because that repo is not on this machine.
- Backups follow whatever the hosted Postgres provides. Past cycles are never deleted.

**Status words.** KRs reuse `on_track / at_risk / off_track`. That makes open question 4 in `INTENT.md` (amber means "on track" here but "at risk" on the OKR page) a blocker, because the OKR page will show nico-desk's statuses.

## 9. Rollout

1. **Pilot team, next cycle start.** Import their Sheet OKRs once, with the existing reader (`web/lib/sheets.ts`, a `header_map` per tab). Rows land as `origin = 'import'` drafts. The approver commits them, and the Sheet owner freezes the tab.
2. **Link and run.** Leads link projects and tasks. KR owners check in weekly. The cycle closes at quarter end.
3. **Readers switch.** The OKR page and the tracker read the pilot team's OKRs from the API instead of the Sheet.
4. **Other teams** move one cycle at a time. Until a team moves, its Sheet is still its source, and nico-desk shows nothing for it.

## 10. Open questions

| # | Question | Owner |
|---|---|---|
| 1 | Who commits OKRs: the team lead, the sponsor, or the founder and the CEO for company objectives? | the sponsor |
| 2 | Will the OKR page and the tracker read from nico-desk? What is the `Bundle` mapping? | the tracker owner, the OKR backend developer |
| 3 | Is a weekly check-in right for a run team? For a pipeline team? | the sponsor |
| 4 | Confidence: set by the owner, or derived from progress against pace? Proposed: set by the owner, pace shown beside it. | the sponsor |
| 5 | Where do KR values come from? Typed by hand first. Automatic feeds (for example the founder's metrics) need access granted for that purpose. | the founder |
| 6 | How long after quarter end does a cycle stay open for final numbers? Proposed: 10 days. | the sponsor |

## 11. Out of scope

- Weighted KRs.
- More than one level of cascade.
- Grading rituals.
- Automatic metric feeds.
- The extractor suggesting a KR for a drafted meeting task (a later slice).
