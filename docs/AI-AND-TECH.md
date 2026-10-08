# AI and tech options for nico-desk

Researched 8 Oct 2026 by two Sonnet 5.5 agents, read-only. Stars, last-push dates, licences and versions come from the GitHub API, npm and PyPI on that day. Vendor claims are marked as such. **Not verified** means we could not confirm it. Nothing here is built or decided.

The five needs are the ones in `INTENT.md`: (1) the week, (2) accountability, (3) projects and what changed, (4) meetings in and tasks out, (5) the company context layer.

## The short answer

- **Reading the minutes is a structured-output job.** Use a schema, a model that must follow it, and code that checks the result. The model drafts. A person approves.
- **Code, not the model, must handle names and dates.** Owners come from a roster match. Dates come from the quoted phrase. This is where drafted tasks go wrong.
- **Jev is not the right tool for reading minutes.** It classifies and scores. It does not extract text. It could serve as a second-pass checker, if at all.
- **Pilot stack, if we build:** Granola public API (webhooks plus polling, read-only, workspace key), Postgres with an append-only events table, Google sign-in with a company-domain check, a read-only Sheets adapter, cron for reminders. Each needs an access decision first.
- **Avoid:** local-first sync engines, Granola MCP as the pipeline, community Granola servers that read local app data.

## 1. Jev

### What Jev is (verified)

Jev is a hosted model from TypeSafe AI. It is not a Paca library. Paca calls it over HTTP.

- Paca v0.17.0 adds the integration ([release](https://github.com/Paca-AI/paca/releases/tag/v0.17.0)). The code is a small client in Paca's repo: [client.go](https://github.com/Paca-AI/paca/blob/main/services/api/internal/platform/jev/client.go). It says Jev is the "System One" decision API and that no official Go SDK exists.
- Default endpoint: `https://api.typesafe.ai/v1/systemone`. Default model: `jev-latest`. A project can point to a compatible server instead, such as OpenJev. [Paca README](https://github.com/Paca-AI/paca#readme)
- You send `state` plus typed questions. You get typed answers, not generated text. [Docs](https://docs.typesafe.ai)

| Question type | Returns |
|---|---|
| Choice | The chosen option, a probability per option, and a confidence |
| Score | A rating on an ordered rubric, probabilities, and a confidence |
| Noul (yes or no) | A probability from 0 to 1, with no confidence value |

- It does not generate text, write code or hold a conversation. [Docs](https://docs.typesafe.ai/introduction/coding-agents.md)
- Current model: jev-1.13. Price: $0.042 per million input tokens, output free. Context: 64k tokens. Input is text only. English is where accuracy is best. [Models](https://docs.typesafe.ai/models.md)
- SDKs: `@typesafe-ai/sdk` 0.6.0 on npm (MIT, modified 15 Sep 2026) and `typesafe-sdk` 0.7.2 on PyPI. Secondary sources say minor versions broke the types. **Not verified.**
- Availability: public sources disagree ("coming soon" against early access from 15 Sep 2026). Maahir has used the API in several other projects and reports it works well. That is first-hand and counts as confirmed for planning. Speed and accuracy figures on the vendor site are still **not independently verified.** Nico-desk needs its own test on synthetic meetings.
- No standalone library named Jev found. An npm package `jev` exists at 0.0.0. **Not checked.**

### How Paca makes it safe (from its source)

[task_autofill_consumer.go](https://github.com/Paca-AI/paca/blob/main/services/api/internal/worker/task_autofill_consumer.go)

- An answer applies only above a confidence of 0.6 (yes or no: 0.65).
- A field a person set is never overwritten.
- Any API error means "no answer", and the task stays as it was.
- Only 429 and 529 errors are retried, three times.
- Auto-assign leaves the task unassigned and logs why when Jev is unsure.

These are good rules for any model step in nico-desk.

### Where Jev would and would not fit

TypeSafe's own docs list its weak spots: dates, durations and counting, a lean toward the first option, and steering by text inside the input. [Jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) Its date cookbook has code do the calendar maths and sends anything under 0.60 to a person. It also warns that an assumed year is not reflected in the confidence. [Cookbook](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook.md)

| Job in nico-desk | Jev fit |
|---|---|
| Pull tasks, owners and dates out of minutes | No. It cannot extract free text. |
| Decide "is this line an action item?" for a line the extractor found | Possible, as a second check. Test first. |
| Check "does this quote support this task?" | Possible. A [citation-check cookbook](https://docs.typesafe.ai/cookbooks/citation_check.md) exists. |
| Score a draft: ready to approve, needs owner, needs date | Possible, with a rubric. Code must still enforce the rule. |
| Classify a task into a project or team | Possible, if the options are fixed. |
| Work out due dates | No. Code does this. |

**More use cases to test (Maahir's experience says Jev is strong here).** Each is a classify or score job over text we already hold.

- Triage inbox: score each draft task as ready, needs owner or needs date. Sort the approver's queue.
- Duplicate check: "is this draft the same commitment as an open task?" Stops repeat tasks across weekly meetings.
- Status-update check: "does this comment say the task is done, blocked or still open?" Feeds the on-time ledger. A person confirms the close.
- Risk flag: score a weekly update as on track, at risk or slipping, to help the lead's review. It never sets a red/amber/green value alone.
- Route: assign a task to a project or team from a fixed list.
- Nudge check: "is this reminder still needed?" before a draft nudge goes to its owner for a yes.

Rules from Paca still apply: a confidence floor, no overwrite of human-set fields, an API error means no answer, and a person decides.

**Data flow warning.** Using Jev, or any hosted model, sends meeting text to a third party. Nicobar must approve each vendor before real minutes go to it. In the repo and in tests, only synthetic text goes out. TypeSafe's terms, verified 8 Oct 2026: no training on input, US hosting, a DPA exists, but no retention period and no deletion clause in the DPA (the privacy policy says data is deleted on request), and telemetry may be used for product improvement. Zero retention is an enterprise option via sales. Details and five written questions for the vendor are in `docs/RESEARCH-8-OCT.md`.

## 2. Reading minutes: the structured-output stack

Facts from the GitHub API, npm and PyPI on 8 Oct 2026.

| Tool | Stars | Licence | Version | Use here |
|---|---|---|---|---|
| [Vercel AI SDK](https://github.com/vercel/ai) | 27.2k | Apache-2.0 (npm) | 7.0.133 | Best fit. Same stack as the OKR page. Providers can be swapped. |
| [Zod](https://github.com/colinhacks/zod) | 44.1k | MIT | 4.6.5 | The schema and the validator. No model calls. |
| Claude structured outputs and strict tool use ([docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)) | n/a | n/a | n/a | The model is held to a schema. A subset of JSON Schema. |
| OpenAI `json_schema` with `strict` ([docs](https://developers.openai.com/api/docs/guides/structured-outputs)) | n/a | n/a | n/a | The same job. Can return a refusal or an incomplete result. |
| [BAML](https://github.com/BoundaryML/baml) | 9.4k | Apache-2.0 | 0.226.2 | Its own schema language and a code-generation step. Not needed. Docs **not read.** |
| [Instructor (Python)](https://github.com/567-labs/instructor) | 14.0k | MIT | 1.17.0 | Only if extraction runs as a Python service. |
| [instructor-js](https://github.com/567-labs/instructor-js) | 0.8k | MIT | 1.7.0 | Stale. Last push Jan 2025. Skip. |
| [Pydantic AI](https://github.com/pydantic/pydantic-ai) | 20.5k | MIT | 2.54.0 | Python only. |
| [Mastra](https://github.com/mastra-ai/mastra) | 28.6k | Apache-2.0 on npm. The repo has an `ee/` folder under a separate licence. | 1.75.0 | An agent framework. More than one extraction call needs. Docs **not read.** |
| [TypeChat](https://github.com/microsoft/TypeChat) | 8.7k | MIT | 0.1.4 | Minimal and older. Skip. |
| [promptfoo](https://github.com/promptfoo/promptfoo) | 25.8k | MIT | 0.124.0 | Evals with assertions that run in CI. Docs **not read.** |

Recommended: AI SDK `generateText` with `Output.object`, Zod, Claude strict output, and promptfoo or a plain Vitest suite for evals. In the AI SDK, structured output now goes through `generateText`. Whether `generateObject` is removed is unclear, so do not rely on it. [Docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)

**What a schema cannot do.** Both Claude and OpenAI guarantee the shape of the output. Neither guarantees the values are true. A valid date can still be invented. A valid owner can still be the wrong person. Checks in code must catch both.

### A draft-task design

A sketch, not a spec.

```ts
const DraftTask = z.object({
  meetingId: z.string(),
  title: z.string().min(3),
  ownerCandidates: z.array(z.object({
    rosterId: z.string().nullable(),   // set by code, never by the model
    spokenName: z.string(),
    evidenceQuote: z.string() })),
  dueDate: z.object({
    kind: z.enum(['stated', 'inferred', 'missing']),
    isoDate: z.string().date().nullable(),
    phrase: z.string().nullable() }), // the exact words said, e.g. "by Friday"
  sourceQuote: z.string().min(5),      // must be a substring of the transcript
  critical: z.boolean(),
  confidence: z.number().min(0).max(1),
  status: z.literal('draft'),
});
```

Steps:

1. **Extract.** One model call returns an array of drafts. Pass the meeting date. Tell the model to leave a field empty rather than guess.
2. **Check quotes in code.** Flag any draft whose `sourceQuote` is not an exact substring of the transcript.
3. **Match owners.** Code matches `spokenName` to the roster. No match or several matches leaves `rosterId` empty.
4. **Work out dates in code.** Code turns the phrase into a date. No date words means `missing`. The model's own date maths is thrown away.
5. **Flag.** Mark "needs owner" and "needs date".
6. **Rank.** Critical first, then confidence, then fewest missing fields.
7. **Queue.** Write drafts with `status: draft`.
8. **Approve.** A named person sets any missing owner or date, then approves. Only then does a task exist.

| Guardrail in `INTENT.md` | Where the design holds it |
|---|---|
| No task with no owner | Step 3 accepts roster ids only. Step 8 blocks approval until an owner is set. |
| No made-up number or false green | `kind` is stated, inferred or missing. Steps 2 and 4 need a quote and a phrase. An `inferred` date always shows a warning. |
| A critical point never lost | Drafts are never dropped by code. Step 6 ranks critical first. The eval measures recall. |
| Nothing sent without a yes | The queue is the only output. Nothing is sent, tagged or nudged from this pipeline. |
| Text in notes tries to steer the model | Treat all minutes as data. The model has no tools and can only write drafts. Add injected-instruction cases to the eval. |

### An eval on synthetic meetings

Hand-write 20 or more fictional transcripts, each with a gold list of tasks. No real Nicobar text.

- Owner precision and recall, including cases with an ambiguous name and no owner.
- Date precision and recall against the gold `kind` and date.
- No-invented-date rate: of tasks with no date, the share marked `missing`. Target 100%.
- Critical recall: the share of gold-critical items in the queue. Target 100%.
- Quote validity: the share of drafts with a real substring quote.
- Adversarial cases: an instruction hidden in the notes, a name not on the roster, "next Friday" across a month end.

## 3. Other tools and tech

Facts from `gh api` on 8 Oct 2026. NOASSERTION means GitHub could not read one licence, so read the licence file.

### Data in

| Option | What it gives | Needs | Fit and risk |
|---|---|---|---|
| **Granola public API** ([docs](https://docs.granola.ai/introduction.md), official, verified 8 Oct 2026) | Read-only notes, transcripts, summaries, folders. Base URL `public-api.granola.ai/v1`, bearer key. Needs the Business or Enterprise plan. An admin makes a workspace key that is tied to no person and does not expire. It reads public notes, the Team space and spaces with API access on, never private notes. Only notes that have both a summary and a transcript are returned. Webhooks exist (`note.generated`, `note.edited`, `note.access_granted`), with Standard Webhooks signatures, a 15-second answer window and 4-day retries. Missed events are not replayed, so poll as a fallback. Rate limit: 25 burst per 5 seconds, 5 per second sustained. Data sits on AWS in the US only. | 4 | **High fit.** |
| **Granola hosted MCP** ([docs](https://docs.granola.ai/help-center/sharing/integrations/mcp)) | Six tools, browser sign-in only. Team space notes are in the public scope (verified on the official MCP page). About 100 requests a minute. | 4 | Medium. It cannot run unattended. Good for "draft my tasks from this meeting" in one person's own Claude session. |
| **Sheets API, read-only** ([limits](https://developers.google.com/sheets/api/limits)) | Reads the department Sheets the tracker already fills. 300 reads a minute per project. | 1, 2, 3 | **High fit.** Row data breaks when people move columns. A write path or webhook needs access granted first. |
| [googleworkspace/cli](https://github.com/googleworkspace/cli) | Command line for Sheets, Drive, Calendar. Apache-2.0, 31.3k stars, v0.22.5. | 1, 3 | Dev-time exploration only. Pre-1.0. Whether it is an official Google product was **not checked.** |
| [google_workspace_mcp](https://github.com/taylorwilsdon/google_workspace_mcp) | Community MCP for Gmail, Drive, Sheets, Calendar. MIT, 3.3k stars. | 1, 5 | Sandbox only. Broad scopes. Third-party code. Code **not read.** |

### Store and sync

| Option | Needs | Fit and risk |
|---|---|---|
| **Postgres: [Supabase](https://github.com/supabase/supabase)** (Apache-2.0, 111k stars) or **[Neon](https://github.com/neondatabase/neon)** (Apache-2.0, 23k stars, last push 31 Aug) | 1, 2, 3, 5 | High fit. Our rule says no outside database without access granted, so the pilot needs an account owner first. Pricing **not verified.** Neon branches suit a throwaway test database per change. |
| **Append-only events table** (a pattern) | 2, 3 | High fit. Store every change as a row and derive the state. "Closed on time" and "what changed" both need history. It matches the existing pre-read store. Start with a plain table. Skip libraries ([Emmett](https://github.com/event-driven-io/emmett), [pgmq](https://github.com/pgmq/pgmq)) until needed. |
| [Turso / libSQL](https://github.com/tursodatabase/turso) | 1 | Medium. SQLite-style, MIT. Good for demos and fixtures. Weaker multi-user rules than Postgres. |
| [PGlite](https://github.com/electric-sql/pglite) | tests | Postgres in memory (Apache-2.0, 16.1k stars). Useful for tests on synthetic data. |
| Zero, Electric, Jazz, PowerSync, Evolu | 1, 3 | **Low fit for a pilot.** Each adds a server and conflict rules. Jazz is alpha. Local-first conflict handling works against a clear "who owns this" record. |

### Reminders and notifications

| Option | Fit and risk |
|---|---|
| **Cron plus a query on the events table** | Enough for the pilot. Start here. |
| [Vercel Workflow](https://github.com/vercel/workflow) (Apache-2.0, 2.5k stars, v5.1.0) | A run can wait for days until a person approves. Beta. The docs show two pricing models. Confirm before committing. [Docs](https://vercel.com/docs/workflow) |
| [Inngest](https://github.com/inngest/inngest), [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | The same job on other hosts. Free tiers **not verified.** Choose one only if we leave Vercel. |
| In-app nudge inbox, then email | Store each nudge as a row: draft, approved, sent. Build the email after approval. [Novu](https://github.com/novuhq/novu) is probably too much for five people. [React Email](https://github.com/resend/react-email) (MIT) can build the templates. |

### Sign-in

[Better Auth](https://github.com/better-auth/better-auth) (MIT, 30.2k stars, v1.7.7) with the Google provider and a server-side email-domain check. The `hd` hint is only a hint, so enforce the domain on the server. [Auth.js](https://github.com/nextauthjs/next-auth) is now maintained by the Better Auth team, who recommend Better Auth for new projects ([post](https://www.better-auth.com/blog/authjs-joins-better-auth)). Better Auth wants a database. After sign-in, map the email to a person row: that person is the owner.

### Context layer and agents

- **MCP as the interface to the context layer** ([servers](https://github.com/modelcontextprotocol/servers), [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [FastMCP](https://github.com/PrefectHQ/fastmcp), Apache-2.0). Start with a read tool (search context, list tasks). Make any write tool create drafts only. MCP write tools are where text injected through minutes can do damage, so approval gates are required.
- **Markdown in git as the context layer** ([AGENTS.md](https://github.com/agentsmd/agents.md), MIT). Fit for docs, owners and decisions. Not fit for tasks with due dates, because git has no query or per-person view. In a public repo, content must be synthetic.

### REA (reverse-engineering tool)

REA is [morluto/rea](https://github.com/morluto/rea), "Reverse Engineer Anything". Verified from the GitHub API on 8 Oct 2026: MIT, 17.8k stars, last push 8 Oct 2026. It is an MCP server plus a CLI (`npx rea-agents setup`, Node 22 or newer). It inspects native binaries, JavaScript and Electron apps, .NET assemblies and websites, and runs locally. Static JavaScript analysis needs no extra engine. Native analysis uses Hopper or Ghidra. The `rea` MCP server timed out in the 8 Oct session.

Fit for nico-desk, on public things only:

- Study how Plane, Paca and Linear web UIs behave: screenshots, page structure, network calls, JS bundle shape. This backs the UI/UX section of `TASKUARY-PACA-PLANE.md` with evidence.
- Compare our own build against the Nicobar OKR page for layout and token drift.
- Check a vendor's SDK or web client to confirm real endpoints before we write an adapter.

Limit: do not use it on Granola's desktop app to find private endpoints or bypass its admin controls. That breaks the Granola terms risk we list under Avoid. Use only the documented API. Read each product's terms before inspecting it.

### Research on commitment tracking

We found no 2025-26 paper that tracks owner and deadline across meetings and scores missed follow-ups. That gap is itself a finding. The closest work is [action-item-driven summarisation](https://arxiv.org/html/2312.17581v2) (2023) and a [recap system study](https://arxiv.org/html/2307.15793v3) (CSCW 2024). Many small GitHub "action extractor" repos exist. None looked worth adopting. The practical path is to write the extraction ourselves and score it on our own synthetic set.

## 4. Pilot stack, if we build

| Layer | Pick | Gate before use |
|---|---|---|
| Minutes in | Granola public API, webhooks plus polling, read-only | A workspace key made by an admin on Business or Enterprise. Who holds it, and the revocation rule. |
| Drafting | AI SDK, Zod, Claude strict output | Nicobar approves the model vendor for real minutes. |
| Store | Postgres with an `events` table | An account owner and a data location decision. |
| Sources | Read-only Sheets adapter | Read access granted by the tracker owner. |
| Sign-in | Better Auth, Google, company-domain check | Not needed until a second user. |
| Reminders | Cron plus an in-app nudge inbox | None for in-app. Email needs each person's yes. |
| Context | A small MCP server, drafts only on write | The context layer owner grants access. |
| Evals | Synthetic meetings plus Vitest or promptfoo | None. |

## 5. Avoid

1. **Granola MCP as the pipeline.** It needs a browser sign-in per person and cannot run on a schedule.
2. **Local-first sync engines in the pilot.** A server and conflict rules for five users.
3. **Community Granola servers that read the app's local data or undocumented APIs.** They bypass admin controls. No official warning was found. They use undocumented endpoints and copy a local token file, and Granola's user terms ban reverse engineering.
4. **Letting any model apply a field without a yes.** This is the rule Paca breaks with auto-assign and we must not.

## 6. Not verified

- Jev's accuracy on extraction work. Only vendor claims exist.
- Granola notes-list page size and per-endpoint scopes.
- TypeSafe SOC 2 or any certification. No claim was found.
- BAML, Mastra, Pydantic AI and promptfoo feature details. We used repo and registry data only.
- Supabase and Neon pricing, Inngest and Trigger.dev free tiers, Vercel Workflow pricing.
- Any 2026 AI tool from a small developer beyond those listed.
