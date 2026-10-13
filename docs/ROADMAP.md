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
- **Skins.** Several looks, with System, Light or Dark.

## Now (week of 13 Oct)

- Release: the database upgrade, the production secrets and a deploy.
- Comments on tasks and projects, with `@person` and `#task` links.
- Real links: every task, project and person opens in a new tab on a middle click. Filters live in the URL.
- Sounds, off by default.
- The status nudge on the full update form.

## Next (week of 19 Oct, when the second team starts)

- "Connects to" on every task, project and person: what it is part of, waits on and is mentioned in.
- Stronger local search: typos, filters such as `is:late` and `@name`, and commands in Cmd+K.
- A motion pass.
- Paste to tasks: paste a WhatsApp chat or upload its export, and the app proposes tasks and updates.
  Nothing changes until the person approves.
- More note-takers: Fathom first, then Google Meet notes.

## Later

- More uses for Jev: a suggested order (a sort option, never the default) and project health.
- The thread map, a graph of how items connect.
- Install on phone.
- Team chat.

## Before the team relies on it

- A security audit of the deployment, and database row level security policies.
- Recording meetings needs consent from everyone recorded, and a stated storage and retention rule,
  before any recorder is built.

