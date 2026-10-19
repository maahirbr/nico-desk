# nico-desk

One place where a Nicobar team runs its week: tasks and owners, projects and what changed,
meeting minutes turned into tasks, linked to the company context layer. Piloted with one small
team first. `HANDOFF.md` is the brief and the reading list.

Read before work on `maahir/mvp`: `docs/DESIGN-19-OCT.md` and `docs/PLAN-19-OCT.md` (the next build: its design, then its plan and rules), `docs/PLAN-13-OCT.md` (the 13 Oct batch), then
`docs/HANDOFF-12-OCT.md` (the baseline, the feedback and the UI direction).

## ARCHITECTURE

- `web/`: the app (Next.js 16). `lib/service.ts` holds every rule; pages and `app/api/v1/` both call it.
  `lib/http.ts` `route()` wraps every API call (session, same-origin, rate limit, Zod, View as refusal).
  `lib/schema.ts` is the schema; `lib/db.ts` `upgrade()` brings an existing database up to it.
  `web/README.md` has the file layout, what is built, what is not, and **Hosting**.
- Sign-in: Google OAuth direct to Google (`lib/google.ts`, `app/api/auth/google/`), on when `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set. The roster picker stays behind `NICO_DEV_SIGNIN=1`. Both end in the signed
  `nd_session` cookie and the same `checkSignIn` roster and domain check (`lib/auth.ts`).
- Data: local runs and previews use PGlite seeded from `fixtures/`. Production (https://nico-desk.vercel.app) reads
  Supabase and holds the real pilot, loaded from the git-ignored `web/pilot/`. Real names go only in git-ignored
  `roster.local.json` files, real projects only in `projects.local.json`. Integration keys live only in git-ignored
  `web/.data/connections.json`.
- Projects: a task board, or a plan board (`lib/plan.ts`) with checkpoints, asks and minutes-to-proposals.
- Look: `DESIGN.md` is the visual system and outranks everything visual. Tokens live in `web/app/tokens.css`, one
  `[data-skin]` block per skin, picked in the account menu and kept in the `nd_skin` cookie that `layout.tsx` reads.
  `components/motion.ts` holds motion, `components/KeyboardDismiss.tsx` the mobile keyboard rule,
  `components/keys.ts` the shortcuts, `components/help.ts` the help mode words.
- Docs: `INTENT.md` (hand-written intent), `SPEC.md` (draft requirements, schema, API), `docs/DATA-MODEL.md`,
  `docs/HOW-TEAMS-WORK.md`, `docs/USE-CASES-8-OCT.md`, `docs/DECISIONS.md` (the full decisions log),
  `docs/demo/index.html` (demo run sheet), `docs/team-page/` (team question page).
- `fixtures/`: synthetic people, projects, tasks and events. `events.json` replays to `tasks.json` exactly.
  `denylist.txt` guards against real data. `evals/meetings/`: 20 synthetic transcripts and `check.py`.

## CONSTRAINTS

- nico-desk has its own visual language, designed from the product's needs (decision 2026-10-09).
  The OKR page's sheet language in `~/Code/Nicobar work` is not a reference for it. The rule that
  any Nicobar surface uses that sheet language still holds for the OKR page itself.
- Do not rebuild the tracker owner's tracker (`nicobar-okr-processor`). Read what it produces.
- Never write to the founder's Supabase or any department Google Sheet without access granted for
  that purpose.
- No real Nicobar data in git, fixtures or artifacts; synthetic fixtures only. The company name and
  its public context (team names, kinds of project, product and place words from the public site)
  are allowed in fixtures (decision 2026-10-09). Real people, real dates, real numbers and anything
  from a department sheet or Supabase are not. Any other exception is the repo owner's call,
  recorded in DECISIONS.
- No people's names in repo files. Use roles: the repo owner, the sponsor, the pilot lead, the
  founder, the tracker owner, the context layer lead, the OKR backend developer.
- No customer PII. Nothing from `~/Code/personalised-NL/`, the Full Moon files or order exports.
- Nothing is sent on anyone's behalf (tags, nudges, emails) without their yes.
- Recording meetings needs consent from everyone recorded, and a stated storage and retention rule,
  before any recorder is built.
- The repo is public (decision 2026-10-08, see DECISIONS). So nothing internal beyond what is
  already in it goes in: no real Nicobar data, no credentials, no customer data, no internal URLs
  that are not already public.
- Before the app goes into active use: a security audit of the deployment, and row level security policies that
  tighten the database (since 19 Oct every table has RLS on, the public API roles have no rights and a
  `deny_public_api` policy, and the app reads through the pooler as the owner).
  Raised by a partner teammate on 13 Oct.

## DECISIONS

The full log is `docs/DECISIONS.md`: append-only, one entry per change (date · model · the why · Rollback line).
Add new entries at its bottom, never here. The rules below come from that log and still bind:

- Commits and `CLAUDE.md` edits go ahead without a wait. Push, deploy, live database changes and sends ask first.
- `INTENT.md` takes no model edits unless the teammate who drafted it asks.
- Granola is read through each note-taker's own MCP sign-in, with their yes.
- Task status is one of five words (Not started, In progress, Blocked, Done, Dropped). Ahead, at risk and late are
  flags derived from dates, never picked. On-time is judged against the first due date.
- An admin has every right a lead has (`isLeadOrAdmin` in `lib/roles.ts`). Only a project's owner or lead, a lead
  or an admin brings someone new onto a project.
- View as: every non-GET `/api/v1` call is refused in `route()`. Any write path outside `route()` must call
  `assertNotViewing`.
- Reminders open as drafts in the lead's own Gmail. The app never sends. The cron only writes in-app notices.
- Undo makes a new change through the normal rules, never a delete.
- Every table has RLS on. Every schema change also goes into `upgrade()`, and the hosted database needs
  `npm run db:upgrade` before a build that uses it is promoted. Never run `db:remote` on production without
  `NICO_ROSTER=pilot/roster.local.json`: it drops and reseeds.
- Partner sign-in addresses live only in the env var `NICO_ALLOWED_EMAILS`. A second address for one person goes
  in `people.alt_emails`.
- Two skins, Warm (W) and Cool (M), each in Light or Dark. Warm and Light are the default. Motion uses transform and opacity (the named exceptions are listed under
  DESIGN.md Motion), stays under 300ms except the first-load stagger, and stops under reduced motion.
- Tests pin today to 2026-10-09.

## VERIFY

```
python3 -I evals/meetings/check.py
python3 -I evals/paste/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/
cd web && rm -rf .next && npm run typecheck && npm test && npm run build
```

Expected: `OK: 20 cases`; no grep output (the company name is allowed; real people, emails and
internal hosts are not); typecheck silent; `742 passed`; build green. Then run the app
(`npm run dev --prefix web`, port 3100) and check `/team`, `/me` and a project page at desktop and
375px, day and night. After a deploy, open https://nico-desk.vercel.app/team. Done still means
`docs/BRIEF.md` answers the open questions in `HANDOFF.md` section 5, checked with the sponsor.
