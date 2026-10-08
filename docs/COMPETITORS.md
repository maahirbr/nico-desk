# Competitor and reference tools

Researched 8 Oct 2026 by three Sonnet 5.5 agents. Repo stars and last-push dates were checked on the GitHub API that day. Everything else comes from vendor pages and search results. Items marked **not verified** need a check before anyone relies on them. Prices are list prices and can change.

The five needs are the ones in `INTENT.md`: (1) the week, (2) accountability, (3) projects and what changed, (4) meetings in and tasks out, (5) the company context layer.

## What stands out

- No tool we found turns meeting minutes into tracked tasks natively. Asana and Linear both lean on outside recorders. This is the clearest gap for nico-desk to fill.
- No open-source tool we found checks whether a commitment closed on time. Need 2 is open ground.
- The best ideas to borrow are small. A health value on every update. A visible "missing" state. One named owner per item. A dated update history.
- The biggest risk in adopting any of these is feature sprawl, and the UI. None of them use the Nicobar UI, which our constraints require.

## Linear

Closed, paid, built for engineering teams.

- **Model:** issues, cycles, projects, initiatives. One team owns an issue. [Concepts](https://linear.app/docs/conceptual-model)
- **Updates:** the project lead picks On track, At risk or Off track. Reminders go only to the lead, with nudges one working day later, then two more days. A project shows "Update Missing" after one reminder cycle plus 3 days. [Updates](https://linear.app/docs/initiative-and-project-updates)
- **Pulse:** a feed of project updates, with daily or weekly summaries to the inbox. This is the nearest thing to "what changed". [Pulse](https://linear.app/docs/pulse)
- **Insights and triage AI:** Business plan and above. [Insights](https://linear.app/docs/insights), [Triage](https://linear.app/docs/triage)
- **MCP and API:** hosted MCP server, GraphQL API, webhooks on issues, projects and updates. [MCP](https://linear.app/docs/mcp), [Webhooks](https://linear.app/developers/webhooks)
- **Price:** Free (2 teams, 250 issues). Basic $10 and Business $16 per user per month on yearly billing. [Pricing](https://linear.app/pricing)
- **Not verified:** due-date reminders and overdue alerts, a "what changed since last week" view, meeting notes to tasks, and what "Linear Agent" does in practice.

**Copy:** the health value on every update, reminders to one named owner with an escalating nudge, the "Update Missing" state, a weekly digest, one owner per item.
**Avoid:** engineering words (cycles, estimates), per-team admin work, and paywalled basics.

## Asana

Closed, paid, built for general teams.

- **Model:** tasks in projects, portfolios, goals, workload. "My Tasks" is the per-person home. [Forum](https://forum.asana.com/t/1-tool-more-clarity-less-stress/172517)
- **Status:** On Track, At Risk or Off Track, with past updates kept. Smart status drafts updates with AI. [Smart status](https://help.asana.com/s/article/smart-status)
- **AI:** AI Studio is a no-code builder. AI Teammates were in beta in late 2025. [UC Today](https://www.uctoday.com/project-management/asana-posts-9-revenue-growth-but-is-its-ai-project-management-platform-the-real-story/)
- **Meetings to tasks:** no native feature found. Fireflies can create Asana tasks from action items. [Fireflies guide](https://guide.fireflies.ai/articles/1901313269-how-to-integrate-asana-with-fireflies)
- **MCP:** official server at `mcp.asana.com/v2/mcp`. [Docs](https://developers.asana.com/docs/using-asanas-mcp-server)
- **Price:** Starter $10.99 and Advanced $24.99 per user per month, annual. Portfolios, goals and workload start at Advanced. [Pricing](https://asana.com/pricing)
- **Weak spots:** reviews on G2 and Capterra mention too many features and a steep start. These are anecdotal. [G2](https://g2.com/products/asana/reviews?page=3)
- **Not verified:** overdue reminder rules, and a claim of a "June 2026 skills library".

**Copy:** a per-person My Tasks home, three-state status with a short written update (drafted by machine, confirmed by a person), a portfolio-style roll-up, a dated update history.
**Avoid:** feature sprawl, tiered access, and tasks assigned from AI notes without a person's yes.

## Newer and open-source tools

| Tool | What it is | Needs | Maturity (8 Oct 2026) | Risk |
|---|---|---|---|---|
| [Plane](https://github.com/makeplane/plane) | Open-source Linear alternative: issues, cycles, pages | 1, 3, 5 | 60.5k stars, AGPL-3.0, pushed 7 Oct | AGPL. Will not carry the Nicobar UI without a rebuild. |
| [Plane MCP server](https://github.com/makeplane/plane-mcp-server) | Official MCP: an agent creates and reads issues | 4, 5 | 336 stars, MIT, pushed 7 Oct | Claims of 100+ tools and a hosted endpoint **not verified**. Check self-hosted support. |
| [Huly](https://github.com/hcengineering/platform) | Open-source workspace: issues, docs, chat | 1, 3, 5 | 27.8k stars, EPL-2.0, pushed 7 Oct | Heavy to host. MCP support **not verified**. |
| [Leantime](https://github.com/Leantime/leantime) | PM tool for non-project-managers: goals, milestones | 1, 3 | 11.8k stars, AGPL-3.0, pushed 7 Oct | MCP is a paid beta plugin. |
| [Vikunja](https://github.com/go-vikunja/vikunja) | Light self-hosted tasks with reminders | 1, 2 | 5.6k stars, AGPL-3.0, pushed 7 Oct | No meeting or AI features. Little reporting. |
| [Meetily](https://github.com/Zackriya-Solutions/meetily) | Local meeting recorder and summariser | 4 | 31.5k stars, pushed 15 Sep | Summaries only. Licence **not checked**. A recorder triggers our consent rule. |
| [saga-mcp](https://github.com/spranab/saga-mcp) | Small tracker run as an MCP server (SQLite) | 1, 3 | 38 stars, MIT, pushed 7 Oct | Tiny, one maintainer, built for coding agents. A model for our data layer, not a product. |
| [Morgenruf](https://github.com/morgenruf/morgenruf) | Self-hosted Slack stand-up bot | 2 | 5 stars, MIT, pushed 6 Oct | Brand new. No commitment tracking. |
| Granola MCP | Lets an AI app read Granola notes. [Blog](https://www.granola.ai/blog/granola-mcp) | 4, 5 | Vendor page | Off by default for enterprise accounts. An admin must enable it. |
| Teamwork MCP | Vendor-built MCP for paid Teamwork users. [Post](https://cdn-website.teamwork.com/blog/mcp-server/) | 1 | Vendor page | Closed, paid, general. |

Established tools, one line each, **not re-verified**:

- **Notion:** flexible databases and notes. It could hold tasks and the context layer.
- **Monday.com:** strong dashboards with owner and date columns. Paid per seat.
- **ClickUp:** tasks, docs and an AI notetaker that makes tasks from meetings. Can feel cluttered.
- **Fellow:** meeting agendas with action items tracked across meetings.
- **Geekbot:** Slack stand-ups and weekly check-ins. It records answers, not commitments.

We left out tools we could not confirm exist.

## Small and indie projects

A second pass looked only at solo or tiny-team projects from 2025-26. Repo facts come from the GitHub API on 8 Oct 2026 (stars, created, last push, licence). Product pages were opened to confirm they exist. We found no Hacker News, Reddit or X thread for any of them, because the search tools do not index those sites. Launch dates marked **not verified** were not on the page. These are early projects, so treat all of them as ideas to learn from, not as dependencies.

**Team planning and tasks**

| Tool | What it does | Stars, licence | Needs | Idea to copy |
|---|---|---|---|---|
| [aeman](https://github.com/aenix-io/aeman) | Personal day board plus team board for engineering teams. Git repo is the storage. REST, live stream and MCP in one binary. | 34, Apache-2.0, created Jun 2026 | 1, 3 | Unplanned work gets its own colour, so interruptions show up instead of vanishing. Every action is a commit, so history is free. |
| [taskuary](https://github.com/ldbumble/taskuary) | Personal assistant: mail, chat and tickets become tasks. Runs locally. Nothing goes out until the user approves. | 137, MIT, created Aug 2026 | 1, 4, 5 | The same rule as ours: no send without a yes. Many inputs feed one task list. |
| [markplane](https://github.com/zerowand01/markplane) | Project management as markdown files in the repo, with short summaries for AI and a web UI. | 187, Apache-2.0, created Mar 2026 | 3, 5 | Compress records into cheap summaries an AI can read. Fits the context layer. |
| [pad](https://github.com/PerpetualSoftware/pad) | "Project management for the agent era", with an MCP server. | 186, Apache-2.0, created Mar 2026 | 1, 3 | Not read beyond the description. |
| [Paca](https://github.com/Paca-AI/paca) | AI-native open-source alternative to Jira and Trello, for Scrum teams. | 1,903, Apache-2.0, created Mar 2026 | 1, 3 | Not read beyond the description. Largest of the small tools. |
| [AgentRQ](https://github.com/agentrq/agentrq) | Self-hosted task manager for AI agents over MCP, with scheduling and triggers. | 1.1k, AGPL-3.0 | 1 | Risky actions wait for a person's approval inside the task. A third-party site reports a Show HN around 30 Apr 2026, **not verified**. |

Also found, all agent-first trackers kept as files in git, with MCP: [saga-mcp](https://github.com/spranab/saga-mcp), [agent-tasks](https://github.com/keshrath/agent-tasks), [tkt](https://github.com/smileynet/tkt), [grite](https://github.com/neul-labs/grite), [git-issue](https://github.com/Allra-Fintech/git-issue), [pebbles](https://github.com/Christoph-D/pebbles), [operon](https://github.com/hasanyilmaz/operon), [overclick](https://github.com/ustoppble/overclick), [piyaz](https://github.com/FrkAk/piyaz), [agent-kanban](https://github.com/saltbo/agent-kanban) and [storybloq](https://github.com/Storybloq/storybloq). Two have a licence the API could not name (agent-kanban, storybloq). Most have one to five contributors. One idea stands out: tkt lets a pushed commit be the claim on a task, and a rejected push means someone else got there first.

**Meetings to tasks**

| Tool | What it does | Cost | Idea to copy |
|---|---|---|---|
| [Meetask](https://www.producthunt.com/products/meetask) | Pasted meeting notes become a summary, decisions and tasks with owner, deadline and priority. | Free for 3 meetings a month. Paid tiers not shown. | No bot, no recording, no integrations. It works from notes people already have. This matches our Granola-first plan. |
| [MeetOut](https://hunted.space/product/meetout) | Transcript or audio becomes tasks, a decision log, a follow-up email and the next agenda. | Free for 5 pastes a month. | The output includes the next meeting's agenda. |
| [SitRep](https://webmail.hunted.space/product/sitrep-3) | Meeting bot that finds action items and owners and pushes to Slack, Linear and Notion. | Not shown | Thin signal: 1 upvote. Listed for completeness. |
| [souffle](https://github.com/damione1/souffle) | Private on-device meeting transcription for macOS, with action items. | 27 stars, GPL-3.0 | Local-only audio. A recorder still needs the consent rule. |
| [lark-minutes-tasks](https://github.com/zarazhangrui/lark-minutes-tasks) | Agent skill: reads Lark meeting transcripts and extracts action items. | 67 stars, MIT | One contributor, last push Mar 2026. |

**Accountability and standups**

| Tool | What it does | Cost | Idea to copy |
|---|---|---|---|
| [Commitment Crawler](https://www.commitmentcrawler.com/slack-accountability-bot) | Slack bot that detects promises in conversation and nudges the person who made them. | Free for 10 commitments a month. $9 per month for 1 user. $7 per user for 2 to 20 users. Closed source. | Nudges are private and go only to the committer. Admins see a team digest. It blocks a calendar slot before the deadline. Builder and launch date **not verified**. |
| [Surfboard](https://www.producthunt.com/products/surfboard-2) | Standalone async standup: did, doing, blockers. No Slack needed. | Free for 3 members. Pro $8 per month flat. A $24 tier was in a snippet, **not verified**. | Flat price. States that it does not track activity or log hours. |
| [Pact_OS](https://github.com/TheVicky1/Pact_OS) | Personal app for keeping promises to yourself. | 22 stars, MIT, created Sep 2026 | The server decides whether a promise closed on time, so the record cannot be edited. This is the model for need 2. |
| [Morgenruf](https://github.com/morgenruf/morgenruf) | Self-hosted Slack app: async standups, kudos, insights. | 5 stars, MIT | See the table above. Licence now confirmed as MIT. |

**What changed**

[changelog-bot](https://github.com/nyaomaru/changelog-bot) (26 stars, MIT) and [louisa](https://github.com/arthur-ai/louisa) (6 stars, MIT) write release notes from a tag or commit range. They cover code only. We found no small tool that writes a "what changed this week" summary for a team, and none that is open source for commitments. Both look like open niches.

**Patterns**

1. **No project covers our shape.** Week view, owners, accountability, meetings in and what changed do not appear together. The closest are aeman (team week and day, MCP) and taskuary (many inputs, human approval).
2. **Meeting tools are personal.** Souffle, lark-minutes-tasks, Meetask and MeetOut serve one person. None assign team owners with dates and then track them.
3. **Git or markdown storage plus an MCP server is the trend.** It suits a public repo with synthetic data. It does not suit teammates who do not use git, so a UI over the files would have to carry it.
4. **Accountability is moving away from surveillance.** Private nudges to the committer only, flat pricing, no activity tracking.

Left out: Tickr (cannot confirm it is indie), Sidenote (inactive), Fellow, Geekbot and DailyBot (established), and about 100 template-spam repos that match the meeting keywords.

## What this means for the intent

1. **Build the two gaps.** Meeting action items to tasks (need 4) and "did the commitment close on time" (need 2) have no mature answer. These are the reasons to build.
2. **Borrow, do not invent, the basics.** Health value on every update. "Update Missing". One owner per item. A weekly digest. A dated update history.
3. **Keep the Nicobar UI.** Plane and Huly show a backend can come from outside, but their screens would break our one-visual-language rule.
4. **Add an MCP endpoint to our own data.** Linear, Asana and Plane all have one. It lets Claude read the week.

## Options to decide

- **Build all of it.** Matches `INTENT.md`. Most work.
- **Build on an open-source backend.** Plane plus its MCP could cover needs 1, 3 and 5. We build the Nicobar screens, the Granola step and the accountability check on top. AGPL terms need a read first.
- **Pilot a free tier in parallel.** Run Linear Free or Asana with the same team for 4 weeks and compare adoption. Check Linear's 250-issue cap first. Both agents suggested this.

## Open points

- Does the first team already use any of these? Ask before we compare.
- AGPL: can Nicobar run an AGPL tool internally, and what does it need to publish?
- Who checks the **not verified** items?
