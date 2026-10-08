# intent.md: nico-desk

Why we are building this, what is broken today, the evidence for it, and what good looks like.
Anyone (person or agent) working on this repo reads this first. Detail on screens, fields and
flows goes in `spec.md`, not here.

People are named by role because the repo is public. A number with no source is marked
`UNVERIFIED`. Anything unknown is `TBD`. Never guess.

| Field | Value |
|---|---|
| Owner | the repo owner |
| Version | 0.2 |
| Last updated | 2026-10-08 |
| Status | Draft. Not yet agreed with the sponsor, the founder or a pilot lead |
| Stage | Stage 1: one pilot team → Stage 2: more teams → Stage 3: leadership view across teams |

---

## 1. The goal

> **Every commitment made at Nicobar gets done, or gets openly renegotiated, without anyone
> having to chase it.**

- **Commitment:** a task with one owner and a date that person agreed to.
- **Done:** closed, and the log shows whether it closed by the date first given.
- **Openly renegotiated:** a new date and a reason, logged before the first date passes, visible
  to the lead and anyone waiting on it. A date that slips with no new date is a silent slip, the
  thing this tool exists to end.
- **Without chasing:** the tool reminds, surfaces and asks. No lead messages people for status.

Everything below serves this goal. If a feature does not move it, it waits.

### The intent in one sentence

> We are building **one page where a Nicobar team runs its week** so that **each person sees
> what is pending at their end and each lead runs the weekly review without chasing anyone**,
> which today **means piecing together Sheets, notes and WhatsApp and chasing people, and nobody can say which
> commitments closed on time**.

---

## 2. The problem

**What is broken today: four pain points**

Each one breaks a part of the goal in section 1.

1. **Commitments leak.** Tasks come up in meetings, chats and different note-takers, and get lost
   before anyone tracks them. After a meeting, someone retypes action items into a Sheet by hand,
   if at all. *Breaks: "every commitment".*
2. **Leads spend most of their time chasing.** To run a weekly review, a lead opens each tracker
   and chases people in chat for status. Nothing reminds people, and when work is stuck on someone
   else there is no place to say so. The system should do the reminding and hold people
   accountable. *Breaks: "without anyone having to chase it".*
3. **Slips are hidden.** Due dates move quietly, so "late" disappears. Nobody can say at the end
   of a week which commitments closed on time and which slipped. A delay should be visible, with
   a reason and a new date. *Breaks: "openly renegotiated".*
4. **There is no single source of truth.** Tasks are spread across Sheets, meeting notes and
   WhatsApp. Nobody has one list of what they owe, and nobody can see a team's list without
   asking. *Breaks: "gets done", since no one can see all of it.*

**Evidence**

| What | Source |
|---|---|
| All four pain points above: leaking commitments, leads chasing, hidden slips, no single source of truth (tasks in Sheets, notes and WhatsApp) | The sponsor, from conversations across teams, Oct 2026 |
| Tasks across several Sheets, no reminders, action items typed in by hand after meetings | Two use-case forms from the post-workshop sheet, 3 Oct and 5 Oct 2026 |
| Leads chase status in chat before the weekly review | Use-case forms; `HANDOFF.md` section 1 |
| The founder asks for one view of "everything pending at my end", a weekly overdue email, locked due dates and a logged reason when work goes red | The founder's use-case notes, Oct 2026 |
| A business lead asks for a Monday email per person, a way to flag work blocked on someone else, and leader-set priority | A business lead's use-case notes, Oct 2026 |
| The OKR page shows actions but they are read-only rows. A task cannot be created or assigned there, and a tag never reaches the person | `docs/OKR-PAGE-SUMMARY.md` (read from the code, 5 Oct 2026) |
| No tool reviewed turns meeting minutes into tracked tasks natively, and no open-source tool records whether a commitment closed on time | `docs/COMPETITORS.md`, `docs/TASKUARY-PACA-PLANE.md` |

**What it costs us**

- About 1 hour a day per person spent tracking actions across meetings and Sheets. Source: the
  use-case form's own estimate. `UNVERIFIED` until measured in week 0.
- Overdue items today: `TBD`. Nobody has counted. The week 0 baseline (section 4) fixes that.
- Commitments closed on time today: `TBD`. No system records it.

**Why existing tools do not fit**

- **The OKR page** shows owner, date and status, but reads from a file. No create, assign,
  comment or delivery.
- **The tracker owner's tracker** (`nicobar-okr-processor`) already runs Granola to Sheets to
  APPROVED to email, with 10-day reminders. It covers OKR forums only. It has no per-person view,
  no blocked flag, no on-time record and no locked dates. We read what it produces and do not
  rebuild it. `TBD`: confirm with the tracker owner that these gaps are real.
- **Linear, Asana, Plane and the like** are built around projects and engineering words, not a
  weekly review. None records "closed on time against the date first given", and none feeds
  approved meeting tasks in. None uses the Nicobar UI, which is a hard constraint.

---

## 3. Who it is for

| Role | What they need to get done | How often | Today they use |
|---|---|---|---|
| Team member | See everything pending at their end, update it, say when they are blocked | Daily, plus a Monday summary | Several Sheets, notes, WhatsApp |
| Lead (L1) | Run the weekly review, see what is late and where people need support, set priority | Weekly | Opens each Sheet, chases on chat and WhatsApp |
| Admin (the team's coordinator) | Send the end-of-week overdue summary to everyone | Weekly | By hand, or not at all |
| Leadership (CEO, founder) | See every team's open and overdue work in one view | Weekly | Asks each lead |

**Primary user for the pilot:** the lead. If the lead does not run the review from it, nobody
else gets value.

### Teams work differently

Nicobar teams do not all run work the same way. Four types so far, from a sample of teams. Every
type shares one core: **owner, task, due date, status, a one-line note and an update log**. Each
type switches on what it needs on top.

| Type | What it is | Unit of work | Grouped by | Time anchor | Main view | Needs on top of the core |
|---|---|---|---|---|---|---|
| Launch | A product or category going live on a fixed date. Work split by function, one team often waiting on another | Task | Function | Launch date | What blocks launch | Countdown and phase, dependencies, project owner approval |
| Run | Ongoing work across standing workstreams, no end date. A small team, each person on parts of many projects | Task | Workstream | None | My open and overdue | Pushed-date record, reminders, recurring tasks |
| Partner | Nicobar and an outside partner deliver together toward a date | Deliverable | Deliverable | Launch date plus checkpoints | Next two weeks | An owner on each side, dated checkpoints, what the partner needs from us, tasks drafted from meeting notes |
| Pipeline | Styles move through moodboard, sketch, sample, fit, approval, handoff, per season or drop | Style or SKU | Stage | Season or drop | Styles per stage | Stage board, season calendar, design approvals, sourcing dependencies |

What this means for the goal:

- The core is the goal. A commitment, a locked first date, a visible new date with a reason and
  an update log work the same for every type. Build the core once.
- The types change the view and the extras, not the commitment. Phase one builds the core and one
  type's view, not all four.
- Partner work stretches "every commitment": the partner's side may sit outside Nicobar. See open
  question 11.
- Pipeline work may not fit "a task with a date" at all. A style's commitment may be a stage date.
  It is the least like the others and should not pilot.

Source: "Nicobar Tracker: How Teams Work Differently", Oct 2026. Team and partner names are left
out because the repo is public.

**Pilot team:** `TBD`, chosen with the sponsor. Pick rule: a team that already runs a weekly
review and keeps owners and dates in a Sheet. Proposed: a **Run** team. Its needs (my open and
overdue, a record of pushed dates, reminders) are the goal in section 1 almost word for word, and
it needs no dependencies, stages or outside owners.

**Leadership view:** Stage 3. Both forms named leadership, but that view needs data from many
teams, which one pilot will not give.

---

## 4. Goals and how we will know

The 31 Dec 2026 roll-out-or-stop call is made against these, not on feel. Baselines are taken in
week 0, before the pilot starts.

The first three rows measure the goal in section 1 directly. The rest show whether the tool is
being used.

| Goal | Measure | Baseline (week 0) | Target | By when | Source of data |
|---|---|---|---|---|---|
| Commitments get done or openly renegotiated | Silent slips: tasks past their first date with no new date and reason logged | `TBD` | 0 | 31 Dec 2026 | The status log |
| Renegotiation happens in the open, early | Share of new dates logged before the first date passed | `TBD` | `TBD` | 31 Dec 2026 | The status log |
| No one chases | Status-chasing messages the lead sends before the review | `TBD` | Near 0 | 31 Dec 2026 | Lead self-report, week 0 vs week 6 |
| The review runs from nico-desk | Weeks in a row the lead runs the review from it without being asked | 0 | 6 | 31 Dec 2026 | Weekly check-in with the lead |
| Fewer late tasks | Overdue items per week | `TBD` | Falling over 6 weeks | 31 Dec 2026 | Count in nico-desk |
| Commitments kept | Share of tasks closed on or before the date first given | `TBD` | Rising from baseline | 31 Dec 2026 | The status log (section 5) |
| Blocks surface early | Blocked items raised before the review, not in it | `TBD` | `TBD` | 31 Dec 2026 | Blocked flag timestamps |
| Time saved | Time per person spent tracking actions | ~1 hr/day, `UNVERIFIED` | Halved, `TBD` | 31 Dec 2026 | Self-report, week 0 vs week 6 |
| Pull | The lead would object if it were taken away | n/a | Yes | 31 Dec 2026 | Interview |

**Red flag, stop and rethink:** the lead still opens the Sheets for the review after 3 weeks, or
wrong emails or reminders cause complaints twice.

---

## 5. What people asked for

From the forms, the founder and a business lead. "Proposed phase" is the repo owner's proposal,
not agreed. Field-level rules go in `spec.md`.

| # | Request | From | Proposed phase |
|---|---|---|---|
| 1 | One view of everything pending at my end | founder, forms | Pilot |
| 2 | The week view for the lead's review | forms | Pilot |
| 3 | A second view grouped by status | founder | Pilot |
| 4 | Six statuses: Black (not started), Red (started, not on track), Amber (on track), Green (on track, likely to finish on or ahead of time), Purple (closed ahead), Dark Blue (closed behind) | founder | Pilot. See open question 4 |
| 5 | A due date, once set, is locked | founder | Pilot |
| 6 | When a task goes Red, a new completion date is required and a reason for delay is logged | founder | Pilot |
| 7 | An update log | founder ("let's discuss") | Pilot, shape `TBD` |
| 8 | Ask for support: flag a task stuck on someone else, in its own column, and tag them | business lead | Pilot, tag in-app |
| 9 | Priority set and locked by the leader, never assumed by the app | business lead ("discuss the flow") | Pilot, flow `TBD` |
| 10 | Granola meeting notes drafted into tasks, a person approves | founder, forms | Pilot (gated on access and vendor approval) |
| 11 | Monday email to each person: their tasks, in progress and behind, so they can plan the week | business lead | Pilot, if the pilot team agrees to receive it |
| 12 | End-of-week email, drafted for the admin, listing overdue items for everyone | founder | Pilot, admin reviews and sends |
| 13 | Wispr Flow notes as a source | founder | Later. It is a personal dictation tool, so each person opts in |
| 14 | Scan Google Chat for to-dos and propose them | founder | Later. Needs admin access and everyone's consent |
| 15 | Leadership view across teams | forms | Stage 3 |

---

## 6. Principles: how to decide when this file is silent

1. **The date first given is the truth.** It never changes. A new date sits next to it, with a
   reason. On-time is judged against the first date. Renegotiating is fine. Doing it silently is
   not.
2. **People set the facts, not the app.** Owner, date, priority and status come from a person. The
   app drafts. A person approves.
3. **One place to look.** If someone still has to open a Sheet for the review, the design is wrong.
4. **No double entry.** If the data exists (a Sheet, a Granola note), read it. Do not ask people
   to retype it.
5. **Colour never stands alone.** Every status shows a word next to it.

---

## 7. Constraints

The full list is in `CLAUDE.md` CONSTRAINTS. The ones that shape the product:

- Nothing is sent on anyone's behalf without their yes. Emails are drafted and a person sends
  them, or each recipient has agreed to receive them.
- Read-only on department Sheets and the founder's Supabase unless access is granted for writing.
- No recorder. Meetings are read from Granola. Recording needs everyone's consent first.
- Real meeting text goes to a hosted model only after Nicobar approves that vendor.
- The existing Nicobar UI (`~/Code/Nicobar work`). No new visual language.
- The repo is public. Synthetic data only. No names, credentials or customer data.

---

## 8. Non-goals

- Not a rebuild of the tracker owner's tracker. We read what it produces.
- Not a meeting recorder.
- Not a cross-company dashboard in the pilot.
- No Slack or WhatsApp delivery in the pilot.
- No priority or status set by the app on its own.

---

## 9. Open questions

| # | Question | Who decides | Needed by |
|---|---|---|---|
| 1 | Which team pilots, and which L1 owns the feedback? | the sponsor | `TBD` |
| 2 | Which of the three intent files is kept (this, `docs/INTENT-FABLE.md`, the repo owner's)? | the repo owner | `TBD` |
| 3 | Do the two email requests (Monday per person, Friday overdue) overlap with the tracker owner's emails and 10-day reminders? Replace, add or merge? | the tracker owner, the founder | `TBD` |
| 4 | The six statuses: Amber means "on track" here but "at risk" on the OKR page. Rename, or accept the difference? What status covers a task closed exactly on time, or one not started but already late? | the founder | `TBD` |
| 5 | Locked dates: who can correct a date entered by mistake? Can Amber or Green also revise a date, or only Red? | the founder | `TBD` |
| 6 | Priority: who is "the leader" for a task, and how is priority agreed and locked? | the business lead, the founder | `TBD` |
| 7 | The update log is part of the shared core (section 3). Is it a history of every change, a weekly note per task, or both? | the founder | `TBD` |
| 8 | One backend shared with the OKR page, or separate? | the tracker owner, the OKR backend developer | `TBD` |
| 9 | Who is the Granola admin who makes a workspace key, and is Nicobar on the Business or Enterprise plan? | `TBD` | `TBD` |
| 10 | Single source of truth: once nico-desk exists, where does a task made in a Sheet, a note or a WhatsApp chat live? Do teams stop tracking in Sheets for pilot work, or does nico-desk read them? WhatsApp has no read access for personal chats, so commitments made there must be added by hand or forwarded in. | the sponsor, the pilot lead | `TBD` |
| 11 | Partner work: do we track the partner's tasks too, or only Nicobar's side? If only ours, how is a partner's slip made visible? | the sponsor, the founder | `TBD` |
| 12 | Which team type pilots first (Launch, Run, Partner, Pipeline)? Proposed: Run | the sponsor | `TBD` |

---

## 10. Milestones

| Date | Milestone | Done when |
|---|---|---|
| 7 Oct 2026 (slipped, new date `TBD`) | Concept agreed | Intent kept, open questions 1 to 6 answered |
| `TBD` | Week 0 baseline | Overdue count and on-time rate recorded in section 4 |
| `TBD` Oct 2026 | Pilot live | The pilot team runs its weekly review from nico-desk |
| `TBD` Nov 2026 | More teams | `TBD` teams onboarded |
| 31 Dec 2026 | Decision | Section 4 reviewed, roll out or stop |

---

## 11. Decision log

| Date | Decision | Why | Decided by |
|---|---|---|---|
| 2026-09-30 | Read Granola, build no recorder | Granola already captures the meetings | the repo owner |
| 2026-10-08 | Repo made public | Collaborators | the repo owner |
| 2026-10-08 | Granola read through a workspace key, never a personal key | No one person's credential carries the pipeline | the repo owner |
