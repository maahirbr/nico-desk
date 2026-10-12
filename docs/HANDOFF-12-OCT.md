# Handoff, 12 Oct 2026: read this before you change anything

For anyone (and their Claude) who pulls `maahir/mvp` to work on the UI and features before and
after the 12 Oct demo. Roles, not names, as everywhere in this repo: the repo owner, the PM (whose
app on `local-desk` is the baseline), the pilot sponsor (runs the first pilot project), the sponsor
(runs the demo), the product teammate (shared the project sheets).

## 0. State on 13 Oct

Sections 6 and 6a below are the record of 12 Oct. Everything in them has landed.

- Production runs `47c54d7` from `maahir/mvp`. The hosted database has had `npm run db:upgrade` for `lead_id` and
  `update_seen`.
- Section 6a items 1 to 5 are merged, and so is the whole UI plan (`docs/PLAN-UI-PASS.md` workstreams 1 to 8, plus
  "Copy invite" as the stand-in for workstream 9).
- The PM's later work is merged: a project lead (owner rights on that project), "Updates for you" on Home only, with
  seen marks saved on the account instead of a cookie, and "Waiting on you" on Home. The person a block waits on
  clears it with a note. Section 6 still says Updates shows on `/team` and uses a cookie. Both are no longer true.
- A five-minute demo run sheet, with screenshots from the synthetic team, is in `docs/demo/index.html`.
- Next: the first review on Wed 14 Oct (section 7).

## 1. The goal for the demo

The desk must work end to end, on real pilot data, so the demo shows the product in action:
add, edit, start, block, finish and drop tasks and projects; a task that slips and what the desk
does about it; changes that reach the people involved. Function first, then polish.

## 2. Baseline and sources

| What | Where |
|---|---|
| App baseline | The PM's app (`local-desk`), restyled and extended on `maahir/mvp`. This is the branch to work on. |
| Visual system | `DESIGN.md` (repo root). It outranks everything visual. Tokens in `web/app/tokens.css`. |
| Skins | Six skins in `tokens.css` (`[data-skin]`), picked from the account menu, kept in the `nd_skin` cookie. Warm (`w`) is the default. |
| Brand | `web/public/brand/`: `nicobar-wordmark.svg` (the NICOBAR wordmark, `fill="currentColor"`) and `nicobar-mark-white.png` (the stacked fish and waves mark, white on transparent). Both from the public nicobar.com site. |
| Rules | `web/lib/service.ts` holds every rule. Pages and `web/app/api/v1/` both call it. |
| Map of the repo | `CLAUDE.md`: ARCHITECTURE, CONSTRAINTS, DECISIONS, VERIFY. Read CONSTRAINTS before any commit: the repo is public. |
| Requirements | `SPEC.md`, `INTENT.md`, `docs/LOCAL-DESK-SPEC.md`, `docs/USE-CASES-8-OCT.md` |

## 3. What changed on `maahir/mvp` since the PM's baseline

- Restyled to `DESIGN.md`: Geist, quiet flags, three motion gestures, the mobile keyboard rule.
- Skins: three moods from `docs/design/moods.html`, plus Warm, which matches the PM's build.
- Hosting: Vercel project `nico-desk` serves https://nico-desk.vercel.app from Supabase (Mumbai).
  The open demo is off: the first screen is Google sign-in, and only active roster people get in.
- Real pilot data on the live site: five real projects, loaded from the git-ignored `web/pilot/`. You will not have those
  files after a pull. Ask the repo owner for them privately. Never commit them.
- Roster under More, in the account menu (the PM's layout).
- Ledger: each category defined on the page; late split into "flagged early" and "missed".
- Google sign-in (`web/lib/google.ts`), direct to Google, roster and domain checked. Live since
  12 Oct. Single outside addresses come only from the env var `NICO_ALLOWED_EMAILS`.
- Admins can do everything a lead can. Admins can "View as" anyone, read only.
- Everyone lands on Home (`/me`) after sign-in. A daily 09:00 IST cron writes due and overdue notices.
- The PM's rule changes (merged `266425e`): any written reason will do, a task goes only to its
  project's people, "+ Add someone to this project" in the owner picker, grouped updates. The live
  database has had `npm run db:upgrade`.
- 12 Oct fixes: the `/team` person header says "open", not "ahead"; a project lead shows once on
  the project page and the projects list.
- 12 Oct: "Updates for you" on the home page (major changes reach the people involved), and a
  ledger that leads with why a task is late and the next step. Section 6 has the detail.

## 4. Feedback received, and its state

| Ask | From | State |
|---|---|---|
| A view of everything one person has open | pilot sponsor | Built: `/me` |
| A view by status | pilot sponsor | Built: `/team`, "By status" |
| End-of-week overdue reminder | pilot sponsor | Built as Gmail drafts on Reminders. The app never sends. |
| Roster tab visible | PM | Built: main nav for admins |
| Colours on the hosted site | PM | Built: Warm skin is the default |
| Real projects, not synthetic | pilot sponsor, PM | Done: five projects live |
| A date change alerts the manager | product teammate | Built: "Updates for you" on the home page |
| Major changes and blocks reach the people involved | repo owner | Built: "Updates for you" |
| Ledger is overwhelming: lead with why late and how to fix | repo owner | Built: `/ledger` |
| Update log easy to read | product teammate | To check in the flow test |
| Colour coding for status | product teammate, pilot sponsor | Open: UI direction, section 5 |
| Artefact links in task updates | product teammate | Open |
| Monday email per person | product teammate, pilot sponsor | After the demo. Drafts only, never sent by the app. |
| Dependency column that tags the person waited on | product teammate | Partly built: Blocked can name the teammate it waits on |
| Priority locked with the leader | product teammate | After the demo |
| Due dates locked; red needs a new date and a reason | pilot sponsor | After the demo. A date move already takes a reason. |
| Ingest many note-takers; transcripts, not summaries | sponsor, pilot sponsor, PM | After the demo |
| Scan Google Chat for to-dos | pilot sponsor | After the demo |

## 5. UI direction (from the repo owner, 12 Oct)

- Polish the UI and UX so it reads designed, not vibe coded.
- Stay true to the current design. The influences are iOS (calm, clear hierarchy, rounded
  grouped lists), Notion (clean, quiet, content first) and the PM's own build.
- More colour and accent than today, used with purpose: status colour coding is the first place.
  Keep it clean. No saturated accent soup.
- Make every change in `tokens.css` and the existing components, so all skins keep working and
  every skin keeps AA contrast in day and night.
- Banned (repo owner's global rules): typographic eyebrows (small kicker labels above headlines),
  whimsy copy, neon or terminal-green, generic template layouts.
- Mobile: dismiss the keyboard on tap outside a field, on return, and on scroll
  (`web/components/KeyboardDismiss.tsx`). Check every new field at 375px.

## 6. Work in flight on 12 Oct

Updated as each piece lands. If a line still says "in progress", check `git log` before you build
the same thing.

- Updates for you (home alerts): merged (`36e0907`). Derived from `events` in `web/lib/updates.ts`,
  no schema change. The owner sees changes others make to their task; the person a task is blocked
  on sees the block; the project lead sees date moves, blocks, drops and reassignments. Last 7 days,
  on `/me` for everyone and on `/team` for leads. "Mark all seen" is a per-device cookie
  (`nd_seen_<personId>`). Not yet: telling the previous owner when a task is reassigned away.
- Ledger, cause first: merged (`7ba7beb`). `/ledger` opens on a summary line, then "Needs attention"
  (each late task with why and the next step, from `web/lib/attention.ts`), then what finished.
  The old table sits in a collapsed "Full breakdown".
- Flow test (add, edit, close, drop, slip, persistence): done on 12 Oct. Its leftovers are in
  `docs/PLAN-UI-PASS.md` section 6.

## 6a. Tonight, 12 Oct, in this order

The repo owner's answers (Q&A, 12 Oct) are in `docs/PLAN-UI-PASS.md` section 6. Fixes first, then the UI plan.

1. **Who adds someone to a project** (security fix). Today `joinProject` in `web/lib/service.ts`
   runs for anyone who creates or edits a task, so any member can add any teammate to any project.
   Only the project owner, a lead or an admin may bring someone new in (the same rule as
   `updateProject` in `web/lib/plan.ts`). For anyone else the owner picker lists only the project's
   people and hides "+ Add someone to this project". Membership is display-only today, so the
   impact is low.
2. **The status dropdown** (`web/components/task-ui.tsx`). Blocked for the owner, a lead or an
   admin (today `blockTask` is owner-only, and `canBlock` is `t.ownerId === meId`). Unblock in one
   step. "Move date…". "Reassign…" for leads and admins. A status icon and colour on each option.
3. **The logo on the sign-in page** (`web/app/signin/page.tsx`). Use `nicobar-wordmark.svg`
   inline or as a mask, so it takes the skin's ink colour in day and night.
4. VERIFY, a browser check at desktop and 375px, day and night, then ask before push and deploy.
5. The UI plan, workstreams 1 to 8 of `docs/PLAN-UI-PASS.md`.

Waiting on the repo owner: the real emails for six roster people, and the name of one Merch record.

## 7. Rollout (repo owner's call, 12 Oct)

1. Mon 12 Oct: demo, run on the pilot's product-launch project (dated tasks and two
   owners). Google sign-in goes live the same day and the open demo goes off.
2. From Mon 12 Oct: the pilot sponsor's team uses the desk every day. Its new to-dos go in the
   desk, not a sheet.
3. Wed 14 Oct: first review. Fix what blocked people.
4. Mon 19 Oct: a second team starts, if the first days held.

## 8. Before you push

Run VERIFY from `CLAUDE.md`. Push and deploy only with the repo owner's yes. Add a DECISIONS line
(date, model, why) for any decision a later reader would ask about.
