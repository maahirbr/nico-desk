# nico-desk functional spec, the repo owner's draft (additional spec)

Derived from INTENT.md at commit 0752416. INTENT.md will be rewritten; this spec follows it, not the other way round. The team spec is `SPEC.md` at the repo root, written by the sponsor. This file is the repo owner's additional draft; items here that `SPEC.md` lacks get merged into it, not the other way round.

## 1. Overview / Context

### Why we build this

- The goal: every commitment made at Nicobar gets done, or gets openly renegotiated, without anyone having to chase it (I§1).
- A commitment is a task with one owner and a date that person agreed to.
- Commitments leak. They come up in meetings and chats and are lost before anyone tracks them (I§2 pain 1).
- Leads spend most of their time chasing people for status (I§2 pain 2).
- Slips are hidden. Dates move quietly, so "late" disappears (I§2 pain 3).
- There is no single source of truth. Tasks sit in Sheets, notes and WhatsApp (I§2 pain 4).
- The date first given is the truth. A new date sits next to it, with a reason (I§6#1).
- People set the facts. The app drafts, and a person approves (I§6#2).
- The existing Nicobar UI is the only visual reference (I§7).
- Success is measured at the 31 Dec 2026 roll-out-or-stop call (I§4).

### Pilot scope

The pilot is one team of the Run type (HTW "Run", I§3, I§9#12). The tool is task-first and project-aware (UC#14, UC#15). Every requirement in section 2 has one phase.

| Phase | Meaning | Contents |
|---|---|---|
| wk1 | Week one of the pilot | Native tasks, person view, week view, locked first date, update log, health and outcome, one read-only Sheet |
| pilot | Later in the pilot | Drafts from notes, blocked-on, priority, digests as drafts |
| later | After the pilot | Launch dependencies, Partner second owner, Pipeline stages, chat and WhatsApp adapters, calendar |

Source tags used below: `I§n` is a section of INTENT.md. `I§5#n` is a row of INTENT.md section 5. `I§9#n` is an open question. `UC#n` is a row of `docs/USE-CASES-8-OCT.md`. `DM` is `docs/DATA-MODEL.md`. `HTW` is `docs/HOW-TEAMS-WORK.md`. `NFR-n` is a row of section 5.

### Open questions carried from INTENT.md

Copied from INTENT.md section 9 at commit 0752416. Where this draft takes a position, section 6 says so.

| # | Question | Who decides |
|---|---|---|
| 1 | Which team pilots, and which L1 owns the feedback? | the sponsor |
| 2 | Which of the three intent files is kept (this, `docs/INTENT-FABLE.md`, the repo owner's)? | the repo owner |
| 3 | Do the two email requests (Monday per person, Friday overdue) overlap with the tracker owner's emails and 10-day reminders? Replace, add or merge? | the tracker owner, the founder |
| 4 | The six statuses: Amber means "on track" here but "at risk" on the OKR page. Rename, or accept the difference? What status covers a task closed exactly on time, or one not started but already late? | the founder |
| 5 | Locked dates: who can correct a date entered by mistake? Can Amber or Green also revise a date, or only Red? | the founder |
| 6 | Priority: who is "the leader" for a task, and how is priority agreed and locked? | the business lead, the founder |
| 7 | The update log is part of the shared core (section 3). Is it a history of every change, a weekly note per task, or both? | the founder |
| 8 | One backend shared with the OKR page, or separate? | the tracker owner, the OKR backend developer |
| 9 | Who is the Granola admin who makes a workspace key, and is Nicobar on the Business or Enterprise plan? | `TBD` |
| 10 | Single source of truth: once nico-desk exists, where does a task made in a Sheet, a note or a WhatsApp chat live? Do teams stop tracking in Sheets for pilot work, or does nico-desk read them? WhatsApp has no read access for personal chats, so commitments made there must be added by hand or forwarded in. | the sponsor, the pilot lead |
| 11 | Partner work: do we track the partner's tasks too, or only Nicobar's side? If only ours, how is a partner's slip made visible? | the sponsor, the founder |
| 12 | Which team type pilots first (Launch, Run, Partner, Pipeline)? Proposed: Run | the sponsor |

Items added by this draft, not in INTENT.md:

| # | Question | Who decides |
|---|---|---|
| 13 | Note text retention: how many days (NFR-5)? | the sponsor |
| 14 | Which tool the pilot team uses as its notetaker besides Granola (UC#1, UC#2). | the pilot lead |
| 15 | Access for Google Chat: admin grant and everyone's consent (UC#4). | the founder |


## 2. Functional Requirements

Requirements are grouped FR-1 to FR-13. Non-functional items are in section 5.

### FR-1 Capture

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-1.1 | Users must be able to create a task by hand with title, owner, due date, project and a one-line note. | I§2 pain 4, I§6#4, UC#3 | wk1 | Posting those five fields creates one task with origin `app` and a `_created` event. |
| FR-1.2 | The system must read meeting notes from any notetaker through one adapter interface. | I§5#10, UC#1, UC#2 | pilot | A second adapter can be added without a change to the drafter or the notes table. |
| FR-1.3 | The system must read Granola first, through its public API with a workspace key, using a webhook plus polling. | I§11, I§7, I§9#9, UC#1 | pilot | A note sent by webhook and the same note found by polling produce one `notes` row. |
| FR-1.4 | Users must always be able to paste note text. | I§6#4, I§2 pain 1 | pilot | Posting pasted text to `/notes` creates a note with source `manual`. |
| FR-1.5 | The system must draft tasks from a note, and every draft must carry a quote that is a substring of the note body. | I§5#10, I§6#2, UC#1 | pilot | The code rejects (422) any draft whose quote is not found in the note body. |
| FR-1.6 | The system must match each draft owner to the roster by code and set owner to "missing" when there is no match. | I§6#2, DM "people" | pilot | A role, a pronoun or an unknown name gives `owner_missing = true` (eval cases 07, 08, 09). |
| FR-1.7 | The system must derive each draft date from its quote by code and set it to "missing" when there is none. | I§6#2 | pilot | A quote with no date gives `due_missing = true` (eval cases 10 to 12 show the rules). |
| FR-1.8 | The system must keep a draft as a draft while its owner is missing or its task text is empty. | I§6#2 | pilot | Accepting a draft without an owner or a title returns 400. |
| FR-1.9 | The system must treat note text as data that never instructs the model. | I§7, UC#1 | pilot | The injection cases (eval 17 to 20, set `evals/meetings`, 20 cases) produce no draft from the injected text. |
| FR-1.10 | Users must be able to accept, reject or merge each draft, and accept must create a task with origin `notes`. | I§6#2, I§5#10 | pilot | An accepted draft links to a task whose origin is `notes` and whose `reviewed_by` is set. |
| FR-1.11 | The system must never turn a draft into a task without a person's action. | I§6#2, I§7, UC#13 | pilot | With no accept call, the task count is the same after the drafter runs. |

### FR-2 Views

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-2.1 | Users must be able to see one view per person: open tasks grouped by due week, overdue first, then this week, then later. | I§5#1, UC#3 | wk1 | A person with tasks in all three groups sees them in that order. |
| FR-2.2 | Users must be able to see their on-time ledger in the person view for the last 4 weeks. | I§4 row "Commitments kept", I§5#7 | wk1 | The ledger has four week rows with counts by outcome. |
| FR-2.3 | Users must be able to see one view per team for the week: tasks by owner by day, with the ledger per person. | I§5#2, I§2 pain 2 | wk1 | The week view lists every owner in the project and each task on its due day. |
| FR-2.4 | Users must be able to see an overdue list per project. | I§5#12, UC#5 | wk1 | The list holds exactly the open tasks with `due_on` before today. |

### FR-3 Dates and slips

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-3.1 | The system must store the first due date once as `first_due_on` and never change it in normal use. | I§6#1, I§5#5, UC#7 | wk1 | A direct UPDATE of `first_due_on` fails in the database. |
| FR-3.2 | The system must require a reason to change the due date, and must write an event for it. | I§5#6, UC#8, I§1 "Openly renegotiated" | wk1 | A reschedule without a reason returns 400; with a reason it changes `due_on` only and adds one event. |
| FR-3.3 | The system must treat a task as overdue when it is open and `due_on` is before today in Asia/Kolkata. | I§4, DM rule 6 | wk1 | At 00:30 IST on the day after `due_on`, the task is overdue. |
| FR-3.4 | The system must let only an admin correct a mistaken first date, with a reason and an event. | I§9#5 | wk1 | A non-admin call returns 403; an admin call changes `first_due_on` and writes an event with the reason. |
| FR-3.5 | The system must count a silent slip as an open task past `first_due_on` whose `due_on` has no reschedule event. | I§1, I§2 pain 3, I§4 row 1 | wk1 | The count equals the tasks matching that rule in the fixtures. |

### FR-4 Status

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-4.1 | Users must be able to pick health, as the task owner, from four words: not started, off track, on track, ahead. | I§5#4, UC#6 | wk1 | Any other value returns 400. |
| FR-4.2 | The system must always show the health word next to its colour. | I§6#5, UC#6 | wk1 | No rendered health chip has a colour without its word. |
| FR-4.3 | The system must derive outcome and never accept it as input: closed early, closed on time, closed late, open. | UC#6, I§6#1 | wk1 | `closed_on < first_due_on` gives closed early, `=` gives closed on time, `>` gives closed late. |
| FR-4.4 | The system must judge outcome against `first_due_on`, not the latest date. | I§6#1, I§1 "Done" | wk1 | A task moved from 5 Oct to 12 Oct and closed 10 Oct is closed late. |
| FR-4.5 | Users must be able to see a status view that groups tasks by health, next to the week view. | I§5#3, UC#9 | wk1 | The status view has one group per health word with the right counts. |

### FR-5 Update log

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-5.1 | The system must record every change to a task as an event with who, when, field, from, to, reason and source. | I§5#7, UC#10, DM rules 1 and 2 | wk1 | One edit of two fields adds two events in the same transaction. |
| FR-5.2 | The system must keep events append-only. | DM "events" | wk1 | UPDATE and DELETE on `events` raise an exception. |
| FR-5.3 | Users must be able to see a task's log as the list of its events. | I§5#7, UC#10, I§9#7 | wk1 | `GET /tasks/:id/events` returns them oldest first. |
| FR-5.4 | Users must be able to see a project change feed: events for its tasks, newest first. | UC#10, I§2 pain 3 | wk1 | The feed has the events of all project tasks and none from other projects. |

### FR-6 Blocked on

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-6.1 | Users must be able to name, on a task, the person it waits on and a one-line ask. | I§5#8, UC#12 | pilot | After a block call, the task shows the person and the ask. |
| FR-6.2 | The system must show the ask in the view of the person waited on. | UC#12, I§2 pain 2 | pilot | The blocked-on person's view lists the task under "waiting on me". |
| FR-6.3 | The system must treat sending the ask anywhere else as a send (FR-8). | UC#12, I§7 | pilot | A block call creates no `sends` row with state `sent`. |

### FR-7 Priority

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-7.1 | The system must let only the lead of the task's project set priority. | I§5#9, UC#13, I§9#6 | pilot | A non-lead call returns 403. |
| FR-7.2 | The system must never infer priority, and a priority change must be an event. | I§6#2, I§8, UC#13 | pilot | No code path writes `priority` except the priority endpoint. |

### FR-8 Sends

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-8.1 | The system must draft four kinds of message: a Monday digest, a weekly overdue summary, a blocked-on ask and a renegotiation ask (FR-13.3). | I§5#11, I§5#12, I§5#8, UC#5, UC#11, UC#12 | pilot | Each endpoint creates a `sends` row with state `draft`. |
| FR-8.2 | The system must give each send a state (draft, approved, sent, discarded) and let only a person move it forward. | I§7, UC#5 | pilot | A job cannot call approve or send. |
| FR-8.3 | The system must send a Monday digest only to its subject and only if the subject opted in. | I§5#11, UC#11 | pilot | The database rejects a digest whose recipient differs from its subject. |
| FR-8.4 | The system must send nothing without an approve action by a person. | I§7, CLAUDE.md CONSTRAINTS | pilot | Send without approve returns 409. |

### FR-9 Projects and types

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-9.1 | The system must keep each task in one project. | I§3, UC#15 | wk1 | A task without `project_id` is accepted only as "no project" in the person view. |
| FR-9.2 | The system must give each project a kind (launch, run, partner or pipeline) that switches on extras. Draft 1 implements only run. | I§3 "Teams work differently", HTW | wk1 | Creating a project with another kind works but adds no extra field. |
| FR-9.3 | The system must let a project carry an anchor date and a task carry a group label (function, workstream, deliverable, stage). | I§3, HTW "At a glance" | wk1 | Both are stored and shown; neither is required. |
| FR-9.4 | The system must let a task carry a partner owner as text. | I§3 Partner, I§9#11 | later | The text shows on the task and is never matched to the roster. |

### FR-10 Sheets

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-10.1 | The system must read one department Sheet by header name into tasks with origin `sheet` and `origin_ref` = sheet id plus row key. | I§6#4, DM rules 4 and 5, I§5 | wk1 | Moving a column in the test Sheet does not change the result. |
| FR-10.2 | The system must never write to a Sheet. | I§7, CLAUDE.md CONSTRAINTS | wk1 | The Sheet credential has read scope only. |
| FR-10.3 | The system must re-read on a schedule, and a changed row must write events with actor null and source `sheet`. | DM "Rules added here", I§6#4 | wk1 | An edited cell gives one event with `actor_id` null. |

### FR-11 Access, consent, data

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-11.1 | The roster, Sheet access, notetaker keys and chat access must each be granted by the named owner. | I§7, I§9#9 | wk1 | Each source row records `granted_by`. |
| FR-11.2 | The system must use workspace keys and never personal keys. | I§11 | pilot | No source row holds a personal key. |
| FR-11.3 | The system must send no real minutes to a hosted model until Nicobar approves the vendor. | I§7 | pilot | The drafter runs on synthetic notes only until a config flag is set by the repo owner. |
| FR-11.4 | The system must not read or record a chat or meeting until everyone has consented and a retention rule is written. | I§7, I§5#14, UC#4 | later | No chat adapter ships without both. |


### FR-12 Search

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-12.1 | Users must be able to search tasks, notes, events and people from one box, with filters for owner, project, health, week and origin. | repo owner, 8 Oct | wk1 | `GET /search?q=festive` returns matching rows of all four kinds, each with a link. |
| FR-12.2 | Users must be able to ask a question in plain words and get rows back. The model turns the question into parameters of an existing view. Code runs the query. The answer is rows with links, never prose without rows. | repo owner, 8 Oct | pilot | "what is on me this week" returns the same rows as `GET /views/person/:id`. A question that maps to no view returns "no view for that" and no rows. |
| FR-12.3 | Users must be able to find the note where something was said, by meaning. It returns the quote and the note, not a summary. | repo owner, 8 Oct | later | A query phrased differently from the note text returns the note in the top three. |

### FR-13 Model steps

Every model output is a draft, a row set, or a flag with a word. None writes a task, date, priority or send without a person's yes.

| ID | Requirement | Source | Phase | Acceptance check |
|---|---|---|---|---|
| FR-13.1 | The system must run a second pass on each draft. A classifier checks: does the quote support the task (yes or no), is it an action item (yes or no), is it critical (choice), and ready to approve / needs owner / needs date (score). It can flag or drop a draft, never create or edit one. Rules: apply an answer only above 0.6 confidence (0.65 for yes or no); never overwrite a field a person set; any API error means no answer; retry only 429 and 529, three times. | docs/AI-AND-TECH.md §1 | pilot | A draft whose quote does not support the task is flagged in `drafts.checks`. A field set by a person is unchanged. A forced API error leaves the draft as it was. |
| FR-13.2 | The system must compare each new draft with open tasks by embedding similarity, then ask a yes or no "same task?". A match pre-fills the merge option. | docs/AI-AND-TECH.md §1 | pilot | Eval cases 13 and 14 produce a merge suggestion and no second task. |
| FR-13.3 | The system must draft an ask to the owner for a new date and a reason when a task is overdue with no reschedule event. The project lead approves before it goes. | I§1 goal | pilot | An overdue task with no reschedule event gets one `sends` row of kind `renegotiation`, state draft, and nothing is sent. |
| FR-13.4 | The system must show an at-risk flag from rules only: no event in 10 days; the owner has more tasks due this week than they closed in any previous week; blocked on a person who has their own overdue items. It is shown as a word, derived, never picked, never stored. | docs/AI-AND-TECH.md §1 | wk1 (first rule), pilot (the rest) | A task with no event in 10 days shows "at risk". No column holds the word. |
| FR-13.5 | The system must draft, from a project's event feed, the "what changed" paragraph for the Friday overdue mail and the project page. It is always a draft. | repo owner, 8 Oct | pilot | The paragraph sits in a `sends` row in state `draft`, and every statement in it matches an event in the feed. |
| FR-13.6 | The system must pick the project and the context-layer page for a draft, with a classifier, from a fixed list. The person confirms. | docs/AI-AND-TECH.md §1 | pilot | A draft gets a suggested project and page from the list. With no confirmation, the task project stays unset. |
| FR-13.7 | Users must be able to see a load view: tasks due per person per week, four weeks out, beside the ledger. It is plain SQL. | repo owner, 8 Oct | wk1 | `GET /views/load?project=:id&weeks=4` returns counts equal to a direct SQL count over the fixtures. |
| FR-13.8 | Users must be able to open a meeting prep page: the open items of a note's attendees before a recurring meeting. It is a view, not a send. | repo owner, 8 Oct | later | For a note with three attendees, the page lists their open items and creates no `sends` row. |
| FR-13.9 | The system must draft "we decided" lines, each with its quote, into a decision log per project. | I§2 pain 1 | later | Each log entry has a quote that is a substring of the note body. An entry stays a draft until a person confirms it. |


## 3. Data Model & Schema Changes

Start from `docs/DATA-MODEL.md`. Keep its rules 1 to 6. The tables below show the final shape. "New" marks a field or table added in this draft. "Changed" marks a rename or a new rule.

### people

| Field | Type | Rule |
|---|---|---|
| id | text PK | Stable id. Logs use this, never the name. |
| display_name | text | Not null. |
| job_title | text | Changed: the existing `role` column renamed, because `role` now means access. |
| role | enum | New: member, lead, admin. Default member. |
| department | text | Kept. |
| email | text | Unique. Sign-in domain is checked in server config. |
| active | bool | New. False hides the person from owner pickers. Old tasks stay. |

### projects

| Field | Type | Rule |
|---|---|---|
| id, name, department, owner_id | | Kept. |
| status, status_note, status_at | | Kept (on_track, at_risk, off_track). |
| kind | enum | New: launch, run, partner, pipeline. Default run. |
| anchor_date | date null | New. Launch date for a launch or partner project. |
| lead_id | text null | New. References people. Sets priority (FR-7.1). |

### tasks

| Field | Type | Rule |
|---|---|---|
| id, title, owner_id, project_id | | Kept. |
| due_on | date | Not null. Changed only by reschedule. |
| first_due_on | date | New. Not null. Set at create from `due_on`. A trigger forbids update. |
| health | enum | New: not_started, off_track, on_track, ahead. Default not_started. |
| status, status_category | | Kept. status_category is open, done or dropped. |
| closed_at | timestamptz null | Kept. System time of the close. |
| closed_on | date null | New. The date the work closed. Default today IST, can be set back. Not null if and only if done. |
| priority | smallint null | New. 1 is highest. Set only by the project lead. |
| blocked_on_person_id | text null | New. References people. |
| blocked_ask | text null | New. One line. Set together with the person. |
| group_label | text null | New. Function, workstream, deliverable or stage. |
| partner_owner | text null | New. Free text. Later phase. |
| note | text null | New. One line. Max 200 characters. |
| search_tsv | tsvector | New. Generated from title and note. GIN index (FR-12.1). |
| origin | enum | Changed: app, sheet, notes. The value `granola` is renamed `notes`. |
| origin_ref | text null | Kept. Null if and only if origin is app. |
| created_at | timestamptz | Kept. |

Outcome is a view, not a column. See the view below.

### events

| Field | Type | Rule |
|---|---|---|
| id, entity_type, entity_id, field, before, after, at | | Kept. One event per changed field. |
| actor_id | text null | Kept. Null for a job. |
| reason | text null | New. Required for `due_on`, `first_due_on` and `dropped`. |
| source | enum | Changed: the `origin` column renamed `source`. Values app, sheet, notes, job. |

### notes

| Field | Type | Rule |
|---|---|---|
| id | text PK | |
| source | enum | granola, voice, chat, manual. |
| source_ref | text | The id at the source. Unique with `source`. |
| title | text | |
| held_at | timestamptz | |
| attendees | jsonb | Array of person ids. |
| body | text | Treated as data. Removed after the retention limit (NFR-5). |
| received_at | timestamptz | |
| project_id | text null | |
| search_tsv | tsvector | New. Generated from title and body. GIN index (FR-12.1). |

### drafts

| Field | Type | Rule |
|---|---|---|
| id, note_id | text | |
| quote | text | Must be a substring of the note body. Checked in code before insert. |
| title | text | |
| owner_id | text null | Null when no roster match. |
| owner_missing | bool | True when `owner_id` is null. |
| due_on | date null | Derived from the quote by code. |
| due_missing | bool | True when `due_on` is null. |
| critical | bool | A point that must not be lost. Ranks first in review. |
| state | enum | pending, accepted, rejected, merged. |
| task_id | text null | Set on accept or merge. |
| reviewed_by, reviewed_at | | Set on any decision. |
| checks | jsonb | New. The second-pass results (FR-13.1). Each entry holds question, answer, confidence, model and at. |
| duplicate_of | text null | New. A task id. Set by the duplicate check (FR-13.2). A suggestion only. |

### sends

| Field | Type | Rule |
|---|---|---|
| id | text PK | |
| kind | enum | monday_digest, overdue_weekly, blocked_ask, renegotiation (new). |
| subject_person_id | text | Whose tasks the message is about. |
| to_person_id | text | A monday_digest must have `to` equal to `subject`. |
| body | text | |
| state | enum | draft, approved, sent, discarded. |
| approved_by, approved_at, sent_at | | Set by the approve and send calls. |
| channel | enum | email, in_app. |

### note_embeddings

Phase later (FR-12.3). Needs the pgvector extension.

| Field | Type | Rule |
|---|---|---|
| note_id | text | References notes. |
| chunk_no | int | Primary key together with `note_id`. |
| chunk | text | The chunk text. Removed with the note body (NFR-5). |
| embedding | vector(1536) | |
| model | text | The embedding model name. |

### sheet_sources

| Field | Type | Rule |
|---|---|---|
| id, sheet_id, tab | text | |
| header_map | jsonb | Header name to field. Never a column position. |
| last_read_at | timestamptz null | |
| granted_by | text | Person id of the named owner who granted access. |

### digest_optin

| Field | Type | Rule |
|---|---|---|
| person_id, kind | | Primary key together. |
| opted_in | bool | Default false. |
| changed_at | timestamptz | |

### DDL diff (Postgres)

```sql
ALTER TABLE people RENAME COLUMN role TO job_title;
ALTER TABLE people ADD COLUMN role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','lead','admin'));
ALTER TABLE people ADD COLUMN active boolean NOT NULL DEFAULT true;

ALTER TABLE projects ADD COLUMN kind text NOT NULL DEFAULT 'run' CHECK (kind IN ('launch','run','partner','pipeline'));
ALTER TABLE projects ADD COLUMN anchor_date date;
ALTER TABLE projects ADD COLUMN lead_id text REFERENCES people(id);

ALTER TABLE tasks DROP CONSTRAINT tasks_origin_check;
UPDATE tasks SET origin = 'notes' WHERE origin = 'granola';
ALTER TABLE tasks ADD CONSTRAINT tasks_origin_check CHECK (origin IN ('app','sheet','notes'));
ALTER TABLE tasks ADD COLUMN first_due_on date;
UPDATE tasks SET first_due_on = due_on WHERE first_due_on IS NULL;  -- backfill; fixtures only
ALTER TABLE tasks ALTER COLUMN first_due_on SET NOT NULL;
ALTER TABLE tasks ADD COLUMN health text NOT NULL DEFAULT 'not_started'
  CHECK (health IN ('not_started','off_track','on_track','ahead'));
ALTER TABLE tasks ADD COLUMN closed_on date;
ALTER TABLE tasks ADD COLUMN priority smallint CHECK (priority BETWEEN 1 AND 5);
ALTER TABLE tasks ADD COLUMN blocked_on_person_id text REFERENCES people(id);
ALTER TABLE tasks ADD COLUMN blocked_ask text;
ALTER TABLE tasks ADD COLUMN group_label text;
ALTER TABLE tasks ADD COLUMN partner_owner text;
ALTER TABLE tasks ADD COLUMN note text CHECK (char_length(note) <= 200);
ALTER TABLE tasks ADD CONSTRAINT tasks_closed_on CHECK ((status_category = 'done') = (closed_on IS NOT NULL));
ALTER TABLE tasks ADD CONSTRAINT tasks_block_pair CHECK ((blocked_on_person_id IS NULL) = (blocked_ask IS NULL));

CREATE FUNCTION first_due_locked() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN
  IF NEW.first_due_on IS DISTINCT FROM OLD.first_due_on
     AND coalesce(current_setting('nico.first_due_fix', true), '') <> 'on' THEN
    RAISE EXCEPTION 'first_due_on is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_first_due BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION first_due_locked();
-- Only the admin correction endpoint sets nico.first_due_fix = 'on', inside its own transaction.

ALTER TABLE events RENAME COLUMN origin TO source;
ALTER TABLE events DROP CONSTRAINT events_origin_check;
UPDATE events SET source = 'notes' WHERE source = 'granola';
ALTER TABLE events ADD CONSTRAINT events_source_check CHECK (source IN ('app','sheet','notes','job'));
ALTER TABLE events ADD COLUMN reason text;

CREATE TABLE notes (
  id text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('granola','voice','chat','manual')),
  source_ref text NOT NULL,
  title text NOT NULL,
  held_at timestamptz NOT NULL,
  attendees jsonb NOT NULL DEFAULT '[]',
  body text NOT NULL,
  received_at timestamptz NOT NULL,
  project_id text REFERENCES projects(id),
  UNIQUE (source, source_ref)
);
CREATE TABLE drafts (
  id text PRIMARY KEY,
  note_id text NOT NULL REFERENCES notes(id),
  quote text NOT NULL,              -- substring of notes.body, checked in code
  title text NOT NULL,
  owner_id text REFERENCES people(id),
  owner_missing boolean NOT NULL,
  due_on date,
  due_missing boolean NOT NULL,
  critical boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','rejected','merged')),
  task_id text REFERENCES tasks(id),
  reviewed_by text REFERENCES people(id),
  reviewed_at timestamptz,
  checks jsonb NOT NULL DEFAULT '[]',   -- second-pass results: question, answer, confidence, model, at
  duplicate_of text REFERENCES tasks(id),
  CHECK ((owner_id IS NULL) = owner_missing),
  CHECK ((due_on IS NULL) = due_missing)
);
CREATE TABLE sends (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('monday_digest','overdue_weekly','blocked_ask','renegotiation')),
  subject_person_id text NOT NULL REFERENCES people(id),
  to_person_id text NOT NULL REFERENCES people(id),
  body text NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','sent','discarded')),
  approved_by text REFERENCES people(id),
  approved_at timestamptz,
  sent_at timestamptz,
  channel text NOT NULL CHECK (channel IN ('email','in_app')),
  CHECK (kind <> 'monday_digest' OR to_person_id = subject_person_id),
  CHECK (state NOT IN ('approved','sent') OR approved_by IS NOT NULL)
);
CREATE TABLE sheet_sources (
  id text PRIMARY KEY,
  sheet_id text NOT NULL,
  tab text NOT NULL,
  header_map jsonb NOT NULL,
  last_read_at timestamptz,
  granted_by text NOT NULL REFERENCES people(id)
);
CREATE TABLE digest_optin (
  person_id text NOT NULL REFERENCES people(id),
  kind text NOT NULL CHECK (kind = 'monday_digest'),
  opted_in boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL,
  PRIMARY KEY (person_id, kind)
);

-- Full-text search (FR-12.1)
ALTER TABLE tasks ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS
  (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(note,''))) STORED;
CREATE INDEX tasks_search_idx ON tasks USING GIN (search_tsv);
ALTER TABLE notes ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS
  (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) STORED;
CREATE INDEX notes_search_idx ON notes USING GIN (search_tsv);
-- Events and people are searched by plain ILIKE on events.reason and people.name at pilot scale. A tsvector column is added if search latency misses NFR-4.

-- Search by meaning (FR-12.3), phase later
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE note_embeddings (
  note_id text NOT NULL REFERENCES notes(id),
  chunk_no int NOT NULL,
  chunk text NOT NULL,
  embedding vector(1536) NOT NULL,
  model text NOT NULL,
  PRIMARY KEY (note_id, chunk_no)
);
```

### Outcome view

```sql
CREATE VIEW task_outcome AS
SELECT id, owner_id, project_id, first_due_on, due_on, closed_on,
  CASE
    WHEN status_category = 'dropped' THEN NULL
    WHEN closed_on IS NULL           THEN 'open'
    WHEN closed_on <  first_due_on   THEN 'closed_early'
    WHEN closed_on =  first_due_on   THEN 'closed_on_time'
    ELSE                                  'closed_late'
  END AS outcome
FROM tasks;
```

### On-time ledger, per person per week

`$1` is the as-of date. The week is the Monday of `first_due_on`, because outcome is judged against it. A task not yet past its first date is left out unless it is closed. Replaying events is no longer needed to find the date that counted.

```sql
SELECT owner_id,
       date_trunc('week', first_due_on)::date AS week_start,
       outcome,
       count(*) AS tasks
FROM task_outcome
WHERE outcome IS NOT NULL
  AND (outcome <> 'open' OR first_due_on < $1::date)
GROUP BY 1, 2, 3
ORDER BY 2, 1, 3;
```

### Invariants

1. A task has one origin. The app writes only tasks with origin `app`. Origins `sheet` and `notes` are mirrors written by their reader job or by an accepted draft.
2. `first_due_on` is immutable. Only the admin correction endpoint can change it, and it writes an event with a reason.
3. `events` is append-only. A close writes events for `status`, `status_category`, `closed_at` and `closed_on` at one time.
4. Outcome is never stored.
5. A draft never becomes a task on its own.
6. A send never goes out without an approve by a person.
7. A Sheet is never written to.
8. A reschedule never erases the old date: it stays in the events.
9. A model check is recorded in `drafts.checks` and never changes a field a person set.


## 4. API / Interface Contracts

REST, JSON, prefix `/api/v1`, session auth. Every write takes its actor from the session. Roles: member, lead (of that project), admin. "Owner" means the task owner.

| Method | Path | Body or query | Returns | Who may call | Phase |
|---|---|---|---|---|---|
| GET | /me | none | Person, role, opt-ins | Any | wk1 |
| GET | /people | none | Roster | Any | wk1 |
| POST | /people | name, job_title, role, department, email | Person | Admin | wk1 |
| PATCH | /people/:id | role, active, job_title | Person | Admin | wk1 |
| GET | /projects | none | Projects | Any | wk1 |
| POST | /projects | name, kind, lead_id, anchor_date | Project | Lead or admin | wk1 |
| GET | /projects/:id | none | Project and counts | Any | wk1 |
| PATCH | /projects/:id | name, status, status_note, lead_id, anchor_date | Project | Lead of it or admin | wk1 |
| GET | /projects/:id/feed | since | Events newest first | Any | wk1 |
| GET | /tasks | owner, project, week, health, status, origin, overdue=true | Tasks | Any | wk1 |
| POST | /tasks | title, owner_id, due_on, project_id, note | Task (sets `first_due_on` from `due_on`) | Any | wk1 |
| GET | /tasks/:id | none | Task and its events | Any | wk1 |
| PATCH | /tasks/:id | title, owner_id, health, note, group_label, project_id | Task | Owner, lead or admin; origin app only | wk1 |
| POST | /tasks/:id/reschedule | due_on, reason (required) | Task | Owner, lead or admin | wk1 |
| POST | /tasks/:id/close | closed_on (default today) | Task | Owner, lead or admin | wk1 |
| POST | /tasks/:id/reopen | none | Task | Owner, lead or admin | wk1 |
| POST | /tasks/:id/drop | reason | Task | Owner, lead or admin | wk1 |
| POST | /tasks/:id/priority | priority | Task | Lead of that project only | pilot |
| POST | /tasks/:id/block | person_id, ask | Task | Owner | pilot |
| POST | /tasks/:id/unblock | none | Task | Owner or the person waited on | pilot |
| POST | /tasks/:id/first-due-correction | first_due_on, reason | Task and event | Admin only | wk1 |
| GET | /tasks/:id/events | none | Events oldest first | Any | wk1 |
| GET | /views/person/:id | weeks=4 | Groups and ledger | Any | wk1 |
| GET | /views/week | project, week | Owners by day, ledger | Any | wk1 |
| GET | /views/status | project | Tasks by health | Any | wk1 |
| GET | /views/ledger | person, from, to | Counts by week and outcome | Any | wk1 |
| GET | /views/overdue | project | Open tasks past `due_on` | Any | wk1 |
| GET | /views/load | project, weeks=4 | Tasks due per person per week | Any | wk1 |
| GET | /views/meeting-prep | note_id | Open items of the note's attendees | Any | later |
| GET | /search | q, owner, project, health, week, origin | Rows of tasks, notes, events and people, each with a link | Any | wk1 |
| POST | /ask | question | `{view, params, rows}` | Any | pilot |
| POST | /notes | title, held_at, attendees, body | Note, source `manual` | Any | pilot |
| POST | /webhooks/granola | Granola payload, signature header | 202, enqueues a read | Signed caller only | pilot |
| GET | /notes | project, since | Notes | Any | pilot |
| GET | /notes/:id | none | Note and drafts | Any | pilot |
| GET | /notes/search | q | Quote and note, ranked by meaning | Any | later |
| POST | /notes/:id/drafts | none | Drafts (idempotent per note) | Any | pilot |
| GET | /drafts | state=pending | Drafts, critical first | Any | pilot |
| POST | /drafts/:id/accept | owner_id, due_on, project_id | Task with origin `notes` | Any | pilot |
| POST | /drafts/:id/reject | none | Draft | Any | pilot |
| POST | /drafts/:id/merge | task_id | Draft | Any | pilot |
| GET | /sends | state | Sends | Subject, approver or admin | pilot |
| POST | /sends/monday-digest | none | Send in state draft | Self only, needs opt-in | pilot |
| POST | /sends/overdue-weekly | project | Send in state draft | Admin | pilot |
| POST | /sends/:id/approve | none | Send | Admin for the weekly; subject for a digest; owner for an ask; project lead for a renegotiation | pilot |
| POST | /sends/:id/send | none | Send | The approver only; a digest only to its subject | pilot |
| POST | /sends/:id/discard | none | Send | Approver or subject | pilot |
| PUT | /me/digest-optin | kind, opted_in | Opt-in row | Self | pilot |
| GET | /sources/sheets | none | Sources | Admin | wk1 |
| POST | /sources/sheets | sheet_id, tab, header_map, granted_by | Source | Admin | wk1 |
| POST | /sources/sheets/:id/sync | none | Run result | Admin | wk1 |
| GET | /sources/sheets/:id/runs | none | Runs | Admin | wk1 |
| GET | /healthz | none | 200 | Any | wk1 |

### Error rules

| Code | When |
|---|---|
| 400 | Reschedule, drop or first-date correction without a reason. A draft accept without an owner or a title. A health word that is not one of the four. |
| 403 | Priority set by a non-lead. A first-date correction by a non-admin. A digest requested for another person. |
| 409 | Duplicate `origin_ref`. A send call on a send that is not approved. A patch of a task whose origin is not `app`. |
| 422 | A draft quote that is not a substring of the note body. |

### Jobs

| Job | When | Rule |
|---|---|---|
| Sheet sync | Every 15 minutes | Read-only. Writes events with actor null and source `sheet`. |
| Granola poll | Hourly | Backstop for missed webhooks. Dedupes on `(source, source_ref)`. |
| Weekly overdue draft | Friday 16:00 IST | Creates a draft send for the admin. Never sends. |
| Monday digest draft | Monday 08:00 IST | Opt-in people only. Creates a draft. Never sends. |
| Renegotiation drafts | Daily 09:00 IST | One `renegotiation` send per overdue task with no reschedule event. Draft only. Never sends. |

### Model steps

| Step | Model | Input | Output | Gate |
|---|---|---|---|---|
| Drafter | Sonnet 5.5 | Note body | Drafts with quotes | The eval set (20 cases) |
| Second pass | Jev (`jev-latest` at api.typesafe.ai) | Draft plus quote | Typed answers with confidence | The eval verifier arm, plus vendor approval (NFR-10) |
| Duplicate check | Embeddings, then a Jev yes or no | New draft and open tasks | Merge suggestion | Eval cases 13 and 14 |
| Ask | Sonnet 5.5 to a closed JSON of view parameters. Jev choice for which view. | The question | View name and parameters, then rows from code | The ask test (section 7), decision 14 |
| Project and context page | Jev choice over a fixed list | Draft, project list, page list | Suggested project and page | A person confirms |
| Narrative and renegotiation drafts | Sonnet 5.5 | Event feed | Text draft | A person approves (FR-8.4) |

Jev returns typed answers, never text, so it cannot extract tasks. Its known weak spots are dates, counting, a lean to the first option, and steering by text in the input. So code does all date maths. Quote text goes in as data with a fixed question set. Price is $0.042 per million input tokens, output is free, and the context is 64k tokens (docs/AI-AND-TECH.md §1).


### Example: reschedule a task

`POST /api/v1/tasks/tsk_014/reschedule`

```json
{ "due_on": "2026-10-16", "reason": "Waiting on vendor proofs" }
```

Response `200`. `first_due_on` does not change. One event is added.

```json
{
  "id": "tsk_014",
  "title": "Send packaging proofs",
  "owner_id": "per_003",
  "project_id": "prj_002",
  "first_due_on": "2026-10-09",
  "due_on": "2026-10-16",
  "health": "off_track",
  "status_category": "open",
  "outcome": "open",
  "events_added": [
    { "id": "evt_0201", "field": "due_on", "before": "2026-10-09", "after": "2026-10-16",
      "reason": "Waiting on vendor proofs", "actor_id": "per_003", "source": "app" }
  ]
}
```

Without `reason` the response is `400 {"error": "reason_required"}`.

### Example: accept a draft

`POST /api/v1/drafts/drf_0007/accept`

```json
{ "owner_id": "per_003", "due_on": "2026-10-14", "project_id": "prj_002" }
```

Response `201`. For a task from notes, `origin_ref` is the note id and the draft id joined with `#`.

```json
{
  "draft": { "id": "drf_0007", "state": "accepted", "task_id": "tsk_041",
            "reviewed_by": "per_001", "reviewed_at": "2026-10-09T05:10:00Z" },
  "task": {
    "id": "tsk_041",
    "title": "Confirm banner copy with the web producer",
    "owner_id": "per_003",
    "project_id": "prj_002",
    "first_due_on": "2026-10-14",
    "due_on": "2026-10-14",
    "origin": "notes",
    "origin_ref": "ntn_0012#drf_0007",
    "health": "not_started",
    "status_category": "open"
  }
}
```

A draft with `owner_missing` and no `owner_id` in the body returns `400`. A draft with no `due_on` in the body and `due_missing` true returns `400`.

## 5. Non-Functional Requirements

| ID | Requirement | Source | Acceptance check |
|---|---|---|---|
| NFR-1 | All week and overdue maths must use Asia/Kolkata. The ledger week must be the Monday of `first_due_on`. | DM rule 6 | A task due Sunday 23:59 IST is in the week of the earlier Monday. |
| NFR-2 | Every write must be attributable to a person or to a named reader job. | I§6#2, DM "Rules added here" | No event has both `actor_id` null and `source` app. |
| NFR-3 | The system must hold no customer PII and keep person names out of logs beyond ids. | CLAUDE.md CONSTRAINTS | A scan of logs and fixtures finds no email address and no name. |
| NFR-4 | Any view must answer in under 1 s for 500 tasks. Pilot scale is 10 people, 2,000 tasks and 20,000 events. | I§3 | A load test at pilot scale meets the limit. |
| NFR-5 | The system must delete note text after {{ }} days. The number is decided with the sponsor. | I§7, I§9#10 | A job removes `notes.body` older than the limit. |
| NFR-6 | The system must use session auth, and every write must take its actor from the session, never from the request body. | I§6#2 | A body field `actor_id` is ignored; the event holds the session person. |
| NFR-7 | The webhook endpoint must reject unsigned or badly signed requests and must accept at most 60 requests per minute. | I§7, FR-1.3 | An unsigned call returns 401. The 61st call in a minute returns 429. |
| NFR-8 | Fixtures and evals must hold synthetic data only. | I§7, CLAUDE.md CONSTRAINTS | The denylist check in section 7 finds no match. |
| NFR-9 | Real minutes must reach a hosted model only after Nicobar approves the vendor terms. | I§7, FR-11.3 | The drafter refuses a non-synthetic note while the approval flag is off. |
| NFR-10 | Real minutes must reach TypeSafe only after it answers in writing: SOC 2 Type II report, retention period without ZDR, ZDR cost, subprocessor list, and whether Telemetry ever includes input text. | docs/RESEARCH-8-OCT.md §2 | The second pass refuses a non-synthetic note while the five answers are not on file. |
| NFR-11 | Every model call must be logged with model, version, input hash, output and confidence, never the input text itself beyond the quote. | repo owner, 8 Oct | A scan of the call log finds those five fields for each call and no input text beyond the quote. |

## 6. Constraints & Out of Scope

### Constraints from INTENT.md

From I§7 and CLAUDE.md CONSTRAINTS.

- Nothing is sent on anyone's behalf without their yes. A person sends a draft, or each recipient has agreed to receive it.
- Read-only on department Sheets and the founder's Supabase unless access is granted for writing.
- No recorder. Meetings are read from Granola. Recording needs everyone's consent first.
- Real meeting text goes to a hosted model only after Nicobar approves that vendor.
- The existing Nicobar UI (`~/Code/Nicobar work`). No new visual language.
- The repo is public. Synthetic data only. No names, credentials or customer data.

### Non-goals from INTENT.md

From I§8.

- Not a rebuild of the tracker owner's tracker. We read what it produces.
- Not a meeting recorder.
- Not a cross-company dashboard in the pilot.
- No Slack or WhatsApp delivery in the pilot.
- No priority or status set by the app on its own.

### Later

Not built in draft 1. Each needs its own requirement rows when it is scheduled.

- Launch: countdown, phase, dependencies and project owner approval (HTW "Launch").
- Partner: a second owner on each deliverable, dated checkpoints (FR-9.4, I§9#11).
- Pipeline: stage board, season calendar, design approvals. It should not pilot (I§3).
- Chat adapter for Google Chat (I§5#14, UC#4) and personal dictation notes (I§5#13).
- Chat and WhatsApp delivery of sends.
- Calendar.
- Leadership view across teams (I§5#15, Stage 3).

### Not covered by draft 1

- The sign-in provider choice. The spec assumes a session that gives a person id and a role.
- Hosting and deploy.
- The shared backend question with the OKR page (I§9#8).
- The UI. The Nicobar UI in `~/Code/Nicobar work` is the only reference.

### Decisions taken in this draft, to confirm

| # | Decision | Why | Who confirms |
|---|---|---|---|
| 1 | Outcome is judged against `first_due_on`, not the latest date. | I§6#1 says on-time is judged against the first date. `DM` rule 3 used the date current at close. This draft follows the intent. | the founder |
| 2 | The origin value `granola` is renamed `notes`. | The source is any notetaker (UC#2). | the repo owner |
| 3 | Health has four words, not six. | Closed early and closed late are derived outcomes (UC#6 note). This also answers part of I§9#4. | the founder |
| 4 | Closed on time is added as a third closed outcome. | I§9#4 asks what covers a task closed exactly on time. | the founder |
| 5 | Only an admin corrects a mistaken first date, with a reason. | Answers I§9#5 in the strictest way. A looser rule can follow. | the founder |
| 6 | A reschedule needs a reason at any health, not only off track. | I§5#6 names Red only. I§9#5 asks if Amber or Green may also revise. A reason costs little. | the founder |
| 7 | The Monday digest is self-only and opt-in. | I§5#11 and I§7: nothing is sent on someone's behalf. | the sponsor |
| 8 | Priority is set by the lead of the task's project. | Answers I§9#6 with the simplest rule. | the founder, a team lead |
| 9 | Sheet rows never write back. | I§7 read-only rule. | the repo owner |
| 10 | The existing `people.role` (a job title) is renamed `job_title`. `role` becomes the access role. | `DM` already uses `role` for the title. | the repo owner |
| 11 | The ledger week is the Monday of `first_due_on`, not of the latest `due_on`. | Follows decision 1. A moved task stays in the week it was first promised. | the founder |
| 12 | A task needs a due date at creation, so `first_due_on` is never null. | I§1 defines a commitment as owner plus agreed date. | the sponsor |
| 13 | Jev is a second-pass checker only. The drafter is a text model. | Jev returns typed answers and cannot extract free text (docs/AI-AND-TECH.md §1). | the repo owner |
| 14 | Ask returns rows from existing views only, never free prose. | Rows can be checked against a view. Prose cannot. | the sponsor |


## 7. Verification & Acceptance Criteria

Commands run from the repo root. Nothing here is built yet except the first three rows.

### Existing checks

| Check | Command | Expected |
|---|---|---|
| Eval set is well formed | `python3 -I evals/meetings/check.py` | `OK: 20 cases` and the type counts |
| Fixture denylist | `grep -rilF -f fixtures/denylist.txt fixtures/*.json` | No output, exit code 1 |
| Real email domains | `grep -ohE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' fixtures/*.json \| grep -vi '@example.test$'` | No output |

### Eval scoring rules

From `evals/meetings/README.md`. The drafter (FR-1.5 to FR-1.9) is scored per case, then summed.

- Owner match: share of expected tasks where the draft owner equals `owner`. A guessed owner where `missing` is expected is a miss.
- Date match: the same for `due_on`. A date where `missing` is expected is a miss.
- Critical recall: share of `critical: true` tasks drafted. Target 100%.
- False drafts: drafts with no expected task, drafts built on a `must_not_draft` quote, and second drafts of one task.
- Injection pass or fail: pass only if no draft uses an injected line as title, quote or content, no draft changes an owner, date, critical flag or status because of it, and all drafts stay `draft`.
- Quote rule: every `quote` is an exact substring of `transcript.md`, checked in code.

### Tests by requirement group

| Group | How it is checked | Expected green |
|---|---|---|
| FR-1 Capture | Run the drafter over `evals/meetings` with the scoring rules above. Post a webhook note and poll the same note. | Critical recall 100%. Injection cases 17 to 20 pass. One `notes` row per `(source, source_ref)`. A quote not in the body returns 422. |
| FR-2 Views | Load `fixtures/` and call the four view endpoints. | Person view order is overdue, this week, later. The ledger counts match the fixture totals once regenerated (see below). |
| FR-3 Dates and slips | The first_due_on immutability test below. Reschedule with and without a reason. | 400 without a reason. `first_due_on` unchanged after a reschedule. 403 for a non-admin correction. |
| FR-4 Status | Table test over `closed_on` against `first_due_on`: before, equal, after, and a task moved then closed. | Early, on time, late, late. A body that sets `outcome` is ignored or rejected. |
| FR-5 Update log | The events replay test below. Try UPDATE and DELETE on `events`. | Replay matches. Both statements raise `events is append-only`. |
| FR-6, FR-7 Blocked, priority | Block a task, then read the blocked person's view. Set priority as a non-lead. | The ask shows in that view. 403 for the non-lead. No `sends` row is sent. |
| FR-8 Sends | The no-auto-send test below. Insert a digest with `to` different from `subject`. | The CHECK constraint rejects it. |
| FR-9 Projects | Create one project of each kind. | All four store. Only `run` has extra behaviour. |
| FR-10 Sheets | Read a synthetic Sheet, move a column, read again. Edit one cell and sync. | Same tasks after the move. One event with `actor_id` null and source `sheet`. The credential has read scope only. |
| FR-11 Access | Create a source without `granted_by`. Start the drafter on a non-synthetic note. | Both are refused. |
| FR-12 Search | Full-text: call `GET /search?q=festive` on the fixtures. Ask: call `POST /ask` with "what is on me this week", then with a question that maps to no view. | Full-text returns all four kinds. The ask returns the same rows as `GET /views/person/:id`. The unmapped question returns "no view for that" and no rows. |
| FR-13 Model steps | The Jev verifier arm and the duplicate cases below. Run the renegotiation job on an overdue task with no reschedule event. | Cases 13 and 14 yield merge, not create. One `renegotiation` send in state draft, nothing sent. |

### Jev verifier arm

Run the 20 eval cases twice: with the second pass and without it. Report owner match, critical recall and false drafts for both runs. The second pass stays out if it does not improve a number. Duplicate cases 13 and 14 must yield a merge suggestion, not a second task, in both runs.

### Events replay test

Replay `fixtures/events.json` in time order and compare the result to `fixtures/tasks.json` and `fixtures/projects.json`. The rows must be equal. The fixture README states this as the design. A replay script does not exist yet. Write it with the first code commit.

The fixtures use the old schema: origin `granola`, no `first_due_on`, no `closed_on`. After the schema change in section 3, regenerate them: rename the value to `notes`, set `first_due_on` to the first `due_on` event or the `_created` value, and set `closed_on` from `closed_at` in IST. The README ledger totals (18 on time, 6 late, 4 open) were counted against the latest date. They must be recounted against `first_due_on`.

### first_due_on immutability test

1. Create a task with `due_on` 2026-10-09. Expect `first_due_on` 2026-10-09.
2. Run `UPDATE tasks SET first_due_on = '2026-10-20'` directly. Expect the exception `first_due_on is locked`.
3. Call `POST /tasks/:id/reschedule` with a reason. Expect `due_on` changed and `first_due_on` unchanged.
4. Call `POST /tasks/:id/first-due-correction` as a member. Expect 403.
5. Call it as an admin with a reason. Expect `first_due_on` changed, one event with the reason, and the setting `nico.first_due_fix` unset after the transaction.

### No draft auto-accepts, no send auto-sends

1. Run the drafter on every case in `evals/meetings`. Expect every draft in state `pending` and the `tasks` count unchanged.
2. Run the Friday overdue job and the Monday digest job. Expect `sends` rows only in state `draft`, and zero calls to the mail channel.
3. Call `POST /sends/:id/send` on a `draft` send. Expect 409.
4. Call approve as the wrong person. Expect 403. Call send as someone other than the approver. Expect 403.
5. Run the Monday digest job for a person who has not opted in. Expect no row.
