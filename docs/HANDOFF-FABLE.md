# Master handoff for the Fable planning session

Written 8 Oct 2026. Read this file first. It points to everything else. Nothing here is built or decided unless a section says so.

## 1. Your job

Plan the research and the next steps for nico-desk. Do these four things, in this order:

1. **Plan the research.** Decide which open questions to answer first, who or what answers each, and what a good answer looks like.
2. **Write `docs/INTENT-FABLE.md`.** Do not edit `INTENT.md`. The teammate who wrote it wants intent files written by hand, not by a model. So `INTENT.md` stays as it is. Write a second, independent intent file from the findings below. Maahir writes a third one by hand. The team compares them. Keep the same section structure as `INTENT.md` so they compare side by side. Do not invent facts for blanks. Write `{{ }}` where a value is unknown.
3. **Build an HTML page for the team** that shows the ideas worth sharing (section 6). Use the Nicobar UI only.
4. **Give Maahir a recommendation**, not a survey. Name the first build slice and what blocks it.

Maahir decided that the HTML page, the `docs/INTENT-FABLE.md` file and the deep thinking happen in this session, not before.

## 2. How to work

- Delegate every codebase read, file search and edit to Sonnet subagents. Set `model: "sonnet"` each time. Run at most 3 at once. Keep only their summaries and your own judgement. Peek at single files under about 50 lines yourself.
- Do not start a multi-agent workflow unless Maahir asks for it by name.
- Ask Maahir before any commit, push, config change or edit to `CLAUDE.md`. State the exact change first.
- Write plain text. One instruction per sentence, 20 words at most. No em dashes. No people's names in repo files, because the repo is public. Use roles.
- Mark each claim as verified, vendor claim or not verified.

## 3. What nico-desk is

One place where a Nicobar team runs its week. Five needs:

1. The week: open tasks per person and team, with owner, date, status.
2. Accountability: overdue items, and whether a commitment closed on time.
3. Projects and what changed.
4. Meetings in, tasks out: Granola minutes drafted into tasks, a person approves.
5. A link to the company context layer.

Pilot with one small team first. Roll-out or stop call on 31 Dec 2026.

## 4. Read these files (all in this repo)

| File | What it holds |
|---|---|
| `CLAUDE.md` | Constraints and decisions. Binding. |
| `INTENT.md` | A teammate's hand-written draft. Do not edit it. |
| `docs/INTENT-FABLE.md` | The model-written intent file. One of three. Compare, keep one. |
| `HANDOFF.md` | The first brief and reading list. Line 78 holds an internal URL, still undecided. |
| `docs/BRIEF.md` | Answers to the eight open questions. First three screens: the week, a person, a project. |
| `docs/OKR-PAGE-SUMMARY.md` | What the existing OKR page has, lacks and can lend. |
| `docs/nico-desk-ideas-maahir.md` | Maahir's five features and rules. |
| `docs/COMPETITORS.md` | Linear, Asana, newer tools, small indie projects, patterns, three options. |
| `docs/TASKUARY-PACA-PLANE.md` | Three open-source tools compared with nico-desk. Ranked build ideas. |
| `docs/AI-AND-TECH.md` | Jev, the structured-output stack, the draft-task design, the eval plan, other tech, avoid list, unverified items. |
| `docs/RESEARCH-8-OCT.md` | Granola API facts, TypeSafe terms, project objects, sheet versus app as system of record. All claims tagged. |
| `docs/RESEARCH-PLAN.md` | The ordered research plan, owners, done-when, and the first-slice recommendation. |

Outside this repo: `~/Code/Nicobar work` holds the OKR page. Read `docs/SHEET-SPEC.md` and `web/app/globals.css` there for the UI. The UI tokens are in section 6.

## 5. Findings to carry forward

**Competitors.** None of Plane, Paca or Taskuary can be the base. All three lack a "closed on time" fact and a Granola-fed approval step. Linear and Asana do not turn meetings into tasks natively.

**Two gaps to build.**
1. A triage inbox for drafted tasks: a proposed state, a named approver, an append-only decision log.
2. An on-time ledger: ON TIME, LATE or OPEN per person per week, shown with colour and a word.

**Other ideas, ranked.** One state function with many views. A change feed from one activity table (entity, field, before, after, actor, origin). Saved views. A status category apart from the status name. Per-source roles. A permission file with a route-gating test. A synthetic demo world, with a test that fails on real domains. A read-only Plane adapter, later and optional.

**AI drafting.** Use a schema-bound model call (Vercel AI SDK, Zod, strict output). Code, not the model, matches owners to the roster and works out dates. Every draft needs a quote that appears in the transcript. A person approves. Evaluate on synthetic meetings. See `docs/AI-AND-TECH.md` section 2.

**Jev.** A hosted classifier from TypeSafe AI. It scores and classifies. It does not extract text. Maahir has used it in other projects and says it works well. Candidate uses: triage score, duplicate check, status-update check, risk flag, routing, nudge check. Test each on synthetic data. Real minutes go to any hosted model only after Nicobar approves the vendor.

**REA.** The repo is `morluto/rea`, "Reverse Engineer Anything" (verified from the GitHub API on 8 Oct 2026: MIT, 17.8k stars, last push 8 Oct 2026). It is an MCP server plus a CLI, installed with `npx rea-agents setup`, Node 22 or newer. It inspects native binaries, JavaScript and Electron apps, .NET assemblies and websites, locally. Static JavaScript analysis needs no extra engine. Native analysis uses Hopper or Ghidra. The `rea` MCP server timed out in the 8 Oct session, so check it connects before a session plans to use it. Use it on public web UIs to back the UI/UX comparison. Do not use it to find private Granola endpoints.

**Pilot stack, if we build.** Granola public API (webhooks plus polling, read-only, workspace key). Postgres with an append-only events table. Google sign-in with a server-side domain check. Read-only Sheets adapter. Cron plus an in-app nudge inbox. Each needs an access decision first.

**Avoid.** Granola MCP as the pipeline. Local-first sync engines in the pilot. Community Granola tools that read local app data or undocumented endpoints. Any model that applies a field with no human yes.

## 6. The HTML page

Audience: the pilot team and leads. Job: show the ideas worth sharing and let people react.

- Content: the five needs, the two gaps, three or four screens as simple synthetic mocks (the week, a person, a project, the triage inbox), the AI drafting flow in one diagram, and the questions we need answered.
- Synthetic data only. No real names, tasks or Nicobar data. The repo is public.
- Use the Nicobar UI. Tokens:
  - Day: desk `#d8cfba`, sheet `#f2ecdc`, ink `#1a1712`. Night: desk `#100f0d`, sheet `#22201a`, ink `#ece5d5`.
  - Department inks: Digital `#2d41e2`, Brand `#a530c3`, Retail `#ba430b`, Retention `#c42e4c`. Night: `#808dff`, `#d377ea`, `#f38e4c`, `#f4738c`.
  - Status: red `#b03a00`, amber `#8f6200`, green `#00705a`. Night: `#ff6f3b`, `#ffae16`, `#1acd9e`. Always show a word next to the colour.
  - Zero radius. Actions are tracked caps, underlined, no fill. Choices are form rows. Depth is paper plus shadow, never border or radius.
  - Fonts: Euclid Flex has no licence file, so use Geist and Geist Mono from Google Fonts on a shared page. Labels are Geist Mono 11px, 0.16em, uppercase.
- No typographic eyebrows. Design from the product's own needs. Do not copy other products' looks.
- Works at phone width. If any input exists, the keyboard must close on tap outside, on return and on scroll.
- Publish as a private Artifact and give Maahir the link. Do not share it further without his yes.

## 7. The `docs/INTENT-FABLE.md` file

A new file. Same sections as `INTENT.md`. Shorter and clearer than `INTENT.md`, because the teammate's complaint was that it is not clear. Content to carry in:

- Section 5, non-goals: not adopting Plane, Paca or Taskuary as the base. Not letting a model apply a field without a yes.
- Section 6, sources: name the Granola public API as the phase-one meeting source, pending who holds the key. Name the read-only Sheets adapter.
- Section 7, success criteria: add the on-time rate from the ledger.
- Section 8, guardrails: add the draft rules (quote required, roster match and dates in code, `missing` is allowed, injected text in minutes is data).
- Section 11, open questions: backend and account owner, sign-in, AGPL review before running Plane, hosted-model approval, the first-user conflict (the `INTENT.md` pilot team against Maahir's earlier answer that named two leaders first).
- Use `{{ }}` for any value nobody has given.

After the edit, propose a `CLAUDE.md` DECISIONS line (date, model, why). Wait for his yes before writing it.

## 8. Research plan to produce

Order the questions below, then give each an owner, a method and a done-when. A suggested order:

1. **Pilot team and first user.** Needs a decision from Maahir and Khushi. Blocks everything.
2. **Granola access.** Verified 8 Oct: the API needs Business or Enterprise, and an admin makes a workspace key tied to no person. Open: which plan the company is on, who the admin is, whether the pilot's meetings sit in the Team space or a space with API access on, and the revocation rule. See `docs/RESEARCH-8-OCT.md`.
3. **Where the data lives.** Who owns a Postgres account? Shared with the OKR page or separate? Sheet-only for the pilot?
4. **Model vendor approval** for real minutes, including Jev's data handling and retention terms. TypeSafe's terms are summarised in `docs/RESEARCH-8-OCT.md` with five questions to send in writing.
5. **Draft quality.** Build 20 or more synthetic meetings and score owner, date, critical recall and injection cases. Include a Jev verifier arm.
6. **Sheets read adapter.** Which Sheets, who grants read access, how stable are the columns.
7. **Plane licence.** AGPL read by a lawyer before any internal run.
8. **Week 0 baseline.** Count overdue items now so success has a start.

## 9. Not verified

- Jev accuracy on our work. Vendor claims only.
- Granola notes-list page size and per-endpoint scopes. TypeSafe certifications.
- Details of BAML, Mastra, Pydantic AI and promptfoo.
- Supabase, Neon, Inngest, Trigger.dev and Vercel Workflow pricing.
- Whether `googleworkspace/cli` is an official Google product.

## 10. State of the repo

- Committed: everything up to `ac51271`.
- Uncommitted: `docs/AI-AND-TECH.md`, `docs/TASKUARY-PACA-PLANE.md`, `docs/RESEARCH-8-OCT.md`, `docs/RESEARCH-PLAN.md`, `docs/INTENT-FABLE.md`, `docs/team-page/index.html`, this file. Maahir has not yet said to commit them.
- Done in the 8 Oct session: `docs/INTENT-FABLE.md`, the research, the plan, and the HTML page (published as a private Artifact).

## 11. New input, 8 Oct

Team chat, 8 Oct, after `INTENT.md` was committed.

1. **Intent files are written by hand.** The teammate who committed `INTENT.md` finds it unclear and calls it a poor model-written document. Decision: no model edits `INTENT.md`. Two more intent files get written, one by a model in this session and one by Maahir by hand. The team compares all three.
2. **Project tool or task tool.** The same teammate expected a project management tool. The research docs describe a task tool: the week view, the on-time ledger, the triage inbox. Need 3 (projects and what changed) covers projects only lightly. This is now open question 1, next to the pilot team. It blocks the first build slice.
3. **The founder's notes.** The founder shared a private document with notes on features and use cases. Nobody in this repo has read it yet. Its URL stays out of the repo. Get the text from Maahir before writing `docs/INTENT-FABLE.md`.
4. **Three questions from the teammate**, with proposed answers from the research. Proposed, not decided.
   - Does this work with the OKR skill and page, or is it an independent web app? Proposed: an independent web app for the pilot, on the same UI and the same data contract (`web/lib/types.ts` in the OKR repo), so it can merge later. Matches `docs/BRIEF.md` section 6. The pilot does not wait for the OKR backend.
   - Does it work with the existing Sheets, or are tasks created inside it? Proposed: both. People create tasks in the app, because today nobody can create or assign a task. The app reads the existing Sheets, read-only.
   - What is the system of record for tasks? Proposed: each task has exactly one system of record, stored on the task as its origin. For the pilot team the app is the system of record, because the on-time ledger and the change feed need an append-only history that a Sheet cannot give. Other teams' Sheets stay their own source of truth. Never write the same task in two places.
