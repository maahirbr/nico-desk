# Handoff: nico-desk

Written 30 Sep 2026 for the first session in a new repo. Read this first, then the files it
points to. Nothing here is built yet.

## 1. The brief

**What it is.** One place where a Nicobar team runs its week: every task and who owns it, every
project and what changed in it, what was agreed in meetings, and who is behind. It is a project
manager and dashboard built for how Nicobar actually works, not a SaaS the team has to adapt to.

**Who it is for.** First one small team, chosen with the sponsor. The tool grows from what that team
asks for. Then a few more teams. Everyone else only if it earns it.

**What it does, in order of importance:**

1. **The week.** Every open task for the week, per person and per team, with owner, due date and
   status. One view a lead can run a weekly review from.
2. **Accountability.** Tag a person on a task, see what is overdue and who owns it, and a
   red/amber/green on whether a commitment closed by the date it was given.
3. **Projects and what changed.** Each project with its parts (files, docs, decisions) and a diff:
   what moved since last week, who moved it.
4. **Meetings in, tasks out.** Meeting minutes captured automatically, and the action items in
   them turned into tasks with an owner and a date, linked back to the meeting.
5. **Context.** Linked to the company context layer that the context layer lead, the tracker owner and the TheCRUX AI team
   are building, so the hub reads from it and writes into it rather than holding a second copy.
6. **Breadth.** Pull in as many of Nicobar's sources as possible over time. Each source is added
   only when a pilot team needs it.

**Timeline and gate.**

- By 7 Oct 2026: the concept on paper (this brief sharpened, the data map, the first screens),
  agreed with the sponsor.
- Oct to Nov: build with the pilot team, then add a few more teams.
- By 31 Dec 2026: decide. Roll it out to everyone, or stop. The criteria are written down before
  the pilot starts (section 5), so the decision is not made on feel.

## 2. Push-backs before anything is built

- **Meeting minutes may already be solved.** Granola already records meetings and feeds the tracker owner's
  tracker (Granola to department Sheets to APPROVED to email and reminders). Wispr Flow and
  OpenWispr are dictation tools, not meeting recorders. Default: read Granola's output, do not
  build a recorder. Only build one if Granola cannot cover a meeting type the pilot needs.
- **Do not rebuild the tracker.** The tracker owner's `nicobar-okr-processor` already does agenda, owner,
  deadline, status, APPROVED-to-email and 10-day reminders. The hub reads what it produces.
- **"As much information as possible" is a direction, not a phase-one scope.** Every source added
  is another sync, another permission and another thing that breaks. Phase one is the sources the
  pilot team uses every week, nothing more.
- **The sponsor already has a baseline.** Start from hers and from the OKR page, not from a blank page.
  Merge the two ideas before designing anything new.

## 3. Context to read, and where it lives

Read these in order. Each line says what to take from it.

**This machine**

| Where | What to take from it |
|---|---|
| `~/.claude/CLAUDE.md` | Global rules. Binding. Summary in section 6. |
| `~/Code/Nicobar work/CLAUDE.md` | The OKR + action-item page: the closest thing to this hub that exists. Architecture, the data contract (`web/lib/types.ts`), constraints, 1,380 lines of decisions. Read ARCHITECTURE and CONSTRAINTS in full, skim DECISIONS. |
| `~/Code/Nicobar work/docs/VISION.md` | What the OKR page is and why it is not Peoplebox. Five minutes. The strongest argument for this hub already written. |
| `~/Code/Nicobar work/FOR-AASHI.md`, `HANDOFF.md` | What the OKR page needs from a backend, and the three files that touch one. |
| `~/Code/Nicobar work/docs/PREREAD-AUTOMATION-ARCHITECTURE.md` | Google Workspace API probe, calendar as schedule, knowing who has filed, reminders. Reusable for the week view and nudges. |
| `~/Code/Nicobar work/docs/SHEET-SPEC.md` and `web/` | The Nicobar UI already designed. Any Nicobar surface uses it (see section 6). |
| `~/Code/Nicobar work/refs/` (gitignored) | Real inventories: the 8 department trackers, MBR minutes, Granola exports, the founder's Supabase shape. `refs/INVENTORY.md` first. Real data: never copy into a tracked file. |
| `~/Code/Nicobar personal/CLAUDE.md` and `context/nicobar-primer.md` | Who the repo owner is, how he works, company facts with sources. Thinking space, not a build repo: do not build there. |
| `~/Code/nicobar-recs/CLAUDE.md` | The product recommendation study. Relevant for how a Nicobar repo is run (constraints, DECISIONS, VERIFY), for the Glood and Shopify connectors, and as one project the hub would track. Not a data source for phase one. |
| `~/Code/nicobar-claude-kit/` | Shared Claude setup for the team: CLAUDE.md template, skills guide, plugins. Use its template for the new repo's CLAUDE.md. |
| `~/Code/thecrux-cowork-masterclass/my-work/ABOUT ME/` | The repo owner's own writing and working style notes, including the anti-AI writing guide. |
| `~/Code/personalised-NL/` | The tracker owner's newsletter repo. Carries real customer PII. Do not read it for this project; nothing here needs it. |

**Not on this machine yet (get before designing)**

- The sponsor's baseline: what she has built or sketched, in what tool, and what she thinks it is for.
- The context layer (the context layer lead, the tracker owner, TheCRUX): what it is, where it lives, how to read and write
  it (API, MCP server, a shared Drive), and who owns access.
- The founder's scorecard (a private Vercel page, his Supabase): read access, if the hub shows
  metrics.
- Peoplebox: whether the pilot team still lives in it, and whether it exports.

## 4. Sources to integrate, first to last

1. The department OKR trackers and MBR minutes (Google Sheets, the tracker owner's 7-column format).
2. Granola meeting notes.
3. Google Calendar (the week, who is in which meeting).
4. The context layer.
5. Whatever the pilot team tracks projects in today (ask; do not assume).
6. Code and file changes for project diffs (GitHub, Drive revision history), only for teams that
   work there.
7. Later, only on request: Slack or WhatsApp, the founder's metrics, Peoplebox, Shopify admin data.

## 5. Open questions (answers change the build)

1. Which team pilots, and who in it owns the feedback?
2. Where is the sponsor's baseline, and do we merge with it or build beside it?
3. What exactly is the context layer, and can the hub read and write it?
4. Is Granola enough for minutes, or is there a meeting type it misses? If a recorder is needed:
   consent from everyone recorded, where audio is stored, how long it is kept.
5. Where does the hub's own data live? The OKR page has no backend yet; this needs one. Decide
   with the tracker owner and the OKR backend developer, who are already scoping the OKR page's backend.
6. Does the OKR page become part of the hub, or stay separate and get linked?
7. What does "worked" mean by 31 Dec? Proposed, to be agreed: the pilot team runs its weekly
   review from the hub for six straight weeks without being asked; overdue items fall; the lead
   says they would object if it were taken away.
8. Tagging and nudges: in-app only, or email, Slack, WhatsApp? Anything sent on someone's behalf
   needs their yes.

## 6. Rules the new repo inherits

From `~/.claude/CLAUDE.md` (global, binding):

- Create `CLAUDE.md` in the new repo on day one with ARCHITECTURE, CONSTRAINTS, DECISIONS
  (append-only, date, model, why) and VERIFY.
- Opus on the main loop, Sonnet subagents, model always named.
- Ask before commits, pushes, deploys, deletes and config changes to anything running.
- No em dashes in anything written under the repo owner's name. No listicle voice, no hype.
- Design from scratch with the repo owner. Never offer year0001, cipher.tv, timecapsule or vault
  references. No eyebrow labels above headlines.
- Mobile: the keyboard closes on tap outside, return, or scroll. Audit every flow.

From the Nicobar repos:

- **Nicobar UI rule:** any Nicobar surface uses the UI already designed in `~/Code/Nicobar work`
  (`docs/SHEET-SPEC.md`, the `web/` tokens and components). No new visual language.
- Never write to the founder's Supabase or any department Google Sheet without access granted for that
  purpose. Reads first.
- Real Nicobar data stays out of git, fixtures and artifacts. Use synthetic fixtures, as
  `tools/make_fixture.py` in the OKR repo does. Any exception is the repo owner's call, written in
  DECISIONS.
- No customer PII anywhere in this project. It is an internal-team tool; nothing from
  `personalised-NL/`, the Full Moon files or order exports belongs in it.
- The Euclid Flex fonts in the OKR repo have no licence file. Internal use only until checked.
- The repo stays private.

## 7. First session, step by step

1. The folder `~/Code/nico-desk` exists (30 Sep). Create the GitHub repo, private on GitHub under
   `maahirbr`, and fill in the starter `CLAUDE.md`.
2. Read section 3's files. Write a one-page summary of what the OKR page already gives the hub.
3. Meet the sponsor. Get her baseline and her list of what the pilot team needs. Record answers to
   section 5 in `docs/BRIEF.md`.
4. Draw the data map: each source, what it gives, who owns access, read or write.
5. Sketch the three first screens (the week, a person, a project) in the Nicobar UI.
6. Agree the concept and the 31 Dec criteria with the sponsor and the pilot lead by 7 Oct.

## 8. Next session (written 13 Oct, nothing below is built yet)

Work in this order. Each build item is spec only. Source edits still ask first.

### 8.1 Release (waits on the repo owner's `db:upgrade`)

1. The repo owner runs `npm run db:upgrade` on the hosted database, from a network that reaches it.
2. Add to Vercel production: `TYPESAFE_API_KEY` (piped from `web/.env.local`, never printed),
   `NICO_JEV=1`, `NICO_JEV_LIVE=1`, and `NICO_JOB_SECRET` (a new random 32-byte value).
3. Deploy with `vercel --prod` from `web/`. Open `/team` and check a task note gives the status nudge.

### 8.2 Security fixes (from the 13 Oct audit)

The full report is `web/.data/security-audit-13-oct.md`. It is git-ignored and stays local because the
repo is public. Do the High items first, then the Medium items, then the row level security SQL in its
section 4.3. The SQL is a live database change, so it asks first.

### 8.3 Project visibility (new, 13 Oct)

The ask: selected people see only the projects they are assigned to, or were given view rights on.
Admins see everything.

- Open question for the repo owner: does "selected" mean a per-person `restricted` flag (only flagged
  people are limited), or every member who is not a lead or admin? The default proposal is the flag,
  because it changes nothing for the pilot until someone is flagged.
- A project gets a `viewer` role on its membership, next to owner, lead and member.
- A restricted person sees: projects where they hold any role, tasks they own or are named on, and
  nothing else. Leads and admins see all.
- Every read path needs the same filter. The places that leak project names are the risk: search
  (local and Jev), notices, the ledger, Home charts, people pages, "Connects to", reminders and the
  Jev masking dictionary. The full map and plan: `docs/VISIBILITY-PLAN.md`.
- Tests: a restricted person gets a 404 on a project page, an empty search hit, and no project name in
  notices or Home.

### 8.4 The planned batch

1. Real links: every task, project, person and page is a link that opens in a new tab on right click
   or middle click. Filters and sort live in the URL.
2. Workstreams 5 (comments), 6 (Connects to), 7 (sounds), 8 (motion), 9 (local search), as spec'd in
   `docs/PLAN-13-OCT.md`. Build with Sonnet subagents in worktrees.
3. Suggested order is a choice in the sort menu, not the default.
4. The status nudge also shows on the full-page "Add an update" form.

### 8.5 Paste to tasks (WhatsApp and similar)

A box in the add flow where a person pastes copied chat messages, or uploads an exported WhatsApp
`.txt`. The app reads it and proposes changes. Nothing changes until the person approves.

- Input: pasted text, or an exported chat file. Parse each line into sender, date, time and text.
  Handle both the iOS and Android export formats and multi-line messages.
- Masking: everything goes through `lib/redact.ts` before it leaves the server. Add phone numbers,
  including outside numbers that are not on the roster.
- Model: Claude, masked, the same way the minutes-to-proposals flow in `lib/plan.ts` works.
- Output, three kinds:
  1. New tasks: title, owner, due date, project.
  2. Updates to existing tasks: a status, a new due date or a note, matched to a task by title.
  3. A note or comment on a task or project.
- Review screen: show the app's reading of each message next to the proposal ("This message says the
  print run is done, so mark it Done"). Each proposal has approve, edit and skip. Approve goes through
  the normal service rules, one change each, so undo works.
- Evals: about 20 synthetic chats in `evals/paste/`, like `evals/meetings/`, with injection cases
  (a message that tells the model to do something) and a `check.py`.
- Open question: keep the raw pasted text, or drop it after review? Default: drop it.

### 8.6 OpenWhispr and dictation

OpenWhispr types into any text field with a hotkey, so it works today with nothing built.

- Check that every text field takes dictated text well: the drawer title, notes, the add box, the
  update form. Watch for lost text on fast input and for the keyboard rule on phone.
- Add one line to `/guide`: "You can dictate into any box with a dictation app such as OpenWhispr."
- Later options: read OpenWhispr notes through its API (`notes:read`, per-user key, paid plan) and
  feed them to the paste flow, or a mic button in the app.

### 8.7 Other free connections

Granola (read through each note-taker's own MCP sign-in) and Fireflies (API key) are already built.
Research on the free options is in section 8.10 when it lands.

### 8.8 Later

Jev next uses (use cases 2, 10 and 11, then 3 to 8), the thread map (key T), install on phone (PWA),
and team chat. The last two are overnight runs.

### 8.9 Docs for the team

- `docs/ROADMAP.md`: a short README for the team with this roadmap, roles not names, no em dashes.
  Publish it as a private page too.
- `docs/DESIGN-GUIDE.md` (written 13 Oct): a short, plain design guide the PM edits on GitHub. Its section 8 lists the parts of `DESIGN.md` that no longer match the app (it still describes NicoPlain, not the NicoWarm default). Update `DESIGN.md` from that list. `DESIGN.md` stays the
  full source.
