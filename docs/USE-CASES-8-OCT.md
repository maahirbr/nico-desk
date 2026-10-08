# Use cases from the team, 8 Oct 2026, and the intent behind each

Three people posted feature requests in the team channel.
The teammate who drafted INTENT.md asked that the requests go to a future spec, and that the why behind each goes to the intent.
This file does that split.

## The sponsor's one-line intent

On 8 Oct, 4:05 PM, the sponsor gave her intent in one line: "every commitment made at Nicobar gets done, or gets openly renegotiated, without anyone having to chase it."

She named four pains:

1. Commitments leak. Tasks come up in meetings, chats and different notetakers, and get lost before anyone tracks them.
2. Project leads spend most of their time chasing people. The system should remind and hold people accountable.
3. Slips are hidden. Dates move quietly. A delay should be visible, with a reason and a new date.
4. There is no single source of truth. Tasks are spread across sheets, notes and WhatsApp.

Her framing is task-first but project-aware, because tasks only make sense inside a project and teams group work differently (function, workstream, partner, stage).

| # | Request | From | The why (intent) | Where it lands |
|---|---|---|---|---|
| 1 | Import notes from two named notetakers so the tracker is updated | the founder | Commitments are made in conversation and die before they reach the tracker. The tracker must be fed from wherever commitments are made. | Intent: capture at source. Spec: notetaker adapters, Granola first. |
| 2 | Do not restrict to one notetaker; people use different ones | the teammate who drafted INTENT.md | Same why. The source must be a notes-in interface, not one vendor. | Intent: tool-agnostic input. Spec: adapter per notetaker. |
| 3 | One user sees everything pending at their end | the founder | Nobody can answer "what is on me" without hunting. | Intent: the person view. Slice one. |
| 4 | Scan Google Chat for to-dos, add to the list, propose | the founder | Same why as 1. "Propose" means a person approves. | Intent: capture at source, human approves. Spec: a chat adapter, later. Needs access and consent. |
| 5 | At the end of the week an admin sends an email with overdue tasks, drafted with everybody and items shown | the founder | Overdue work is only fixed when it is visible to the group. A person sends it, the system drafts. | Intent: accountability is social. Guardrail kept: nothing sent without a person's yes. Spec: weekly overdue draft. |
| 6 | Six status colours: Black not started, Red started off track, Amber on track, Green on track and likely early, Purple closed early, Dark Blue closed late | the founder | A status must say both health now and outcome against the date. Today it says neither. | Intent: health and outcome are two facts. Note: closed early or late is derived from dates, not picked, so Purple and Dark Blue become the on-time ledger. Status colour always carries a word. Spec: the status model. |
| 7 | Once a due date is set it is locked and cannot change | the founder | Dates slip silently. The first commitment must stay on record. | Intent: the original date is never lost. Slice one: the events table keeps it, a new date is a new event. |
| 8 | If a task goes red, a new completion date and a reason for delay must be logged | the founder | A slip must cost a stated reason and a fresh commitment. | Intent: pushed dates are recorded with a reason. Slice one: event with field due_on and a reason. |
| 9 | A view by status, next to the week view | the founder | Triage by health, not only by date. | Spec: a saved view. Cheap once views are one state function. |
| 10 | Discuss the update log | the founder | A task's history must be readable. | Slice one: the events table, shown as a change feed. |
| 11 | Every Monday an email to each person with their tasks and status, so they pick their week | a team lead | The week should start from a list, not a search. People look at email. | Intent: pull at the start of the week. Guardrail: a person's own digest, opt-in. Spec: Monday digest. |
| 12 | A column to request support where work is stuck on someone else, and tag people | a team lead | Blocked work is invisible until it is late. A block needs a named ask. | Intent: blockers are explicit and owned. Spec: a blocked-on field and a request. Guardrail: tagging someone is a send, needs the sender's yes. |
| 13 | Priority tagging locked with the specific leader, not assumed by the app | a team lead | Priority is a leadership decision. The app must not infer it. | Intent: no model applies a field without a yes. Already a guardrail. Spec: priority set by a named leader. |
| 14 | The founder says task management, not full project management, and that INTENT.md covers it | the founder | The pain is follow-up on tasks, not portfolio planning. | Decision input: open question 2 in `docs/INTENT-FABLE.md` (task tool or project tool) leans task. See `docs/HOW-TEAMS-WORK.md` for the project layer as switches. |
| 15 | Task-first but project-aware | the sponsor | Tasks only make sense inside a project, and teams group work differently. | Decision input: open question 2 in `docs/INTENT-FABLE.md`. Same as the sponsor's four types as switches. |

## What this changes

- Open question 2 now leans "task-first, project-aware", with the founder and the sponsor agreeing. The sponsor's four types stay as switches.
- The sources section of the intent becomes "notes-in, any notetaker, Granola first".
- The status model gains health plus a derived outcome.
- Three new spec items: Monday digest, blocked-on, priority by leader.
- Two access questions are added: Google Chat, and a second notetaker.
