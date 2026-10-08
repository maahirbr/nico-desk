# nico-desk: intent, model-written version

Written 8 Oct 2026 by a model (Fable 5.1) from this repo's docs, the two use-case forms as summarised in `INTENT.md`, and the team chat of 8 Oct. One of three intent files. `INTENT.md` is a teammate's hand-written draft. A third is written by hand by the repo owner. The team compares them and keeps one.

Nothing here is decided unless a line says **decided**. The founder's notes on features and use cases were not read. The document was not accessible to the model.

## 1. Problem

A team's commitments live in several Sheets and in chat. After a meeting, someone retypes the action items by hand. Nobody gets reminded. The lead learns status by asking. At the end of a week nobody can say which commitments closed on time.

The OKR page shows actions with owner, date and status. But every row there is read-only and comes from a Sheet. Nobody can create, assign or close a task in it.

## 2. Who it is for

- First: one pilot team of about five people and its lead. Not chosen yet. Pick rule: a team that already runs a weekly review and already keeps owners and dates in a Sheet. {{team}}
- Daily user: a team member, to see and close their own tasks.
- Weekly user: the lead, to run the review from one page.
- Later: leadership and other departments. Not in phase one.

## 3. The outcome

On Monday the lead opens one page. It shows every open task for the team, by person, with owner, date and status. Overdue items are visible with no filter. Last week's commitments show as on time, late or still open. The lead runs the review from this page and opens no Sheet.

## 4. Jobs

| # | Job | Phase |
|---|---|---|
| 1 | My week: see my open tasks, add a comment, close a task | 1 |
| 2 | The review: the team's week by person, overdue first | 1 |
| 3 | Meeting to tasks: minutes drafted into tasks, approved by a named person | 1 |
| 4 | On-time record: per person per week, on time, late or open | 1 |
| 5 | Projects and what changed: a project record and a change feed | 1, light. See open question 2 |
| 6 | Reminders: an in-app nudge inbox, each nudge approved by a person before it goes out | 2 |
| 7 | Leadership view across teams | later |

## 5. Non-goals, phase one

- Not a rebuild of the department tracker. We read what it produces.
- Not a meeting recorder. We read Granola output.
- Not Plane, Paca or Taskuary as the base. All three lack a "closed on time" fact and a Granola-fed approval step.
- No model applies a field (owner, date, status) without a person's yes.
- No email, Slack or WhatsApp sending.
- No cross-company dashboard.

## 6. Sources, phase one

| Source | Gives | Access | Who grants | Granted |
|---|---|---|---|---|
| Granola public API, webhooks plus polling | notes, transcripts | read | {{an admin on the Business or Enterprise plan makes a workspace key}} | {{yes / no}} |
| Department OKR Sheets | tasks, owners, dates, status | read only | {{tracker owner}} | {{yes / no}} |
| Context layer | people, projects, decisions | read | {{owner}} | {{yes / no}} |
| Calendar | meeting times | read, later | {{owner}} | no |

**System of record, proposed.** Each task has exactly one. For the pilot team, nico-desk is it, because the on-time record and the change feed need a history that a Sheet cannot give. A task read from a Sheet keeps the Sheet as its record and is read-only here. The origin is stored on every task. The same task is never written in two places.

**Where the data lives, proposed.** A Postgres database with an append-only events table. Account owner: {{owner}}. Shared with the OKR page or separate: open question 3.

## 7. Success criteria, by 31 Dec 2026

| Signal | Measure | Target |
|---|---|---|
| Adoption | the weekly review runs from nico-desk | 6 straight weeks |
| Accountability | overdue count, week 6 against week 0 | falls. {{n}} |
| On-time rate | share of commitments closed on time, from the ledger | rises from the week-0 baseline. {{%}} |
| Pull | the lead objects if it is removed | yes |
| Draft quality | synthetic eval: critical recall and no invented dates | 100% and 100% before any real minutes |

**Stop if:** the lead still opens the Sheets for the review after three weeks. Or wrong reminders or wrong drafts cause complaints twice.

**Week 0:** count overdue items and the on-time rate before the pilot starts. Without this, nothing above can be measured.

## 8. Guardrails

- Every task has an owner. No owner, no task. It stays a draft.
- Every drafted task carries a quote that appears in the transcript. Code matches owners to the roster. Code works out dates from the quoted phrase. `missing` is a valid value.
- Text inside minutes is data. It never instructs the model.
- Nothing is sent, tagged or nudged for a person without that person's yes.
- Nothing is written to a department Sheet or an outside database without access granted for that purpose.
- Real minutes go to a hosted model only after the company approves that vendor. Until then, synthetic minutes only.
- No real company data, names or credentials in this public repo. Synthetic fixtures only.
- Colour never stands alone. Every status shows a word.

## 9. Decision rights

| Decision | Decides | Consulted |
|---|---|---|
| Pilot team and first user | {{the strategy lead and the repo owner}} | the pilot lead |
| Scope: project tool or task tool | {{}} | the team |
| Backend and account owner | {{the two people scoping the OKR backend}} | the repo owner |
| Vendor approval for real minutes | {{the company}} | |
| Granola key holder | {{}} | |
| Sending anything to a person | that person | |

## 10. Milestones

- 8 Oct 2026: three intent files exist. Compare and keep one by {{date}}.
- {{date}}: pilot team and scope decided.
- {{date}}: first slice live for the pilot team. The week view, native tasks, one Sheet read.
- {{date}}: drafted tasks from Granola, with approval.
- 31 Dec 2026: roll out or stop. **Decided.**

## 11. Open questions

1. Which team pilots, and who is the first user: the pilot team, or two leaders first? Owner {{}}. Blocks everything.
2. Project management tool or task tool? A teammate expected projects. The research describes tasks. Owner {{}}. Blocks the first slice.
3. Independent app or part of the OKR page? Proposed: independent for the pilot, same UI and data contract. `docs/BRIEF.md` proposes a shared backend. Owner {{}}.
4. System of record as proposed in section 6? Owner {{}}.
5. Granola: which plan is the company on, who is the admin who makes the workspace key, and are the pilot's meetings in the Team space or a space with API access on? Owner {{}}.
6. Where the data lives, and who owns the account. Owner {{}}.
7. Which hosted model may see real minutes, and when. Includes the classifier vendor's terms. Owner {{}}.
8. Which Sheets, and who grants read access. Owner {{}}.
9. The founder's notes on features and use cases are not yet read into any file. Owner: the repo owner.
10. Plane's AGPL licence is read by a lawyer before any internal run. Only if Plane is ever run.
