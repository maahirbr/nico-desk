# Work packages: the v2 redesign

The build plan for the redesign, in order. One commit per package. `DESIGN.md` outranks this file
on anything visual; `docs/DESIGN-HANDOUT.md` is the brief.

## 0. What the repo owner asked for (9 Oct, verbatim)

"The bar above everything: natural and intuitive for a slightly non-technical person on first use,
no help text, desktop first at 1440, then 375 for the member home and the ask answer. Three roles,
five functions, the ask as the central object."

## 1. Where things stand

- Done: the ask in the data (`8d0231a`), `DESIGN.md` and the mood page (`5d19e1d`). Mood A.
- The v1 screens under `web/app` and `web/components` are replaced in full, package by package.
  A route not yet rebuilt keeps working but loses its styling once WP2 lands.
- `web/lib/db`, `lib/model`, `lib/sends`, `lib/jobs`, the smoke script and `/dev/act-as` stay.
  Add queries and actions as screens need them. Never change a mutation to suit a screen.

## 2. Code map

- Who is looking: `web/lib/auth.ts` (`getPersonOrRedirect`, `isLeadOf`, `isAdmin`). Roles come
  from `team_members.app_role`: member, lead, admin. In the demo the admin stands in for the
  founder and sponsor view (Team for every team, plus the record).
- Reads: `web/lib/db/queries.ts`, `queries-ui.ts` (`asksOf`, `waitingOn`, `deskHistory`,
  `ledgerLines`, `owedEdges`, `openPastDue`, `dueMovesOf`), `queries-pipeline.ts` (notes, drafts).
- Writes: `web/lib/actions/*` call one mutation each in `web/lib/db/mutations.ts`
  (`createTask`, `renegotiate`, `setHealth`, `close`, `reopen`, `createAsk`, `acceptAsk`,
  `acceptAskLater`, `declineAsk`).
- Today: `todayIST()` in `web/lib/db/dates.ts`. The fixtures are written around Friday 9 Oct 2026.
- Fixture people: Tamsin (`per_ada`, lead), Bexley (`per_cy`, admin), Orrin (`per_bo`), Sorrel
  (`per_dee`), Alder (`per_eli`), Wren (`per_fay`), all on E-commerce; Marlow (`per_gus`) leads
  Design. The open ask: Tamsin asks Wren for "Final tier names for the landing page" (`tsk_037`).

## 3. Rules every package keeps

- Every colour, size, radius, shadow and duration lives in `web/app/tokens.css` and nowhere else.
  Components use CSS Modules (`*.module.css`) that read `var(--…)` only. No Tailwind classes in
  new code. A new value goes in `DESIGN.md` front matter and `tokens.css` in the same commit.
- Fonts: Geist and Geist Mono from the `geist` npm package through `next/font`. No font file is
  committed. `web/app/fonts/OFL.txt` carries the licence.
- Copy follows `DESIGN.md` Voice. No em dashes, no eyebrows, no exclamation marks. Verbs: commit,
  ask, done, move, decline. "Send" only on the send button and the line that explains it.
- The mobile keyboard rule on every field (`web/components/week/KeyboardRule.tsx` already does it;
  move it into the shell).
- Motion: only the three gestures in `DESIGN.md` Motion, all off under reduced motion.
- Next.js 16 differs from older versions. Read `web/AGENTS.md` and the guide in
  `web/node_modules/next/dist/docs/` before writing route or action code.
- One dev server, started by the main session on http://localhost:3000. A package never starts or
  stops a server and never runs `seed`, `smoke` or `build`: PGlite allows one process. The main
  session runs those before each commit.

## 4. The packages

**WP2 Shell and tokens.** `web/app/tokens.css` (new, every token from `DESIGN.md`, light and
night: night under `prefers-color-scheme: dark` unless `[data-theme=light]`, and under
`[data-theme=dark]`), `web/app/globals.css` (replaced: a reset and base type, tokens only, no
Tailwind import), `web/app/layout.tsx` (Geist, the shell), `web/app/fonts/OFL.txt`,
`web/components/shell/*` (top bar, nav, the commit field's frame, the viewer's mark, the keyboard
rule), `web/app/page.tsx` (a member goes to `/week`, a lead or admin to `/team`), redirects from
`/me` to `/week`. Euclid is no longer referenced anywhere.
Done when: every page shows the top bar with the nav for the role (member: My week, Asks, Team;
lead and admin: plus Record), `/` focuses the commit field from any page, the current page alone
has the sunk fill, `grep -ri euclid web/app web/components` is empty, and the page reads in day and
night at 1440 and 375 (commit field as a bottom bar at 375).

**WP3 My week and the ask answer.** `web/app/week/page.tsx`, `web/app/asks/page.tsx`,
`web/components/week/*` (rebuilt: line row, date block, state pill, ask card, answer options, date
chips), `web/lib/actions/asks.ts` (new: accept, later, decline, each calling one mutation),
updates on the line (done, on track, off track; off track opens the new date and the reason, both
required). Phone order: waiting on you, your lines, you are waiting on.
Done when: as Wren at 1440 and 375 the ask card from Tamsin sits above the fold with its three
answers visible; "Later" needs a date and a reason; "Not me" needs a reason and takes `@name`;
answering shows one confirmation sentence and the line moves; a moved line shows its first date
struck; a passed date reads "Late by 2 days, no word yet"; every line has what, when, one state word.

**WP4 The commit field.** `web/components/shell/CommitField*`, `web/components/commit/parse.ts`,
`web/app/commit/page.tsx`, `web/lib/actions/commit.ts`. The field reads back "Wren · final tier
names · Wed 14 Oct" before saving. No owner or no date: not saved, and it asks "Who is this for,
and by when?". `@name` makes an ask and the button reads "Send to Wren", with "Wren will see this
when you send it." under it. Confirmation: "On Wren's week for Wednesday."
Done when: those three cases work from the top bar on any page and from `/commit`, at 1440 and 375,
and the new line arrives on the right week with the arrival gesture.

**WP5 Team and the record.** `web/app/team/page.tsx` (rebuilt), `web/app/team/record/page.tsx`,
`web/components/team/*`, `web/components/record/*`. Lines grouped by person, late and stuck first;
the as-of scrubber; the rail: moved this week (with reasons), who waits on whom, the Friday note
slot. The admin sees every team and a four-week record on top. The record prints on one A4 page.
Old `/team/*` sub-routes redirect to `/team` or `/team/record`.
Done when: as Tamsin the late line is first, picking Monday on the scrubber says "You are looking at
Monday. Back to today." and redraws, the record matches the smoke ledger counts, print preview
fits one A4 page.

**WP6 Commit from notes.** `web/app/commit/notes/[id]/page.tsx`, `web/components/notes/*`. The
note and its draft lines side by side; picking a draft lights its sentence; accept or decline one
by one; a draft with no owner or date says what is missing. The drafts switch is visible. Old
`/notes/*` and `/drafts/*` redirect.
Done when: as Tamsin, note `ntn_004` drafts to four lines, each lights its sentence, accepting one
puts it on the owner's week with a confirmation.

**WP7 Friday and Monday.** The Friday note in the team rail (drafted from the week, switch on by
default, the lead presses send, "The team sees the Friday note when you send it."), the Monday
view on the team page (last week's note, this week's lines). `/sends` and `/dev/jobs` stay
reachable for the dev role only. Remove Tailwind from `package.json` once nothing uses it.
Done when: as Tamsin the Friday note shows a draft from this week, the switch turns drafting off,
pressing send writes one row to the local outbox and nothing else.

**WP8 Shots.** `web/scripts/shots.ts` as `npm run shots` (shape: the Golf-game sweep, the tare
panel's `#<state>/<id>/<width>` switcher). Every route, three roles, 1440 and 375, day and night,
reduced motion on and off, one contact sheet at `web/.shots/sheet.png` (git-ignored). Fails on text
contrast under 4.5:1 and on console errors.
Done when: `npm run shots` exits 0 and writes the sheet; breaking a token's contrast makes it fail.

## 5. Verify, before every commit

The `CLAUDE.md` VERIFY block, plus `npx @google/design.md lint DESIGN.md` (0 errors, 0 warnings)
and, from WP8 on, `npm run shots --prefix web`. Then look at the screens yourself, check them
against `DESIGN.md` Do's and Don'ts, and remove one accessory.
