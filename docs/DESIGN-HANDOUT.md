# nico-desk design handout, v2

For the Opus session that redesigns the v1. Written by Fable 5.1 on 9 Oct 2026 at the repo owner's ask, after reviewing the v1 screens with them. This version replaces v1 of this file (the sheet-language plan) in full. Read the whole file before you open any code.

## 1. The verdict on v1

The v1 in `web/` works and is committed: seven screens, 20 smoke checks, the locked first date, append-only events, drafts from notes, approve before send. The repo owner looked at it and said, in order: it is boring, it is extremely tough to understand, the dependency on a colleague and tagging them is not clear, and they do not like the visual direction.

Three causes, all fixed in this round:

1. **The visual language was inherited, not designed.** The project constraint said any Nicobar surface must use the OKR page's sheet language (beige desk, grey ink, stacked cards). That constraint is now lifted for nico-desk (CLAUDE.md DECISIONS, 9 Oct). nico-desk gets its own language, designed from its own needs.
2. **Too many ideas on screen.** Ten ideas, seven screens, twelve nav items. A new user cannot tell what the product is for. The redesign has five functions and nothing else in the nav.
3. **Relationships between people were invisible.** A block was a dropdown; an ask was a grey sentence. The product's whole point is who owes what to whom, by when. That becomes the central object.

## 2. What the product is, in one line

Every commitment made at Nicobar gets done, or gets openly renegotiated, without anyone having to chase it. (The sponsor, 8 Oct.)

The sponsor's four pains, which every screen must answer: commitments leak out of meetings and chats; leads spend their time chasing; dates slip quietly; there is no single source of truth.

## 3. The roles

Design from these three roles. They are the roles that already exist at the company, not roles the app invents. Each role gets one home screen and sees the product through it.

- **The member.** Owns commitments. Wants to know what is on them, by when, and what they are waiting on from others. Lives on a phone and in WhatsApp. Will adopt the app only if their week is clearer here than in their head.
- **The team lead.** Runs a team of three to six. Sets priority. Runs the Monday sync and signs the Friday note. Wants to stop chasing. Needs to see who is late, what moved and why, and what is stuck on whom.
- **The founder** (and the sponsor). Reads across teams. Wants the record: did the company do what it said, against the dates first given. Reads it weekly, not daily.

Later roles, not in this round: the partner owner (Partner teams), the project owner approving a launch step (Launch teams). Keep the data model open to them, do not design for them yet. The pilot team is a Run team (`docs/HOW-TEAMS-WORK.md`).

## 4. The five functions

The nav has these five words and no others. Everything the v1 had (ledger, sends, drafts, jobs, search, by-status, load, act-as) lives inside one of these or behind a dev route.

### 4.1 My week (member home)

Everything on me, in date order, with three things on every line and never fewer: **what**, **by when**, **the state in one word**. Then two short groups below: **waiting on me** (asks other people made of me) and **I am waiting on** (asks I made). Deadlines are the biggest thing on the screen. Relative words first ("today", "tomorrow", "Fri"), the date after.

### 4.2 Commit

One line, anywhere: who, what, by when. From typing in the one field at the top of every screen. From a pasted or imported meeting note, which becomes draft lines to accept one by one, each with the sentence it came from. From a tag (4.3). The field completes the three parts and shows them back before you confirm: "Wren · final landing page address · Wed 15 Oct". A commitment without an owner or a date is not saved. That is the single rule that makes the product work.

### 4.3 Ask

Type `@Wren` and what you need and by when, on any line or in the field. It becomes a line on Wren's week, owned by Wren, asked by you, tied to the line it unblocks. Both weeks show it. Yours reads "waiting on Wren · Wed". Wren's reads "Tamsin needs: final landing page address · Wed" with three answers on it:

- **Yes, by then** (or a date Wren picks, which becomes the first date on record).
- **Later, because …** (moves the date, with the reason, in the open).
- **Not me** (declines with a reason, and the ask goes back to the asker to re-tag).

An ask is judged in the record like any other commitment. This is the thing that turns "the system holds people accountable" from a wish into a mechanic, and it is the component to design first and best.

Data: a task gains `asked_by_id` and `for_task_id`. The existing `blocked_on_id` and `blocked_ask` columns stay for compatibility in this round and can be dropped later. The `blocked_ask` send kind already exists with the asker as approver; tagging someone is a send, so the asker confirms once ("Send to Wren?") and the app never sends on its own.

### 4.4 Update

On the line itself, one tap: **done**, **on track**, **off track**. Off track opens two fields in place: the new date and the reason. Both are required. The first date stays on the line in small type, struck through, with the move and reason in the line's history. A date that passes with no update shows "late by 2 days", in words, and the record counts it as a silent slip. Done closes the line and the record marks it ahead, on time, or late against the first date. Nobody picks the outcome.

### 4.5 Team (lead and founder home)

For the lead: this week's lines across the team, grouped by person, with the late ones and the stuck ones first. What moved this week and why. Who is waiting on whom (the owed view). Monday: last week's note in drafts, this week's lines being written while the team talks. Friday: the team's note, drafted by the app from the week, read and sent by the lead. For the founder: the same page across teams, with the four-week record on top: counted, ahead, on time, late, silent slips, per team.

The record is one printable page per week. It is the honest answer to "did we do what we said".

## 5. Clarity rules

- Every line shows who, what, by when, and one state word. Nothing else on the first line.
- One secondary line at most: the reason for a move, or who asked.
- Dates are the largest type on a screen after the headline. Relative word first, date second, never a bare number.
- People are first names with an initials mark. The viewer is "you".
- One word per state, always a word, never colour alone: done, on track, off track, late, waiting, asked.
- Plain verbs in the interface: commit, ask, done, move, decline. Not renegotiate, ledger, outcome, event, send, approve. The record page can say "record".
- Confirmations say what happened in one sentence: "On Wren's week for Wednesday." Empty states say the good news: "Nothing on you today."
- One field for input, at the top of every screen. No forms below the fold.
- A new user understands the product from the member home with no help text. Test it: show the screen to someone for ten seconds and ask what the app does.

## 6. Friendliness and adoption

The product competes with WhatsApp, not with a project tool. It wins only if the member's week is clearer here and asking someone for something is faster here than typing a message. Design for that:

- Phone first. Every function works at 375px with one thumb. The keyboard dismisses on tap outside, return, or scroll, on every field. Audit every flow for this.
- The voice is a colleague, not a system. Short, warm, specific. No exclamation marks, no mascots, no jokes.
- Nothing is sent to anyone without the sender pressing send. The app drafts, people send. Say so in the interface where it matters ("Wren will see this when you send it").
- Mistakes are cheap: a line can be moved, dropped with a reason, or reopened. The first date is the only thing that cannot change.

## 7. The visual language

Designed from scratch for this product. Nothing is inherited from the OKR page or any other project, and no earlier project is a reference. Fonts come from Google Fonts or the system; the licensed Euclid files are no longer used and `web/public/fonts/` goes.

Build three static sketches first, one page each, from the fixture data, each showing the member home and the ask line on a phone and the team page on a desktop. Vary the mood across them, not just the layout. Publish the three as one private artifact page and post the link in the thread. Then build on the recommended one without waiting, unless the repo owner replies with a different pick. Do not build in a mood the sketches did not show.

- **A. Warm and quiet.** Off-white (not beige, not paper), deep ink, one warm accent used only for dates and the viewer's own lines. Humanist sans, generous spacing, soft 6px radii. Feels like a well-made notebook app. Pace: read.
- **B. Bright and direct.** White, near-black, one saturated accent and no second one, a strong grotesk, large tabular numbers for dates, pill states with words in them. Feels like a messaging app a team would already have on their phone. Pace: act. Recommended for the product.
- **C. Dark and calm.** Charcoal, soft contrast, cool temperature, one accent reserved for "due", tabular numbers, thin rules. Feels like a planning tool for leads. Pace: scan. Candidate for the night theme once B is built.

Hard rules from the global design rules, which still apply: no typographic eyebrows (a small kicker above a headline), no whimsy copy, no saturated accent soups, no concentric-ring AI visuals, no terminal green, no neon, no paper-mode tropes, no generic template layouts, no decorative motion. Motion is reserved for three gestures: a line arriving on a week, a date moving, a state being set. Honour reduced motion.

## 8. Nicobar in the demo

Fixtures stay synthetic, and now carry the company's public context so the demo reads as Nicobar and not as a blank tool (CLAUDE.md DECISIONS, 9 Oct). Allowed: the company name, the workspace named after it, team names that match how the company is organised in public (store operations, e-commerce, design, marketing, sourcing), projects of the public kind (a festive edit, a new store opening in a city where the brand has stores, a home linen drop, a website relaunch), and product and place words from the public site. Not allowed: real people's names, real launch dates, real numbers, internal URLs, anything from a department sheet or Supabase. Invent all names. Keep `fixtures/denylist.txt` for everything but the company name, which is removed from it in this round. `fixtures/check.py` and the replay must stay green after the regeneration.

The pilot fixture team is a Run team of six: one lead, five members, one of them also an admin. Give it a name a Nicobar lead would recognise and a week that includes at least: two asks between members, one answered "later, because", one silent slip, one line moved in the open, one done early, one meeting note with four draft lines.

## 9. What exists, and what changes

Keep as is:
- `web/lib/db/`: schema, triggers, queries, mutations, replay, dates. Add `asked_by_id` and `for_task_id` as a migration. Add queries as needed; do not change a mutation to suit a screen.
- `web/lib/model/`, `web/lib/sends/`, `web/lib/jobs/`: the drafter, the checks, the vendor gate, the send state machine, the Monday and Friday jobs.
- `web/scripts/smoke.ts`: extend it with the ask flow (create, accept with date, move with reason, decline). It stays green at every step.
- The dev act-as sign-in at `/dev/act-as` until Google sign-in is agreed.

Replace in full:
- `web/app/*` pages, `web/components/*`, `web/app/globals.css`, the fonts. Five routes in the nav: `/week` (me), `/commit` (the field, also present on every page), `/asks`, `/team`, and `/record` under team. Keep `/dev/*`. Old routes can redirect or go.

## 10. How to run the work

- You hold design judgement. Sonnet subagents implement, at most three at once, with explicit `model: "sonnet"`.
- Use `frontend-design` to build and `web-design-guidelines` to review. Load `artifact-design` before publishing the sketch page.
- Order: fixtures with Nicobar context and the ask migration (direction-independent, start at once); the three sketches; then the member home with the ask line; then the team page and the record; then commit from notes; then the Friday and Monday flows.
- The repo owner has said: bypass anything blocked on them. So: commit after each green step without asking, edit `CLAUDE.md` ARCHITECTURE and VERIFY as the code changes, pick the direction from the sketches yourself if they have not replied, and record every such call in DECISIONS with your model name. Still ask before anything outward-facing: pushing to the public repo, deploying, or sending anything to a person. Put the push ask in your end-of-session message, not mid-work.
- Verify in the browser pane at 375px and desktop, light and dark, reduced motion on. Every screen, every step.
- When you finish a screen, write two sentences on why it is shaped that way. Not a feature list.

## 11. Verify

```
python3 -I evals/meetings/check.py
python3 -I fixtures/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/ web/app web/components web/lib web/scripts
cd web && npx tsc --noEmit && npm run lint && npm run build && npm run smoke
```

Expected: `OK: 20 cases`, `OK: fixtures`, no grep output, tsc and lint silent, build green, smoke all ok. Then the ten-second test from section 5 on the member home, done by the repo owner or the sponsor, with the answer written into this file.

## 12. Open questions, with the default to use

1. Does a member see other people's lines on their team? Default: yes, read-only, on the team page, not on their week.
2. Can a member tag someone on another team? Default: yes, the ask lands on that person's week; team pages show asks crossing in and out.
3. Does "not me" need a reason? Default: yes, one line, so the asker learns who to tag instead.
4. Is the Friday note sent to the whole team or to the lead only? Default: drafted for the lead, the lead sends it to the team.
