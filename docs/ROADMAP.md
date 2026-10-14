# nico-desk roadmap

nico-desk is one place where a Nicobar team runs its week: tasks and owners, projects and what changed,
and meeting minutes turned into tasks. One small team pilots it first. By 31 Dec 2026 the team decides to
roll it out to everyone or stop, against criteria written before the pilot.

Last updated 13 Oct 2026. The live app is https://nico-desk.vercel.app.

## Built

- **The week.** Home shows your tasks by when they are due. Team shows each person's next work, what is
  late, this week and coming up. Five status words: Not started, In progress, Blocked, Done, Dropped.
  Late, At risk, Ahead and On time are worked out from the dates, never picked.
- **Accountability.** The ledger counts what closed by the first date given. A block names the person
  it waits on, and that person sees it on Home.
- **Projects.** A task board or a plan board with checkpoints and asks. Each project shows what moved
  since last week and who moved it.
- **Meetings in, tasks out.** Anyone pastes minutes, and a lead can read them from Granola or Fireflies.
  The app proposes tasks. Nothing changes until someone approves.
- **People.** Google sign-in, a photo, a phone number and a profile page.
- **Reminders.** A lead's reminder opens as a draft in their own Gmail. The app never sends.
- **Search by meaning.** Search and a status nudge use TypeSafe's Jev model. Names of people and
  projects are masked before anything leaves the app.
- **Who sees what.** An admin can set a person to see only their own projects. A project can list
  extra people who may view it.
- **Help.** A help mode explains every screen, and `/guide` covers the basics.
- **Skins.** Two looks, Warm and Cool, each in Light or Dark. Warm and Light are the default.
- **Real links.** Every task, project and person opens in a new tab on a middle click. Filters live in the URL.
- **Stronger local search.** Typos, filters such as `is:late` and `@name`, and commands in Cmd+K.
- **Paste to tasks.** Paste a WhatsApp chat or upload its export, and the app proposes tasks and updates.
  Nothing changes until the person approves. The read step needs the model key on the server.
- **Fathom.** A lead can read meetings from Fathom, as with Granola and Fireflies.
- **Sounds and motion.** Sounds are off by default. A motion pass covers rows and status changes.
- **Install on phone.** The app installs to a phone home screen. Phone dictation works in every text box, and
  `/guide` says how to use it.
- **Feedback.** Send feedback from the account menu. An admin reads it on one page.
- **More uses for Jev.** A suggested order on Home (a sort option, never the default), a health line on each
  project, a check on drafted tasks, and a suggested project for a new task.
- **Google Meet notes.** A lead can read the notes Google Meet already made, as with Granola. The app records nothing.

## Now (week of 13 Oct)

- Release: the database upgrade, the production secrets and a deploy.
- Google Meet notes go live after the new Google sign-in permission is set up.

## Next (week of 19 Oct, when the second team starts)

- A setup check-list for a new lead.
- A "run the meeting" view that walks the agenda and records action items as it goes.
- A "still needed?" check before a reminder is drafted.

## The pilot rollout (Phase 1)

The pilot's rollout plan moves the company's key recurring meetings and projects into nico-desk, so that
agendas, action items, owners and dates sit in one place. Each project lead and their key people are the
first users. They test it in their real work and give feedback before a wider rollout.

### What goes in

Nine projects and meetings, each set up as one project:

| Kind | Rhythm |
|---|---|
| Quarterly OKR setup, with the senior team | As needed |
| Two product projects | As needed, and fortnightly |
| A quick-commerce partner | As needed |
| Weekly sales meeting | Weekly |
| Weekly ads meeting | Weekly |
| Monthly business review, with the senior team | Monthly |
| Business development meeting | Weekly |
| Retention | Weekly |

### Who does what

- **The project lead** sets up the project, adds members, and runs the meeting's agenda and action
  items in the app. The lead writes the minutes as often as the rhythm needs.
- **Members** update and close their own tasks in the app, not over email or WhatsApp.

### What each use case needs from the app

| Use case | Built | Still needed |
|---|---|---|
| Set up a project and add members | Projects, roles, who sees what | A setup check-list for a new lead |
| Meet on a rhythm | Rhythm and next date per project, an agenda from late, blocked and open items | Nothing for the pilot |
| Run the agenda and action items | Minutes from paste, Granola, Fireflies, Fathom, Google Meet notes | A "run the meeting" view |
| Members update their own tasks | Five status words, Home, install on phone, dictation | Nothing for the pilot |
| No WhatsApp reminders | Reminders open as Gmail drafts, paste a chat to tasks | A "still needed?" check before a nudge |
| No spreadsheets | Task and plan boards, the ledger | An export for the monthly review, if leads ask |
| A senior-team group as members | Members one by one | A saved group to add in one step |
| Collect feedback | Feedback from the account menu, an admin view | Nothing for the pilot |

### How we know it worked

The plan's measure: no spreadsheets or WhatsApp reminders are needed for these projects, and action steps
are tracked and updated in the app. Two numbers in the app show this: the share of tasks updated by their
owner in the app, and the share closed by their first date.

### Still to decide

- The pilot period. (The roadmap's working date: a roll-out-or-stop decision by 31 Dec 2026.)
- How feedback is collected. The in-app feedback box is built and is one answer.

### Phase 2

Refine the setup from the feedback, then extend to other teams and meetings.

## Later

- **An assistant (V2, V3).** Ask the desk a question and get an answer from its own data, for example "has this task been done" or "what is late on this project". It answers only from what the asker can see, and links to the tasks it used. Team chat (people messaging people) was built on 13 Oct and removed for V1, because the team already talks on WhatsApp and Google Chat and V1 should stay simple.
- Saved groups of people, to add as members in one step.
- An export for the monthly review.

## Before the team relies on it

- A security audit of the deployment, and database row level security policies.
- Recording meetings needs consent from everyone recorded, and a stated storage and retention rule,
  before any recorder is built.

