# Intent: nico-desk

What we are building, for whom, and how we will know it worked. One page. Anyone (person or
agent) working on this repo reads this before `HANDOFF.md`. When intent changes, edit this file
and log why in `CLAUDE.md` DECISIONS.

Sources: two use-case forms from the post-workshop sheet (submitted 3 Oct and 5 Oct 2026, both
describing this tool), `HANDOFF.md`, `docs/BRIEF.md`, `docs/nico-desk-ideas-maahir.md`,
`docs/OKR-PAGE-SUMMARY.md`. People are named by role here because the repo is public. Anything
still open is left as `{{ }}`.

- **Owner:** the repo owner
- **Last updated:** 2026-10-08
- **Status:** draft, not yet agreed with the sponsor or a pilot lead

## 1. Problem

Tasks are spread across several Google Sheets. Nothing reminds people, and nobody remembers which
tasks matter most. After a meeting, action items are typed into Sheets or Excel by hand. Sometimes
a note-taking app captures the minutes, but tracking is still manual.

To run a weekly review, a lead opens each tracker and chases people in chat for status. That
chasing is the real process.

The OKR page is the half-built version. It shows actions with owner, date and red/amber/green.
But a task there is a read-only row from a Sheet: you cannot create or assign one, a tag never
reaches the person, and finding out who has not filed means checking by hand.

## 2. Who it is for

- **Pilot team:** {{one team, chosen with the sponsor. Pick rule: already runs a weekly review and keeps owners and dates in a Sheet}}
- **Pilot lead (owns feedback):** {{name, one L1}}
- **Daily user:** each team member: sees their open items, adds comments, closes tasks.
- **Weekly user:** the L1 lead, who runs the weekly review from it and sees where the team needs support.
- **Later:** leadership (the CEO and founder), for a view across teams. Both forms named them, but
  they need data from many teams, which a single pilot will not provide.
- **Not for (yet):** every other department, until the pilot earns it.

## 3. The outcome

The lead opens one page on Monday morning, sees every open task by person and what is overdue,
and runs the weekly review without opening the Sheets.

## 4. Jobs, in priority order

| # | When... | I want to... | So that... | Phase |
|---|---|---|---|---|
| 1 | I start my week | see all my open items in one place, update comments and close tasks | I stop tracking actions across workstreams, meetings and groups | 1 |
| 2 | I run the weekly review | see what my team is working on, what is overdue and who owns it | I can tell where support is needed without chasing people in chat | 1 |
| 3 | a meeting ends | have its action items drafted as tasks with an owner and a date, linked to the meeting | nothing agreed in the room gets lost | 1 (drafts, a person approves) |
| 4 | a task is due or late | have its owner reminded | follow-up does not depend on someone remembering | 1, in-app only |
| 5 | leadership wants the full picture | see every team's open and overdue work in one view | they get an overview without asking each lead | later |

## 5. Non-goals

- Not rebuilding the tracker owner's tracker (`nicobar-okr-processor`). We read what it produces.
- Not building a meeting recorder while Granola covers the pilot's meetings.
- Not a cross-company dashboard in phase one, even though leadership is the eventual audience.
- No email, Slack or WhatsApp delivery in phase one. Wrong reminders clog inboxes (see section 8).

## 6. Sources, phase one

| Source | What it gives us | Read / write | Who grants access | Access granted? |
|---|---|---|---|---|
| Department OKR trackers (Google Sheets) | tasks, owners, dates, status | read | {{name}} | {{yes / no}} |
| Meeting minutes: MBR and the pilot team's other forums | decisions and action items | read | {{name}} | {{yes / no}} |
| Granola notes | minutes, action items | read | {{name}} | {{yes / no}} |
| Google Calendar | the week, who is in which meeting | read | The tracker owner (per `docs/OKR-PAGE-SUMMARY.md`) | {{yes / no}} |
| Context layer | company context | read in phase one, write after the pilot | {{name}} | {{yes / no}} |

Development uses the synthetic fixture from the OKR repo only. A Sheet works for the pilot. To
grow beyond it, the hub needs its own backend that the BI layer can query.

## 7. Success criteria (decided before the pilot starts)

The 31 Dec 2026 roll-out-or-stop call is made against these, not on feel.

| Signal | Measure | Target | How we check |
|---|---|---|---|
| Adoption | weeks in a row the lead runs the weekly review from nico-desk without being asked | 6 | weekly check-in with the lead |
| Accountability | overdue items per week | falling over the 6 weeks, against a week 0 baseline of {{n}} | count in nico-desk |
| Time saved | time each person spends tracking actions across meetings and Sheets | about 1 hour a day saved per person, the form's estimate | {{before/after self-report, week 0 vs week 6}} |
| Pull | the lead would object if it were taken away | yes | interview, {{date}} |

**Stop if:** {{e.g. the lead still opens the Sheets for the review after 3 weeks, or wrong reminders cause complaints}}

## 8. Guardrails

What good looks like: every row is a real task with an owner, a date and a status, linked back to
the meeting it came from. The flow is automated end to end, except where a person approves.

What bad looks like, and must be caught:

- A task with no owner, or the wrong owner pulled from the minutes.
- A made-up number, or a false green that hides a late task.
- A critical point from a meeting that never becomes a task.
- A wrong or repeated reminder, or a nudge sent to someone who never agreed to it.
- A break at any step: reminders, comment updates, or the link back to the meeting.

Cost of being wrong: someone chases the wrong person, a deadline slips, or trust in the tool
drops. The lead usually finds out in the weekly review. It is an internal tool with no customer
data, so the cost is time and trust. That is why the review needs a failsafe that flags rows
with no owner, no date, or a status that changed with no update.

Hard lines:

- It drafts tasks from minutes. A person checks the minutes and approves the tasks before they go live.
- Nothing is sent on anyone's behalf (tags, nudges, emails) without their yes.
- It never writes to a department Sheet or an outside database without access granted for that.
- It never records a meeting without everyone's consent.
- No real Nicobar data or customer PII in this repo. It is public.
- It uses the existing Nicobar UI (`~/Code/Nicobar work`). No new visual language.

## 9. Decision rights

| Decision | Who decides | Who is consulted |
|---|---|---|
| Pilot team and lead | The sponsor | The repo owner |
| Scope of phase one | {{the sponsor / the repo owner}} | pilot lead |
| Adding a new source | {{name}} | pilot lead, the source's owner |
| Where the data lives (backend) | {{name}} | The tracker owner, the OKR backend developer |
| Approving tasks drafted from minutes | the meeting owner | n/a |
| Roll out or stop on 31 Dec | {{name}} | The sponsor, pilot lead |
| Agent may decide alone | code structure, synthetic fixtures, drafts of copy and screens | n/a |

## 10. Milestones

| Date | Milestone | Done when |
|---|---|---|
| 7 Oct 2026 (slipped, new date {{date}}) | Concept agreed | brief, data map and first three screens (the week, a person, a project) signed off by the sponsor |
| {{Oct 2026}} | Pilot live | the pilot team runs its weekly review from nico-desk |
| {{Nov 2026}} | More teams | {{n}} teams onboarded |
| 31 Dec 2026 | Decision | criteria in section 7 reviewed, call made |

## 11. Open questions

- [ ] Which team pilots, and which L1 owns the feedback? · owner the sponsor · needed by {{date}}
- [ ] First user: both forms named leadership (CEO, founder, L1s). Confirm that the pilot is one L1's team and the leadership view comes later · owner the repo owner · needed by {{date}}
- [ ] Which forum minutes does the pilot team hold, and does Granola cover all of them? · owner pilot lead · needed by {{date}}
- [ ] One backend shared with the OKR page, or separate? · owner the tracker owner, the OKR backend developer · needed by {{date}}
- [ ] How does the hub read the context layer, and who grants access? · owner {{name}} · needed by {{date}}
- [ ] Which channel does the pilot team read daily, for when reminders move beyond in-app? · owner pilot lead · needed by {{date}}
