# Handoff: nico-desk

Written 30 Sep 2026 for the first session in a new repo. Read this first, then the files it
points to. Nothing here is built yet.

## 1. The brief

**What it is.** One place where a Nicobar team runs its week: every task and who owns it, every
project and what changed in it, what was agreed in meetings, and who is behind. It is a project
manager and dashboard built for how Nicobar actually works, not a SaaS the team has to adapt to.

**Who it is for.** First one small team, chosen with Khushi. The tool grows from what that team
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
5. **Context.** Linked to the company context layer that Bharni, Aashi and the TheCRUX AI team
   are building, so the hub reads from it and writes into it rather than holding a second copy.
6. **Breadth.** Pull in as many of Nicobar's sources as possible over time. Each source is added
   only when a pilot team needs it.

**Timeline and gate.**

- By 7 Oct 2026: the concept on paper (this brief sharpened, the data map, the first screens),
  agreed with Khushi.
- Oct to Nov: build with the pilot team, then add a few more teams.
- By 31 Dec 2026: decide. Roll it out to everyone, or stop. The criteria are written down before
  the pilot starts (section 5), so the decision is not made on feel.

## 2. Push-backs before anything is built

- **Meeting minutes may already be solved.** Granola already records meetings and feeds Aashi's
  tracker (Granola to department Sheets to APPROVED to email and reminders). Wispr Flow and
  OpenWispr are dictation tools, not meeting recorders. Default: read Granola's output, do not
  build a recorder. Only build one if Granola cannot cover a meeting type the pilot needs.
- **Do not rebuild the tracker.** Aashi's `nicobar-okr-processor` already does agenda, owner,
  deadline, status, APPROVED-to-email and 10-day reminders. The hub reads what it produces.
- **"As much information as possible" is a direction, not a phase-one scope.** Every source added
  is another sync, another permission and another thing that breaks. Phase one is the sources the
  pilot team uses every week, nothing more.
- **Khushi already has a baseline.** Start from hers and from the OKR page, not from a blank page.
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
| `~/Code/Nicobar work/refs/` (gitignored) | Real inventories: the 8 department trackers, MBR minutes, Granola exports, Raul's Supabase shape. `refs/INVENTORY.md` first. Real data: never copy into a tracked file. |
| `~/Code/Nicobar personal/CLAUDE.md` and `context/nicobar-primer.md` | Who Maahir is, how he works, company facts with sources. Thinking space, not a build repo: do not build there. |
| `~/Code/nicobar-recs/CLAUDE.md` | The product recommendation study. Relevant for how a Nicobar repo is run (constraints, DECISIONS, VERIFY), for the Glood and Shopify connectors, and as one project the hub would track. Not a data source for phase one. |
| `~/Code/nicobar-claude-kit/` | Shared Claude setup for the team: CLAUDE.md template, skills guide, plugins. Use its template for the new repo's CLAUDE.md. |
| `~/Code/thecrux-cowork-masterclass/my-work/ABOUT ME/` | Maahir's own writing and working style notes, including the anti-AI writing guide. |
| `~/Code/personalised-NL/` | Aashi's newsletter repo. Carries real customer PII. Do not read it for this project; nothing here needs it. |

**Not on this machine yet (get before designing)**

- Khushi's baseline: what she has built or sketched, in what tool, and what she thinks it is for.
- The context layer (Bharni, Aashi, TheCRUX): what it is, where it lives, how to read and write
  it (API, MCP server, a shared Drive), and who owns access.
- Raul's scorecard (okr-dashboard-liard.vercel.app, his Supabase): read access, if the hub shows
  metrics.
- Peoplebox: whether the pilot team still lives in it, and whether it exports.

## 4. Sources to integrate, first to last

1. The department OKR trackers and MBR minutes (Google Sheets, Aashi's 7-column format).
2. Granola meeting notes.
3. Google Calendar (the week, who is in which meeting).
4. The context layer.
5. Whatever the pilot team tracks projects in today (ask; do not assume).
6. Code and file changes for project diffs (GitHub, Drive revision history), only for teams that
   work there.
7. Later, only on request: Slack or WhatsApp, Raul's metrics, Peoplebox, Shopify admin data.

## 5. Open questions (answers change the build)

1. Which team pilots, and who in it owns the feedback?
2. Where is Khushi's baseline, and do we merge with it or build beside it?
3. What exactly is the context layer, and can the hub read and write it?
4. Is Granola enough for minutes, or is there a meeting type it misses? If a recorder is needed:
   consent from everyone recorded, where audio is stored, how long it is kept.
5. Where does the hub's own data live? The OKR page has no backend yet; this needs one. Decide
   with Aashi and Sudharshan, who are already scoping the OKR page's backend.
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
- No em dashes in anything written under Maahir's name. No listicle voice, no hype.
- Design from scratch with Maahir. Never offer year0001, cipher.tv, timecapsule or vault
  references. No eyebrow labels above headlines.
- Mobile: the keyboard closes on tap outside, return, or scroll. Audit every flow.

From the Nicobar repos:

- **Nicobar UI rule:** any Nicobar surface uses the UI already designed in `~/Code/Nicobar work`
  (`docs/SHEET-SPEC.md`, the `web/` tokens and components). No new visual language.
- Never write to Raul's Supabase or any department Google Sheet without access granted for that
  purpose. Reads first.
- Real Nicobar data stays out of git, fixtures and artifacts. Use synthetic fixtures, as
  `tools/make_fixture.py` in the OKR repo does. Any exception is Maahir's call, written in
  DECISIONS.
- No customer PII anywhere in this project. It is an internal-team tool; nothing from
  `personalised-NL/`, the Full Moon files or order exports belongs in it.
- The Euclid Flex fonts in the OKR repo have no licence file. Internal use only until checked.
- The repo stays private.

## 7. First session, step by step

1. The folder `~/Code/nico-desk` exists (30 Sep). Create the GitHub repo, private on GitHub under
   `maahirbr`, and fill in the starter `CLAUDE.md`.
2. Read section 3's files. Write a one-page summary of what the OKR page already gives the hub.
3. Meet Khushi. Get her baseline and her list of what the pilot team needs. Record answers to
   section 5 in `docs/BRIEF.md`.
4. Draw the data map: each source, what it gives, who owns access, read or write.
5. Sketch the three first screens (the week, a person, a project) in the Nicobar UI.
6. Agree the concept and the 31 Dec criteria with Khushi and the pilot lead by 7 Oct.
