# Note-taker connections: research (13 Oct, not built)

Which meeting note-takers and dictation tools a small team can connect for free or near free. Read
from official docs and pricing pages on 13 Oct 2026. Items marked "unconfirmed" could not be checked
on an official page.

## What is built today

- `web/lib/connectors.ts` has two providers, Granola and Fireflies. Both use one team-wide API key,
  kept in `web/.data/connections.json` (git-ignored) or the env vars `GRANOLA_API_KEY` and
  `FIREFLIES_API_KEY`. A key is checked by listing the last 7 days of meetings before it is kept.
- Granola reads `public-api.granola.ai/v1/notes`. Fireflies reads its GraphQL API and takes
  `summary.action_items`. Every note becomes proposals that a person accepts.
- Saving and removing a key is lead or admin only.

Things to fix before more connections:

1. The code reads Granola through its API with a pasted key. The 8 Oct decision says each note-taker's
   own MCP sign-in. The Granola API needs the Business plan. Record which route is meant in DECISIONS.
2. On Vercel the key file sits in a temp folder and does not survive a cold start. Production keys
   must be env vars.
3. The `connectors.ts` comment and `web/README.md` say Wispr Flow has no API. Wispr Flow now has a
   read-only MCP server for its Notetaker.
4. A Fireflies or Fathom key sees only its owner's meetings, not the team's.
5. Decide whether listing and reading meetings should be lead only.

## The tools

| Tool | Free tier | How an app reads notes | Paid plan for that? | Verdict |
|---|---|---|---|---|
| Fathom | Unlimited recording, transcripts and summaries | REST API with webhooks and SDKs, plus MCP. Per-user key, 60 calls a minute | Unconfirmed | Strong. Same shape as the current connectors |
| Google Meet and Gemini notes | Part of Workspace Business Standard and up | Meet REST API `conferenceRecords` transcripts and `smartNotes`, then the Doc through Drive or Docs | No extra cost. Starter editions have no transcripts | Strong. No new vendor, Google sign-in exists |
| Granola | Basic: 30 days of history | REST API and webhooks. Hosted MCP with per-user browser sign-in | API needs Business. Free MCP reads only personal notes, 30 days | Possible. Built, needs a paid seat or an MCP client |
| Fireflies.ai | Free tier, limits unconfirmed | GraphQL API, webhooks, MCP. Per-user key | API rate limits are listed for Free, so it looks open (unconfirmed) | Possible. Built, but one key sees one person's meetings |
| Wispr Flow | 2,000 dictated words a week. Notetaker with a weekly cap. MCP on every plan | Remote MCP only, read-only: notes, summaries, transcripts, tasks. Browser sign-in, no key | No | Possible, only if the team uses its Notetaker |
| OpenWhispr | Local dictation unlimited. 5 meeting hours a month | API and MCP | Yes, Pro and up | Skip. Dictation works with nothing built |
| tl;dv | Unlimited recording, 10 AI notes in total | REST API and webhooks, `x-api-key` | Yes | Possible, only if someone already pays |
| Otter.ai | 300 minutes a month | MCP with per-user sign-in. Public API is Enterprise only | API yes | Skip |
| Read.ai | 5 transcripts a month | REST API and MCP, both in beta | Unconfirmed | Skip for now |
| Zoom AI Companion | Not on free Zoom | Meetings API summary and recording transcripts | Yes | Skip unless the team pays for Zoom |
| Microsoft Teams | Paid Microsoft 365 | Graph transcripts, tenant admin consent | Licence unclear | Skip. The team uses Google Workspace |
| Krisp | 7-day trial only | MCP, API, webhooks | Yes | Skip. It also had a past MCP incident that crossed users' data |
| Bluedot | 5 meetings in total | Webhooks and MCP on paid plans | Yes | Skip |
| Jamie | 10 notes a month | API, webhooks, MCP | Yes, Pro and up | Skip |
| MacWhisper, Superwhisper | Free tiers | Local files only, no API or MCP | n/a | Skip. Nothing to connect |

Dictation tools (Wispr Flow, OpenWhispr, Superwhisper) already type into any text field. For
dictating into nico-desk, nothing needs to be built (handoff section 8.6).

## Recommended next

1. **Fathom, small.** One more provider branch in `connectors.ts`. First confirm a free account can
   make an API key.
2. **Google Meet and Gemini notes, medium.** Google OAuth with a Meet scope and a Drive or Docs read
   scope (check the Drive scope first). Notes sit in each organiser's Drive, so access is per user.
   Only meetings with notes or transcription turned on have anything to read.
3. **Wispr Flow Notetaker through MCP, medium.** Only if the team uses it. Needs an MCP client with
   per-user OAuth and token storage. If no one uses it, settle the Granola route instead.

## Sources

docs.granola.ai/introduction.md · granola.ai/pricing · docs.fireflies.ai/fundamentals/limits ·
docs.fireflies.ai/getting-started/mcp-configuration · docs.fireflies.ai/graphql-api/webhooks ·
docs.wisprflow.ai (remote MCP server article) · wisprflow.ai/pricing · openwhispr.com/pricing ·
otter.ai/pricing · developers.fathom.ai/api-overview · fathom.ai/pricing · doc.tldv.io ·
read.ai/pricing · developers.google.com/workspace/meet/api/guides/overview ·
support.google.com/a/answer/12076932 · learn.microsoft.com/en-us/graph/api/calltranscript-get ·
krisp.ai/pricing · bluedothq.com/pricing · meetjamie.ai/pricing
