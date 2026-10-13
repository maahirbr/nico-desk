# Plan: the 13 Oct feature batch

Status: approved by the repo owner (13 Oct). Workstreams 1 to 4 started 13 Oct.
Work happens on `maahir/mvp`, one worktree per workstream, Sonnet agents, merged in the order below.
Read `docs/HANDOFF-12-OCT.md` and `CLAUDE.md` CONSTRAINTS first. The repo is public.

Dates that shape the order: first review Wed 14 Oct, second team starts Mon 19 Oct.

## Decisions taken (Q&A, 13 Oct)

- Profile pictures: the Google sign-in photo by default. A person can upload their own to replace it, and add their phone.
- Threads mean two things, and both are wanted:
  1. The "threads" linkage from the OKR dashboard: typed links worked out from data the app already holds, shown as
     "Connects to" on every item. The concept is ported. Its look is not, since nico-desk has its own visual language.
  2. Comments on tasks and projects, with `@person` and `#task` / `#project` links.
- Jev (TypeSafe): plan it and build it against the synthetic fixtures only. It goes live on real pilot data only after
  the sponsor says yes, recorded in DECISIONS. Until then, search gets stronger with local methods only.
- Chat is a later phase. Comments use tables that chat can reuse.

## Defaults taken (say if any is wrong)

- One appearance setting, System / Light / Dark, applies to every skin. It is not stored per skin.
- Sounds start off. The person turns them on in the account menu.
- Phone numbers are visible to everyone signed in on the same team. Phone is optional.
- The thread map (a full graph view, key `T`) comes after the "Connects to" lists, not with them.
- People edit and delete their own comments. A deleted comment leaves "Comment removed" so the thread still reads.

## Order and why

Small, visible fixes first, so the 14 Oct review and the 19 Oct team see them. Schema work next. Outside models last.

| # | Workstream | Depends on | Schema | Target |
|---|---|---|---|---|
| 1 | Skin names, light/dark toggle, 404 page | none | no | before 14 Oct |
| 2 | Help coverage on every screen | none | no | before 19 Oct |
| 3 | People: photo, phone, team, profile page | none | yes | before 19 Oct |
| 4 | Home at a glance: charts | none | no | before 19 Oct |
| 5 | Comments with `@` and `#` | 3 (avatars) | yes | week of 19 Oct |
| 6 | Threads: "Connects to" on every item | 5 (mentions are links) | no | week of 19 Oct |
| 7 | Sounds and pings | 5 (new notices) | no | week of 19 Oct |
| 8 | Motion pass | 4, 6 | no | week of 19 Oct |
| 9 | Stronger search, local | 5 (search comments) | no | week of 19 Oct |
| 10 | Jev, synthetic only | 9 | no | after sponsor yes |
| 11 | Chat | 5 | yes | later |

1, 2, 3 and 4 can run at the same time. They touch different files, except `tokens.css` (1 only) and `help.ts` (2 only).

## 1. Skin names, light/dark toggle, 404 page

- **Rename the skins** in `web/components/skins.ts`: Warm to NicoWarm, Plain and familiar to NicoPlain, Calm and precise
  to NicoCalm, Soft and warm to NicoSoft, Mac to NicoOS, Ink to NicoNote. Cookie values (`w a b c m i`) stay, so no
  one loses their pick. Update the labels in `DESIGN.md`, the comments in `tokens.css`, `docs/demo/index.html` and the
  ARCHITECTURE section of `CLAUDE.md`. Old DECISIONS entries stay as written, since that section is append-only.
- **Light and dark.** The CSS already has `:root[data-theme="dark"]` and `:root[data-theme="light"]` handling for each
  skin. Nothing sets `data-theme` today. Add a three-way control (System, Light, Dark) in the Appearance flyout in
  `ProfileMenu.tsx`. Keep it in an `nd_theme` cookie that `layout.tsx` reads, like `nd_skin`, so the server HTML has no
  flash. System removes the attribute. Fix the stale line in `DESIGN.md` about where the switcher sits.
- **404 page.** Add `web/app/not-found.tsx`: plain words, a dither picture, links to Home and search. It must look
  right in every skin, day and night. Add `web/app/error.tsx` the same way, with a retry button. Today the person page
  calls `notFound()` and gets the Next.js default.
- Check: every skin, day and night, at 1280px and 375px. Contrast stays AA.

## 2. Help coverage on every screen

Help works where it is applied. The problem is coverage: 26 terms exist, and seven screens use none of them.

- Add `<Help>` to: the plan board (`PlanBoard.tsx`, no terms today), Home (Late, Today, This week, Waiting on you,
  Updates for you, Mark seen, Your projects), Team (By person / By status, the status pills), the person page tiles,
  project status words (On track, At risk, Off track, a separate term from the task flag), the task board tiles,
  "pushed N×", outcome chips, priority, the ledger table headers and split bar, the status menu items, and the skin
  names.
- Write the new terms in `web/components/help.ts`, in the same plain style (25 words or fewer, no semicolons).
- Inside a button or link, use `host`. A plain `<Help>` inside a clickable element swallows its click.
- Extend `tests/help.test.ts` so the COVERED list holds every term. Today it leaves out five.
- Check: turn help on, hover every listed word at 1280px, tap it at 375px.

## 3. People: photo, phone, team, profile page

- **Schema** (`lib/schema.ts` plus an idempotent step in `upgrade()`):
  `people.photo_url text` (from Google), `people.phone text` (optional, 7 to 20 characters of digits, spaces, `+`, `-`),
  and a `person_photos` table (`person_id`, `bytes bytea`, `mime`, `updated_at`), RLS on with no policies.
  An uploaded photo lives in the database, not in Supabase Storage: no new service, it works on PGlite previews, and
  a 256px WebP is about 20 KB.
- **Google photo.** Save the `picture` claim from the ID token on each sign-in (`app/api/auth/google/callback`).
- **Upload.** The person picks an image on their own profile. The browser crops it square and shrinks it to 256px
  WebP before upload. The server checks type and size (under 200 KB) and stores it. `GET /api/v1/people/:id/photo`
  serves it with a cache header. Order of use: uploaded photo, then Google photo, then initials.
- **Avatar** in `chips.tsx` shows the photo wherever initials show today.
- **Profile page** `/people/[id]` header adds: email (copy button), phone (tap to call on a phone), team name, department,
  app role, project roles, and an "Edit profile" button on your own page. Admins can edit department in Roster.
- Phone is personal data: show it only to signed-in members of the same team. Never put it in fixtures or logs.
  Fixtures get a synthetic phone on two people at most, so the page shows both cases.
- Hosted database: `npm run db:upgrade` once before promotion.

## 4. Home at a glance

No chart library. Small SVG charts drawn from tokens, like the ledger split bar, so every skin colours them.

- **This week:** one bar split into done, open and late, with counts.
- **On-time trend:** a four-week line of your own on-time rate (the ledger already computes the record).
- **Load by project:** a small bar per project, open tasks, late part in the late colour.
- A lead or admin also sees a team row: open and late per person, as a compact table with a bar in each row.
- Each chart has a text summary for screen readers and links to the full list it summarises.
- Check: empty states (a new person with no tasks), 375px, day and night.

## 5. Comments with `@` and `#`

- **Schema:** `comments` (`id`, `subject_kind` task|project, `subject_id`, `author_id`, `body` up to 2,000 characters,
  `created_at`, `edited_at`, `deleted_at`) and `comment_refs` (`comment_id`, `ref_kind` person|task|project, `ref_id`).
  RLS on with no policies. `subject_kind` lets chat reuse the table later.
- **Writing:** a comment box under the task drawer's update log and on the project page. Typing `@` or `#` opens a
  picker (reuse the matching in `lib/quickadd.ts`). A picked reference is stored as an id, so renames do not break it.
- **Rules** in `lib/service.ts`: anyone who can see the task or project can comment. Only the author edits or deletes.
  Blocked under View as (`assertNotViewing`). Rate limited by `route()`.
- **Notices:** a mention writes an in-app notice to that person. "Urgent: also email" opens a Gmail draft to them,
  from the writer's address, like Reminders. Nothing is sent by the app.
- **Reading:** `@person` renders as a `PersonLink`, `#task` opens the task drawer, `#project` links to the project.
- Hosted database: `npm run db:upgrade` once before promotion.

## 6. Threads: "Connects to" on every item

The OKR dashboard's threads are links worked out from shared fields, never stored, each with a relation word.
Port that idea, in nico-desk's own look.

- A pure function `threadsFor(item)` in `web/lib/threads.ts` returns lines of `{ rel, title, who, href }`, from data
  the app already has:
  - Task: Part of (project, pillar), Waits on (person, from the block), Waiting on it (tasks blocked on its owner),
    From (the meeting minutes it came from), Mentioned in (comments that `#` it), Links (its `task_links`).
  - Project: Owner, Lead, People, Checkpoints, Mentioned in.
  - Person: Owns, Waiting on them, Mentioned in.
- Show a "Connects to" list in the task drawer, on the project page and on the person page. At most five lines, then
  "Show all".
- Clicking a line opens that item. In the drawer it swaps the drawer, with Back.
- Later (not this batch): the thread map, a graph view on key `T`, where hovering an item lights its chain.
- Tests: one per relation, on fixtures.

## 7. Sounds and pings

- A "Sounds" switch in the account menu, under Appearance. Kept in an `nd_sound` cookie. Off by default.
- Three short sounds, made with the Web Audio API, so no audio files: a soft ping for a new notice, a light tick for
  Done, a low tone for a refused action. Each under 200ms and quiet.
- New notices: Home polls `/api/v1/notices` every 60 seconds while the tab is visible. A new notice pings once and the
  notice count eases in. No sound plays on page load.
- Reduced motion does not mute sounds. Only the Sounds switch does.

## 8. Motion pass

Rules stay as in `DESIGN.md` Motion: transform and opacity, under 300ms, nothing under reduced motion.

- The Home charts draw in once per session (bars grow, the line strokes in), like the ledger count-up.
- Animated SVG in empty states and the 404 page: the dither picture fades in by rows.
- The status icon morphs between states in the status menu.
- A new comment slides in. A mention chip pops in when picked.
- List each new move in `DESIGN.md` Motion, with any named exception to the 300ms rule.

## 9. Stronger search, local

Today search is word matching in memory (`lib/search.ts`). Make it better with no outside model:

- Typo tolerance: a word matches if it is one edit away (two for words over seven letters).
- Accent folding and prefix match on every word, not only whole substrings.
- Filters in the query: `@name`, `#project`, `is:late`, `is:blocked`, `is:mine`, `due:week`.
- Search comments and task link titles as well.
- Cmd+K also runs commands: New task, go to a page, switch skin, turn on help.
- Recent searches, kept per browser.
- Tests: one per filter and one per typo case, on fixtures.

## 10. Jev, synthetic only

Jev returns typed judgments (pick one, yes or no, a score), not generated text. Code keeps the rules.
Read the live TypeSafe docs (`docs.typesafe.ai/llms.txt`) before building. The key lives only in Vercel env
(`TYPESAFE_API_KEY`), server side. A flag `NICO_JEV=1` turns it on. It stays off in production until the sponsor
says yes and a DECISIONS line records it.

Candidates, best first:

1. **Search rerank:** local search finds 30 candidates, Jev orders them by meaning.
2. **Minutes to tasks:** code splits the transcript into sentences. Jev judges which are commitments and picks the owner
   from the project's people. This replaces the rule-based draft step, checked against `evals/meetings/`.
3. **Quick add with no `#`:** Jev picks the most likely project, shown as a suggestion the person confirms.
4. **Duplicate check:** before create, Jev says whether the new task matches an open one.
5. **Early warning:** Jev flags a note or comment that mentions a delay, and suggests moving the date before it is late.

Build 1 and 2 first, each with an eval on the synthetic fixtures. Report accuracy before any live use.

## 11. Chat (later)

Team or project chat on the `comments` tables (`subject_kind` = channel). Not in this batch. Decide after the pilot
whether it earns a place next to Google Chat.

## Checks for every workstream

- VERIFY from `CLAUDE.md`: evals OK, denylist grep empty, typecheck silent, tests pass (248 today plus the new ones),
  build green.
- Browser check of every changed screen at 1280px and 375px, day and night, in NicoWarm and one other skin.
- The keyboard rule on every new field (comment box, profile edit, phone).
- A DECISIONS line in `CLAUDE.md` for each merge, with the model and a rollback line.
- Schema changes: an idempotent step in `upgrade()`, then `npm run db:upgrade` on the hosted database before
  promotion. Push and deploy only with the repo owner's yes.

## Answered (13 Oct)

1. Home's four-week on-time line: each member sees their own line, since the ledger already shows a person their own
   record. A lead or admin also sees the team row.
2. Mentions: in-app notice by default. The comment box has an "Urgent: also email" option, which opens a Gmail draft
   to the person mentioned, from the writer's own address. The app never sends.
3. The thread map (key `T`): next batch. "Connects to" lists ship first and show whether people follow links at all.
