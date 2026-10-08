# Taskuary, Paca and Plane against nico-desk

Researched 8 Oct 2026 by three Sonnet 5.5 agents, one per tool, read-only. Nothing was cloned or run. Repo facts come from the GitHub API on that day. Claims marked **not verified** were not confirmed. Licence readings are ours, not legal advice.

The five needs are the ones in `INTENT.md`: (1) the week, (2) accountability, (3) projects and what changed, (4) meetings in and tasks out, (5) the company context layer.

## One-page answer

- **None of the three can be the base.** Taskuary is single-user. Paca is built for Scrum teams and has one maintainer. Plane needs about 12 containers. All three have their own UI, which breaks the Nicobar UI rule.
- **All three miss the same two things:** a "closed on time" fact per person (need 2) and a drafted-task approval step fed by Granola (need 4). These stay the reasons to build.
- **Each has patterns worth borrowing.** Taskuary: one function decides task state, and approvals are recorded. Paca: one activity table with before and after, and a status category kept apart from the status name. Plane: a triage state for drafted work, and saved views.
- **Plane is the only one worth keeping as a later option.** Its REST API and MCP cover needs 1 and 3. A custom front end that only calls the API is generally treated as a separate program under AGPL.

## Side by side

| | Taskuary | Paca | Plane |
|---|---|---|---|
| Size and age | 137 stars, created Aug 2026 | 1.9k stars, created Mar 2026 | 60.5k stars, company-led |
| Licence | MIT | Apache-2.0 | AGPL-3.0 (MCP server MIT) |
| Built for | One person's inbox and agents | Software teams on Scrum | Engineering and product teams |
| Users | Single user, no accounts | Multi-user, roles, OIDC | Multi-user, roles, SSO (paid) |
| Maintainers | One, about 1,900 commits. Mostly AI-written. | One, about 88% of commits | About 170 contributors |
| Release pace | About 15 releases in 6 days. Breaking changes expected. | 20 releases in about 5 weeks. Pre-1.0. | One release every 2 to 3 weeks |
| Stack | Python, React, SQLite | Go, React, Postgres, Valkey, S3 | Django, React, Postgres, Valkey, RabbitMQ, MinIO |
| To run | One local process | Compose or Helm. Heavy for a pilot. | About 12 services. 2 CPU, 4 GB minimum. |
| API for outsiders | Not verified | REST (no OpenAPI file found), 81-tool MCP | REST, webhooks, SDKs, 30-tool MCP (207 actions) |
| Fits the Nicobar UI | No | No | No (colours only) |

## How each fits the five needs

| Need | Taskuary | Paca | Plane |
|---|---|---|---|
| 1. The week | Partial. Due date and status, no person-owner model. | Partial. Assignees, dates, status. No team-this-week grid. | Strong. Assignees, due date, calendar and table layouts. |
| 2. Accountability | Closest on chasing (asked, watching, nudged fields). No on-time-close fact. | Weak. Overdue is an automation trigger only. | Partial. Overdue is a filter. On-time close must be computed. |
| 3. Projects and what changed | Project table, depth not verified. | Good. One activity table with diff and revert. | Strong on projects. A readable change feed needs building. |
| 4. Meetings in, tasks out | Approval pattern fits. No Granola input. | Absent. No "proposed" state. | No Granola link. Triage state is a good match. |
| 5. Context layer | Docs and memory tables, no shared layer. | Per-project docs only. | Pages and wiki (paid). Not a context layer. |

## Taskuary

[github.com/ldbumble/taskuary](https://github.com/ldbumble/taskuary)

**What it is.** A local assistant that puts mail, chat, trackers and alerts on one timeline. AI sorts each item into a task, a draft reply or FYI. The user's own coding agents do the work. Nothing goes out until the user approves.

**Features.** Timeline sorted into Urgent, On you, For later and FYI. Review queue with a hash-chained audit history. Assistant chat that walks through tasks one card at a time. Agent sessions with a proof-of-work view. A board. Learned lessons stored as files. Scheduled report pipelines. Approvals by Telegram or WhatsApp. Redaction of credentials before text leaves. A demo mode on fictional data. [README](https://github.com/ldbumble/taskuary/blob/main/README.md), [roadmap](https://github.com/ldbumble/taskuary/blob/main/docs/roadmap.md)

**Data model.** SQLite. A task has title, kind, status, priority, assignee (can be an agent), source, tags, due date, remind date, and "asked" fields that track chasing someone for an answer. One server function turns these into a single displayed state (queued, working, blocked, yours, theirs, closed and others), so the list and the board cannot disagree. An approval is its own record: draft, final text, status, who decided, when.

**Vertical integration.**
- Inputs: Outlook, Gmail, Teams, Slack, Telegram, WhatsApp (unofficial bridge), GitHub, trackers, databases, RSS and MCP.
- Each connection has a role: trigger, feed, report or tool.
- Outputs: approved replies go back through the same channel.
- Agents: presets for Claude Code, Codex, Gemini, Cursor and others.
- It is an MCP client. We found no sign it acts as an MCP server. **Not verified.** Webhooks: **not verified.**
- Auth: none by default. An optional token header. The security note says secrets sit as plaintext on disk, but a recent commit says they are sealed, so the note may be stale.

**UI and UX.** A conversational flow: one item at a time, with the original request next to the draft, and Approve and send, Reject or Regenerate. Its look is its own and heavy on AI chat. Front-end code was not read.

**Against nico-desk.**
- It states "local-first, single-user". There are no teams, roles or per-person views.
- Its rules match ours: no real data in the public repo, with invented personas in tests, and approval before anything is sent.
- Do not build on it: one maintainer, mostly AI-written, several releases a day, breaking changes expected.

**Borrow (concepts are free; MIT if code is copied):**
- One derived-state function behind every view.
- An approval record plus an append-only decision log.
- Per-connection roles. "A feed is not a trigger" is a good rule for our sources.
- Tasks that carry asked, watching and nudged state.
- A rule that nothing goes out with a placeholder still in it.
- A demo world of invented people, with a test that fails if real domains appear in fixtures.

**Do not borrow.** Silent learning and "earned autonomy" (we need a yes each time). The unofficial WhatsApp bridge. Its single-user, no-auth assumptions.

## Paca

[github.com/Paca-AI/paca](https://github.com/Paca-AI/paca)

**What it is.** An open-source alternative to Jira and Trello for software teams, with AI agents as project members.

**Features.** Projects, tasks with custom fields, backlog, sprints, a Scrumban board, a Gantt timeline, saved views, comments, an activity feed with diff and one-click revert, a docs editor with version history, a command palette, CSV and Markdown export, personal API keys, OIDC SSO, and a visual automation engine. [ROADMAP.md](https://github.com/Paca-AI/paca/blob/master/ROADMAP.md)

**What "AI-native" means here.** AI agents are members of a project. They get assigned tasks and post to the activity feed. They run in sandboxes or as the team's own coding CLIs. A recent version adds opt-in auto-fill of task fields and auto-assign. The AI is real but aimed at software delivery (pull requests, test specs). We found nothing for meetings, summaries or digests.

**Data model.** Tasks belong to a project and carry type, status, sprint, parent, story points, many assignees, custom fields, start and due dates, and tags. Each project defines its own statuses, and each status has a category (backlog, todo, in progress, done). Permissions are strings checked at the route, with built-in and custom roles. [Schema](https://github.com/Paca-AI/paca/blob/master/docs/architecture/database-schema.md), [authorization](https://github.com/Paca-AI/paca/blob/master/docs/architecture/authorization.md)

**Vertical integration.**
- REST API, documented as a route table. No OpenAPI file found.
- Task list filters cover sprint, status, assignee, type and parent. We found none for due date, overdue or tags.
- 81-tool MCP server with API-key auth.
- Inbound webhooks as automation triggers. Automation triggers include due date reached and cron.
- Generic OIDC for Google, Entra, Okta and Keycloak.
- Not found: any import (Jira, CSV, Sheets), calendar, Slack, or meeting input.

**UI and UX.** Views: board, table, Gantt, plugin views. No calendar or workload view. The look is "High-Contrast Minimalism" with a lime accent and rounded corners. Only the logo and accent colour can change. A re-skin means forking the web app. [Design system](https://github.com/Paca-AI/paca/blob/master/docs/guides/design-system.md)

**Against nico-desk.**
- Sprints, story points, epics and BDD are the wrong words for non-engineering teams.
- As a backend: possible but a poor fit. It adds Go, Postgres, Valkey and S3 for a page that has no backend today. Each team would need its own project, and the API lacks overdue filters.
- Risk: one maintainer for about 88% of commits, pre-1.0.

**Borrow (Apache-2.0 allows code reuse if ever needed):**
- One activity table for every entity, with field, before, after and actor.
- Status category kept apart from the status name. A team keeps its own words and roll-ups still work.
- Permission strings in one place, with a test that every route is gated.
- Per-view config saved as a small JSON.
- Export as CSV plus Markdown.

**Do not borrow.** Scrum vocabulary, sandboxed coding agents, the plugin system, the Docker footprint, and auto-assign that acts without a person's yes.

## Plane

[github.com/makeplane/plane](https://github.com/makeplane/plane), [MCP server](https://github.com/makeplane/plane-mcp-server)

**What it is.** The largest open-source Linear and Jira alternative. Company-led.

**Features by edition** ([pricing](https://plane.so/pricing)).
- **Free (12 users):** projects, work items, cycles, modules, list, board, calendar, table and timeline layouts, in-app intake, pages.
- **Pro ($6 to 8 per user per month):** work item types, custom properties, initiatives, wiki, time tracking, GitHub and Slack integrations, RBAC.
- **Business ($13 to 15):** SSO, one workflow with triggers, recurring items, customers, importers for Confluence and Notion.
- **Enterprise:** LDAP, approval workflows, audit logs via API. Price not listed.
- Self-hosting installs free with 12 seats. A key unlocks paid features. The exact gap between Community and Free is **not verified**.

**Data model.** Work items with state groups (backlog, unstarted, started, completed, cancelled, triage), priority, start and target dates, estimates, assignees, labels, relations, comments and per-item activity. Also cycles, modules, projects, pages, views, intake and notifications. Custom properties and work item types are paid.

**Vertical integration.**
- REST under `/api/v1`, with API keys or OAuth. Limit: 60 requests a minute per key.
- Plane apps (beta): OAuth, webhooks, Node and Python SDKs, agents that answer @mentions. Webhook signing: **not verified.**
- MCP server (MIT): 30 tools covering 207 actions. Hosted with OAuth, or local against a self-hosted instance.
- Plane AI: Ask (read-only), Build (shows a plan to review) and Autopilot (acts without review).
- Importers (Jira, Linear, Asana, CSV, ClickUp, Notion) need Cloud or the Commercial edition.
- Not verified: Slack behaviour, GitHub sync depth, due-date reminders, project health status.

**UI and UX.** Five layouts, saved views, a command palette (Power K), pages and a wiki, and public boards. The custom-theme selector changes colours only. Zero radius and tracked caps would need a fork of the web app. Navigation and the home screen: **not verified.**

**Against nico-desk.**
- Strongest fit for needs 1 and 3. Weak on 2, 4 and 5 as above.
- As a backend under our UI: yes through the REST API. The cost is about 12 containers and a 60-requests-a-minute limit, for a pilot of one small team.
- AGPL: running an unmodified copy internally adds no duty to publish. Modifying it and offering it over a network does. A separate front end that only calls the API is generally treated as a separate program. Do not copy its code into this public repo.
- Verdict from the research: not worth it for the pilot. A later option if the team outgrows a simple store.

**Borrow (ideas only):**
- State groups, which map to the OKR page's `Action` status.
- Triage as the landing state for drafted tasks, with accept or decline.
- Saved views: a filter plus a layout, shared.
- Draft-then-review AI (Build mode) matches our "nothing without a yes" rule.
- One MCP tool per resource with an `action` parameter, which keeps the tool count low.

**Do not borrow.** Cycles, estimates and burndown. Autopilot.

## What nico-desk already has that they do not

- The Nicobar UI and its guards (contrast, lint, hydration checks).
- The pre-read generator, with checked joins and append-only versions.
- Granola notes already flowing into department Sheets, with approval and reminders.
- A rule set tuned to non-engineering teams: no sends without a yes, no customer data, consent before any recording.

## Build ideas, ranked

Five ideas came up in more than one report. Ranked by how many reports raised them and how well they fit the pilot.

1. **Triage inbox for drafted tasks.** Granola output lands as `proposed`. A named person approves, edits or rejects. Only approved tasks reach the week. Record who decided, when and why, in an append-only log. Raised by all three reports.
2. **On-time ledger.** Each task keeps its promised date, closed date and any chase events. The output is ON TIME, LATE or OPEN per person per week, as a colour with a word beside it. Raised by all three. This is need 2 and nobody has it.
3. **One state function, many views.** A single function decides each task's state, so the week and the overdue view cannot disagree. From Taskuary.
4. **Change feed.** One activity table (entity, field, before, after, actor, origin) that powers "what changed this week" per project. From Paca, and it answers need 3.
5. **Saved views.** Named lenses such as my week, overdue and team week, in the Nicobar UI. From Plane and Paca.

Smaller items to keep on the list:
- Status category apart from status name (Paca), so each team keeps its own words.
- Per-source roles on each Sheet or context connection: feed, trigger-to-draft, write (Taskuary).
- A permission-string file with a test that every route is gated, ready for when sign-in arrives (Paca).
- A synthetic demo world and a test that fails if real domains appear in fixtures (Taskuary).
- An optional read-only Plane adapter later, so a team already on Plane can show up in nico-desk.

## Open points

- Does the pilot team's work look like a week of tasks, or more like projects? That decides if the week view or the change feed ships first.
- Where does the task store live? A Sheet works for the pilot. A real store is needed to compute the ledger and the change feed.
- AGPL: a lawyer's read before any decision to run Plane inside Nicobar.
- Which unverified items matter enough to check: Taskuary webhooks and MCP server mode, Paca email notifications, Plane reminders and project health.
