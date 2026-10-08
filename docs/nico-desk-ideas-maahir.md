# nico-desk: ideas

A working doc. The idea is to use it as the base for the PRD, so it lists the features I think we need and what we already have for each.

## The idea

One place where a Nicobar team runs its week. Right now tasks sit in department Sheets, decisions sit in meeting notes, and follow-up sits in people's heads. A lead cannot open one page and see every open task, who owns it, and what is late.

Start with one small team, and grow it from what that team asks for.

## Proposed features

**1. The week**

Every open task for the week, per person and per team, with owner, due date and status. A lead runs the weekly review from it.

We have: the OKR page already shows actions with owner, deadline, status and red/amber/green.
Missing: tasks outside OKR forums, and a way to create and assign a task.

**2. Accountability**

Tag a person on a task. See what is overdue and who owns it. See whether a commitment closed by the date it was given.

We have: a tag model and the red/amber/green logic. However, nothing reaches the person yet.
Missing: delivery of a tag, and a record of when a task got its date and when it closed.

**3. Projects and what changed**

Each project with its files, docs and decisions, and what moved since last week and who moved it.

We have: initiatives with a weekly status on the OKR page.
Missing: a project record and a change log. Honestly I do not know yet where the first team keeps its project work.

**4. Meetings in, tasks out**

Meeting minutes come in on their own. The action items become tasks with an owner and a date, linked back to the meeting.

We have: Granola already records meetings and feeds the existing tracker, which handles approval, email and reminders. The OKR page can also generate a pre-read.
Missing: a step that turns approved action items into hub tasks. I would read Granola's output and not build a recorder.

**5. Context and sources**

The hub reads from the company context layer and writes back into it, so there is one copy. Over time it pulls in Google Calendar, and file and code changes for teams that work there.

We have: the context layer is being built, and a design for using Calendar as the schedule and the roster. Neither is connected.
Missing: how the hub reads and writes the layer, and who owns access.

## What we have to build on

- The OKR page: data contract, views, and the Nicobar UI with its tokens and components.
- The pre-read generator and its daily job.
- The tracker output from the Granola to Sheets flow.

## What is missing

- A backend. Reads come from a file and edits stay in the browser.
- Sign-in.
- Tasks and projects as real records.
- Delivery of tags and reminders.

## Rules I want to keep

- Read first. Nothing writes to a department Sheet or an outside database without access granted for it.
- Nothing is sent for a person without their yes.
- No customer data.
- Meetings are only recorded with consent from everyone in them.

## Open points for the PRD

- Which team goes first, and what do they track in today?
- How does the hub read and write the context layer?
- One backend shared with the OKR page, or separate?
- Does the OKR page become a section of the hub?
- In-app tags only, or email as well?
