# Handoff, 12 Oct 2026: read this before you change anything

For anyone (and their Claude) who pulls `maahir/mvp` to work on the UI and features before and
after the 12 Oct demo. Roles, not names, as everywhere in this repo: the repo owner, the PM (whose
app on `local-desk` is the baseline), the pilot sponsor (runs the first pilot project), the sponsor
(runs the demo), the product teammate (shared the project sheets).

## 1. The goal for the demo

The desk must work end to end, on real pilot data, so the demo shows the product in action:
add, edit, start, block, finish and drop tasks and projects; a task that slips and what the desk
does about it; changes that reach the people involved. Function first, then polish.

## 2. Baseline and sources

| What | Where |
|---|---|
| App baseline | The PM's app (`local-desk`), restyled and extended on `maahir/mvp`. This is the branch to work on. |
| Visual system | `DESIGN.md` (repo root). It outranks everything visual. Tokens in `web/app/tokens.css`. |
| Skins | Four skins in `tokens.css` (`[data-skin]`), picked from the menu by the avatar, kept in the `nd_skin` cookie. Warm (`w`) is the default. |
| Rules | `web/lib/service.ts` holds every rule. Pages and `web/app/api/v1/` both call it. |
| Map of the repo | `CLAUDE.md`: ARCHITECTURE, CONSTRAINTS, DECISIONS, VERIFY. Read CONSTRAINTS before any commit: the repo is public. |
| Requirements | `SPEC.md`, `INTENT.md`, `docs/LOCAL-DESK-SPEC.md`, `docs/USE-CASES-8-OCT.md` |

## 3. What changed on `maahir/mvp` since the PM's baseline

- Restyled to `DESIGN.md`: Geist, quiet flags, three motion gestures, the mobile keyboard rule.
- Skins: three moods from `docs/design/moods.html`, plus Warm, which matches the PM's build.
- Hosting: Vercel project `nico-desk` serves https://nico-desk.vercel.app from Supabase (Mumbai).
  Open demo is on (`NICO_OPEN_DEMO=1`): a visitor is the first lead, and anyone with the URL can
  read the pilot data.
- Real pilot data on the live site: five real projects, loaded from the git-ignored `web/pilot/`. You will not have those
  files after a pull. Ask the repo owner for them privately. Never commit them.
- Roster in the main nav for admins.
- Ledger: each category defined on the page; late split into "flagged early" and "missed".
- Google sign-in (`web/lib/google.ts`), direct to Google, roster and domain checked. Built, not
  live: it waits on the OAuth keys and `NICO_SESSION_SECRET` in Vercel.
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
- Flow test (add, edit, close, drop, slip, persistence): in progress.

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
