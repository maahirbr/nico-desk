# BRIEF: answers to the open questions

Draft 5 Oct 2026, for the meeting with Khushi. Concept is due 7 Oct. "Proposed" means my default, not agreed. "Ask" means only Khushi or the pilot lead can answer. Source for each "Known" line: `HANDOFF.md`, `docs/OKR-PAGE-SUMMARY.md`.

## 1. Which team pilots, and who owns the feedback?

- Known: chosen with Khushi. Not named in any file.
- Ask: which team, and which person in it gives feedback each week.
- Proposed pick rule: a team that already runs a weekly review and already has owners and dates in a Sheet. The hub then replaces effort, not adds it.

## 2. Where is Khushi's baseline? Merge or build beside it?

- Known: nothing about it is on this machine.
- Ask: what she built or sketched, in what tool, and what she thinks it is for. Ask for a screenshot or a link.
- Proposed: merge. Start from her baseline and the OKR page. Build beside it only if her tool cannot take tasks, owners and dates.

## 3. What is the context layer? Can the hub read and write it?

- Known: Bharni, Aashi and the TheCRUX AI team are building it. Where it lives and how to reach it are not known.
- Ask: API, MCP server or shared Drive. Who owns access.
- Proposed: read only in phase one. Write after the pilot proves the data is clean.

## 4. Is Granola enough for minutes?

- Known: Granola already feeds Aashi's tracker (Granola to department Sheets to APPROVED to email and reminders).
- Ask: which meeting types does the pilot team hold that Granola misses (in person, calls on a phone, no laptop).
- Proposed: read Granola output. Build no recorder. If one is needed later, it needs consent from everyone recorded, a storage place and a retention time, written down first.

## 5. Where does the hub's own data live?

- Known: the OKR page has no backend. Reads come from a JSON file. Writes stay in the browser. Only the pre-read store persists, in Postgres or a local file.
- Known: Aashi and Sudharshan are scoping a backend for the OKR page.
- Ask: one shared backend for both, or separate.
- Proposed: one shared backend, decided with Aashi and Sudharshan. New task and project tables follow the append-only pattern in `preread/store.ts`. Real data stays out of git.

## 6. Does the OKR page become part of the hub?

- Known: the OKR page has no tasks, projects or notifications. The hub has no OKR views.
- Proposed: the OKR page becomes one section of the hub. They share the data contract (`web/lib/types.ts`) and the UI. This avoids two products with two sign-ins.
- Ask: Khushi and Aashi agree.

## 7. What does "worked" mean by 31 Dec?

Proposed criteria, to agree before the pilot starts:

1. The pilot team runs its weekly review from the hub for six straight weeks without being asked.
2. Overdue items fall over those six weeks.
3. The lead says they would object if the hub were taken away.

- Ask: Khushi and the pilot lead agree on the wording and on the baseline number of overdue items, taken in week 0.

## 8. Tagging and nudges: in-app or outside?

- Known: nothing sends today. Tags in the OKR page are never delivered. Anything sent for a person needs that person's yes.
- Proposed: in-app only in phase one. Email after the pilot lead asks. Slack and WhatsApp only on request.
- Ask: which channel the pilot team reads every day.

## What a first meeting must settle

1. Pilot team and feedback owner (question 1).
2. A copy or link of Khushi's baseline (question 2).
3. Who gives access to the context layer, and the date (question 3).
4. The 31 Dec criteria (question 7).

## First three screens (for the 7 Oct concept)

Built in the Nicobar UI (`docs/SHEET-SPEC.md`). No new visual language.

- The week: open tasks per person and per team, with owner, due date and status.
- A person: their tasks, what is overdue, what they committed to and whether it closed on time.
- A project: its parts, and what moved since last week and who moved it.
