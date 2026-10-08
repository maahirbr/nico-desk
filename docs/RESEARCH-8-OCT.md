# Research, 8 Oct 2026: Granola API, TypeSafe data handling, project objects, sheet sync

Researched on 8 Oct 2026 by a Sonnet 5.5 agent with web search and page fetch. It adds to `COMPETITORS.md` and `AI-AND-TECH.md` and does not repeat them.

Every claim has one tag:

- **verified**: read on an official page. The URL is given.
- **vendor claim**: said by the vendor or a third party, but not proof.
- **not verified**: not found, or the page did not load. Nobody should rely on it.

## Short answer

1. Granola's official API page exists. Base URL is `https://public-api.granola.ai/v1`. Auth is a bearer key. **verified**
2. `AI-AND-TECH.md` says Granola has no webhooks. That is wrong. Webhooks exist on Business and Enterprise. **verified**
3. A workspace key can be made by an admin. It is not tied to one person and does not expire. This fixes the "one person's credential" risk. **verified**
4. Team space notes are visible to the API through the "public notes" scope. Only notes with a summary and a transcript are returned. **verified**
5. Granola data is stored on AWS in the US. There is no EU region. **verified**
6. Granola's official pages say nothing about tools that read the local app data. Its user terms ban reverse engineering. Avoid those tools. **verified**
7. TypeSafe says it will not train on input. It gives no retention period and no data region beyond "hosted in the United States". **verified**
8. We found no SOC 2 claim from TypeSafe. Zero data retention is for enterprise customers, by contacting sales. **verified**
9. Decision: send only synthetic text to TypeSafe until it answers the questions in section 2 in writing.
10. Project management adds four objects over tasks: milestone, dated health update, roll-up above projects, and a timeline. Sheets must stay read-only unless the app owns the record.

## 1. Granola public API

Official pages read:

- Overview and quick start: https://docs.granola.ai/introduction.md
- Integration help page: https://docs.granola.ai/help-center/sharing/integrations/granola-api.md
- Webhooks: https://docs.granola.ai/webhooks.md
- Changelog: https://docs.granola.ai/api-reference/changelog.md
- Get Note: https://docs.granola.ai/api-reference/get-note.md
- List Folders: https://docs.granola.ai/api-reference/list-folders.md
- Page index: https://docs.granola.ai/llms.txt
- Machine-readable spec: https://docs.granola.ai/api-reference/openapi.json (listed in the index, **not read**)

### Facts

| Item | Finding | Tag |
|---|---|---|
| Base URL and version | `https://public-api.granola.ai`, paths under `/v1/` | verified |
| Version history | v1.0.0 Feb 2026. v1.1.0 Apr: folders. v1.2.0 May: new scopes. v1.3.0 Jul: speaker attribution. v1.4.0 Aug: transcript endpoint. v1.5.0 Sep: private notes text. | verified (changelog) |
| Auth | `Authorization: Bearer grn_...` | verified |
| Plan needed | Business or Enterprise. The intro page does not say if other plans can use it. | verified |
| Who can make a key | Any workspace member on Business can make a personal key. On Enterprise, an admin must first allow it under Settings, Workspace, General, "API access for members". | verified |
| Workspace key | Admins on Business and Enterprise make it. It belongs to the workspace, "doesn't expire" and is not tied to anyone's account. | verified |
| Key types and scopes | Personal notes: notes you own, notes shared with you, notes in private folders shared with you. Public notes: notes visible to everyone in the workspace, including the Team space. One personal key can hold both scopes. | verified |
| Workspace key reach | Public notes (unless an admin turns off "Allow public folders") plus spaces with API access on. It cannot read private notes. | verified |
| Team or shared-space notes | Visible through the public scope or a workspace key. A space has an "Allow Granola API access" switch, on by default. Folders inherit it. | verified |
| Notes returned | Only notes with an AI summary and a transcript. Others are left out of lists and give 404. | verified |
| Private notes text | Returned only when the key belongs to the note's creator. Null for shared notes and workspace keys. | verified |
| Rate limit | Burst 25 requests in 5 seconds. Sustained 5 per second (300 per minute). Over the limit gives 429. Limit is per user or per workspace, by key scope. | verified |
| Webhooks | Yes, on Business and Enterprise. Events: `note.generated`, `note.edited`, `note.access_granted`. The payload holds IDs and a timestamp, not note text. | verified |
| Webhook delivery | Standard Webhooks signature headers. Endpoint must answer within 15 seconds. Retries for four days. Missed events are not replayed after that. Dedupe on `event_id`. | verified |
| Notes endpoints | `GET /v1/notes` with a cursor and `hasMore`. `GET /v1/notes/{note_id}` with `?include=transcript`. `folder_id` filter on the list. | verified |
| Transcript endpoint | `GET /v1/notes/{note_id}/transcript`, paginated by cursor. Get Note returns 413 `TRANSCRIPT_TOO_LARGE` when it is too big inline. | verified |
| Folders endpoint | `GET /v1/folders`, `page_size` 1 to 30 (default 10), `parent_folder_id` for nesting. | verified |
| Note fields | Title, owner and attendees (name and email), folder membership, summary as text and markdown, transcript with speaker and times, calendar event, timestamps, web link. | verified |
| Notes list page size | Not read. | not verified |
| Scopes per endpoint | The folders page does not list required scopes. | not verified |
| Sandbox | None. The docs suggest a test folder. | verified |

### What this changes in `AI-AND-TECH.md`

| Earlier statement | Now |
|---|---|
| "No webhooks, so we poll." | Webhooks exist. Polling is still a safe fallback, since missed events are not replayed. |
| "A Business-plan member makes the key, so it is one person's credential." | A workspace key avoids that. An admin makes it. It needs the Business or Enterprise plan. |
| "Granola's own API page was not found." | Found. See the list above. |
| "Whether MCP sees Team-space notes (two sources disagree)." | The official MCP page says Team space notes sit in the public scope for Business and Enterprise. **verified**, https://docs.granola.ai/help-center/sharing/integrations/mcp.md |
| "Rate limits 25 requests per 5 seconds." | Matches the official page. |

One search result claimed the API was Enterprise-only and used `/v0/`. The two official pages I read do not say that. Treat that claim as old. **not verified**

### Granola MCP, for comparison

- No API key or service account for MCP. It needs a browser sign-in. **verified**
- About 100 requests a minute across all tools. Subject to change. **verified**
- Free plan: personal notes from the last 30 days only. **verified**
- Enterprise admins can turn transcripts off for the whole workspace. **verified**

### Third-party tools that read local app data

- Granola's official pages I read say nothing about unofficial tools or the local cache. The integrations page, MCP page and security FAQ are all silent. **verified (absence)**
- The earlier note said "Granola's docs warn about them". I could not find that warning. **not verified**
- The security FAQ says notes are "cached locally" on the device. It also says data is stored on AWS in the United States with no EU or UK region. https://docs.granola.ai/help-center/consent-security-privacy/security-privacy-data-faqs.md **verified**
- The user terms list "decompiles, reverse engineers" among banned acts. They also ban "any other purpose not reasonably intended by Granola". "Services" is defined to include "related APIs provided by Granola". https://docs.granola.ai/help-center/policies/terms-of-service/user-terms-of-service.md **verified** (the clause is not worded as a ban on reading local files, so the fit is our reading)
- Community Granola servers say in their own readmes that they use undocumented APIs and may break the terms. They also copy a local token file. **vendor claim** (from search results, readmes not opened)
- Rule for nico-desk: use only the documented API and the official MCP.

### Granola compliance claims

- The docs index lists a page titled "Our Security Standards (SOC 2 Type 2, encryption, data handling)". I did not open it. **vendor claim**
- A Data Processing Addendum page exists: https://docs.granola.ai/help-center/policies/data-processing-addendum.md **not read**
- Audit API and Legal Holds API exist (Enterprise features, plan **not verified**). They are not needed for the pilot.

## 2. TypeSafe AI (Jev) data handling

Sources read:

- Docs legal page: https://docs.typesafe.ai/legal.md
- Privacy policy: https://typesafe.ai/legal/privacy-policy
- Data Processing Agreement: https://typesafe.ai/legal/data-processing
- Master Customer Agreement: https://typesafe.ai/legal/mca

| Question | Finding | Tag |
|---|---|---|
| Is input used for training? | Privacy policy: "We will not train or fine tune any artificial intelligence or machine learning models on your prompts or other Input." | verified |
| Same in the contract? | MCA section 4.1: no Customer Data in a training set "without your prior consent". Weaker wording than the privacy policy. | verified |
| Other uses of the data | MCA 4.3: TypeSafe may process "Telemetry" (logs, hashes, summary statistics) without restriction, including to improve its products. Telemetry rights can last indefinitely (4.1). | verified |
| Retention period | None given. Privacy policy: kept "as long as reasonably necessary". DPA: kept "as long as necessary taking into account the purpose". | verified |
| Deletion | Privacy policy: deleted on request. The DPA has no deletion or return clause. MCA 10.3: TypeSafe has no duty to keep data and may delete it at any time. | verified |
| Zero data retention | "We also offer zero data retention (ZDR) for enterprise customers." Contact sales. No price or terms shown. | verified |
| Data region | "The Services are hosted in the United States." The DPA names no region. A third-party page says no EU region is documented. | verified (US), vendor claim (no EU) |
| DPA | Yes. A Data Processing Agreement exists. It has EU standard contractual clauses (Irish law) and a UK addendum. Breach notice within 72 hours. Audit once every 12 months at the customer's cost. | verified |
| Subprocessors | The DPA says they are listed at `trust.typesafe.ai/subprocessors`. The page loaded with a title only. I could not read the list. | not verified |
| Security commitments | Privacy policy: "reasonable efforts". MCA: no specific security commitments, and it excludes liability for security failures (9.3, 12.1). | verified |
| SOC 2, ISO 27001 or similar | Not mentioned in the docs, privacy policy, DPA or MCA. A trust center exists at `trust.typesafe.ai`. Its content did not load for me. A third-party page says public docs name no certification. | not verified (no claim found) |
| Enterprise terms | The MCA text has no enterprise tier. A separate written agreement or an order form can override it. ZDR is the only enterprise item named. | verified |
| Law and disputes | California law. Binding individual arbitration (JAMS). Class action waiver. | verified |

### Decision for the plan

- Real meeting text must not go to TypeSafe yet. No retention period, no certification and no subprocessor list are confirmed.
- Synthetic text is fine for tests.
- Questions to send TypeSafe, in writing:
  1. Do you hold a SOC 2 Type II report, and can we see it under NDA?
  2. What is the retention period for API input and output without ZDR?
  3. What does ZDR cost, and does the pilot team qualify?
  4. What is on the subprocessor list, and where do they run?
  5. Does "Telemetry" ever include any part of the input text?
- Nicobar must approve the vendor before any real minutes leave the company, as `AI-AND-TECH.md` already says.

## 3. What project management adds over task management

Only what `COMPETITORS.md` does not cover. That file already has Linear's health value and "Update Missing", and Asana's three-state status.

| Object | Linear | Asana | Plane |
|---|---|---|---|
| Project | Groups issues around one outcome. **verified** | Tasks sit in projects. An overview tab shows description, roles, goals and updates. **vendor claim** (search snippet) | A project holds work items. **verified** |
| Milestone | A stage inside one project, with an optional target date and its own progress. Not shared across projects. **verified** | A task marked as a milestone. It needs a paid plan. **verified** (https://asana.com/inside-asana/new-milestones-visualize-project-progress) | A checkpoint with a target date, linked work items and progress. Pro plan. Off by default. No overdue flag. **verified** |
| Dated project update with health | Updates tab keeps updates in order. It also logs changes to target dates, members and milestones. **verified** (https://linear.app/docs/initiative-and-project-updates) | Status on projects. Value list (on hold, complete, dropped) and a weekly reminder switch are **vendor claim** (search snippet, help page did not load) | On Track, At Risk, Off Track. Each update needs one. Pro plan. Off by default. **verified** |
| Timeline or roadmap | Project graph shows progress and a predicted finish date. No separate roadmap view found on the pages read. **verified** | Portfolio timeline shows dates and milestones across projects. **verified** (https://asana.com/features/goals-reporting/portfolios) | Timeline layout on initiatives, with milestones as dashed lines. **verified** |
| Roll-up above projects | Initiative groups projects. It has a health value from its latest update and a target date. Team-owned initiatives need Business or higher. Saved initiative views need Enterprise. **verified** (https://linear.app/docs/initiatives) | Portfolio groups projects and shows on-track and at-risk status. Advanced plan and above. **verified** | Initiative groups projects. Five states. List, Board, Timeline. Update stream collects project updates. Pro plan. **verified** (https://docs.plane.so/core-concepts/projects/initiatives) |
| Goals | No goals object on the pages read. **not verified** | Goals link to portfolios and projects. **verified** (marketing page) | No goals object found. **not verified** |
| Workload view | Not found. | Portfolio workload shows team bandwidth. **verified** (marketing page) | Not found. |
| Time-boxed group | Cycle, owned by a team and not by a project. **verified** | Not covered. | Module (smaller project groupings) and cycle. **vendor claim** (search snippet) |

Plain reading:

- The four objects that matter are the milestone, the dated update with health, the roll-up, and the timeline.
- Most of them sit behind a paid tier in all three tools.
- A roll-up that shows the health of each project is the part a team lead reads. That is a small build.
- Plane's own docs warn that an overdue milestone is not flagged. A nico-desk milestone should flag itself.

## 4. Sheet as system of record, or app as system of record

### Known failure modes of two-way sync

- **Moved columns.** A sync that maps by column position breaks when someone inserts or reorders a column. Renames do not carry over either. Airtable's own sync docs say so: "Renaming a field in the source doesn't rename it in destination tables." **verified** (https://support.airtable.com/docs/getting-started-with-airtable-sync)
- **Duplicate rows.** A sync with no stable key creates a second row after a retry or a rename. Practitioner knowledge. **not verified** on an official page.
- **Lost edits.** When both sides change one field, the last arrival wins unless a rule says otherwise. Independent one-way jobs can overwrite each other. **vendor claim** (https://www.stacksync.com/blog/the-engineering-challenges-of-bi-directional-sync-why-two-one-way-pipelines-fail, read, written by a sync vendor)
- **Echo loops.** A write is reported back as a change and sent again. Same vendor article. **vendor claim**
- **Tab overwrite.** Some sync tools replace the whole tab on each run, so side edits are lost. **vendor claim** (search snippet from one data tool's help page, not opened)
- **No history.** A synced cell edit carries no reason and often no author. Practitioner knowledge. **not verified**
- **Silent failure.** A broken sync can look fine until someone checks counts. **vendor claim** (search snippet)

### The pattern that avoids them

1. One system of record per record. Never two.
2. The other side is read-only. In Airtable's one-way sync the destination cannot add, delete or edit synced fields. **verified** (same Airtable page)
3. Every record has an origin field, such as `origin = sheet` or `origin = app`, and a stable ID that is not the row number.
4. Read by header name, not column position. Stop and alert when the header row changes.
5. Compare row counts after each sync.
6. Edits to a record go to the system that owns it, and the app logs each edit as an event.

### Fit for nico-desk

- Department sheets stay the system of record for what they hold today. The app reads them, read-only.
- Tasks created in the app are owned by the app. If a team wants them in a sheet, the sheet gets a read-only copy.
- Airtable's two-way edit option is limited to Business and Enterprise Scale plans. That shows that even a vendor treats it as a special case. **verified**
- I found no standard or academic reference for the sheet-and-app case. The advice above is practitioner knowledge, backed by the two sources named.

## Open points

- Who at Nicobar can make a Granola workspace key, and on which plan is the workspace?
- Does the Granola workspace allow public folders and API access on the pilot team's space?
- Can TypeSafe answer the five questions in section 2?
- Someone should read `openapi.json` and the Granola DPA and security-standards pages before any real minutes flow.
