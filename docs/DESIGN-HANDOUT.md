# nico-desk design handout, v2

For the Opus session that redesigns the v1. Written by Fable 5.1 on 9 Oct 2026 at the repo owner's ask, after reviewing the v1 screens with them, a Q&A with them the same day, and a read of how they ran design in five of their other repos (section 13). This version replaces v1 of this file (the sheet-language plan) in full. Read the whole file before you open any code. Section 13 is the method and it is not optional.

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

- **The member.** Owns commitments. Wants to know what is on them, by when, and what they are waiting on from others. Works at a desk most of the day. Today their asks of colleagues happen on Slack, in person, by email and in a WhatsApp group (the repo owner, 9 Oct), so none of them is on record. Will adopt the app only if their week is clearer here than in their head.
- **The team lead.** Runs a team of three to six. Sets priority. Runs the Monday sync and signs the Friday note. Wants to stop chasing. Needs to see who is late, what moved and why, and what is stuck on whom.
- **The founder** (and the sponsor). Reads across teams. Wants the record: did the company do what it said, against the dates first given. Also wants every team's week, the same page the lead sees, read-only. Reads it weekly, not daily.

Most of the pilot team is not technical. They do not use Linear, Jira or Notion today. The one thing the repo owner put above everything else (9 Oct): the interface must feel natural and intuitive to a slightly non-technical person on first use, with no training and no help text. Every call in this file is judged against that before anything else. If a choice is cleverer but less obvious, take the obvious one.

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
- **Not me, because …** (one line of reason, required). In the same line Wren can type `@Dev` to name who is responsible, and the ask moves to Dev's week with Wren's reason on it, still asked by Tamsin. With no `@`, the ask goes back to Tamsin to re-tag. (The repo owner, 9 Oct.)

An ask is judged in the record like any other commitment. This is the thing that turns "the system holds people accountable" from a wish into a mechanic, and it is the component to design first and best.

Data: a task gains `asked_by_id` and `for_task_id`. The existing `blocked_on_id` and `blocked_ask` columns stay for compatibility in this round and can be dropped later. The `blocked_ask` send kind already exists with the asker as approver; tagging someone is a send, so the asker confirms once ("Send to Wren?") and the app never sends on its own.

### 4.4 Update

On the line itself, one tap: **done**, **on track**, **off track**. Off track opens two fields in place: the new date and the reason. Both are required. The first date stays on the line in small type, struck through, with the move and reason in the line's history. A date that passes with no update shows "late by 2 days", in words, and the record counts it as a silent slip. Done closes the line and the record marks it ahead, on time, or late against the first date. Nobody picks the outcome.

### 4.5 Team (lead and founder home)

For the lead: this week's lines across the team, grouped by person, with the late ones and the stuck ones first. What moved this week and why. Who is waiting on whom (the owed view). Monday: last week's note in drafts, this week's lines being written while the team talks. Friday: the team's note, drafted by the app from the week, read and sent by the lead. Nobody sends a Friday note today (the repo owner, 9 Oct), so this is new behaviour, not a replacement. It is on by default for the pilot, with a visible switch the lead can turn off, and the lead always presses send. For the founder: every team's week, the same page the lead sees, plus the four-week record on top: counted, ahead, on time, late, silent slips, per team.

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

- Desktop first (the repo owner, 9 Oct). Design and verify at 1440px wide first. The team works at desks. Then make sure the member home and the ask answer also work at 375px, because the answer to an ask will often come from a phone. On the phone the keyboard dismisses on tap outside, return, or scroll, on every field. Audit every flow for this.
- The ten-second test is the bar. A non-technical person sees the member home for ten seconds and can say what the app is for and what they must do first. No help text, no tour, no empty-state wizard. If a screen needs explaining, it is wrong.
- Borrow habits people already have. Dates look like a calendar app's dates. A state looks like a word, not a badge system to learn. An ask reads like a message, because that is what it replaces. Nothing needs a legend.
- Every automatic behaviour has a visible switch next to it (from the owner's Scansion rules): drafts, the Monday digest, the Friday note, the Jev checks. Off means off.
- The voice is a colleague, not a system. Short, warm, specific. No exclamation marks, no mascots, no jokes.
- Nothing is sent to anyone without the sender pressing send. The app drafts, people send. Say so in the interface where it matters ("Wren will see this when you send it").
- Mistakes are cheap: a line can be moved, dropped with a reason, or reopened. The first date is the only thing that cannot change.

## 7. The visual language

Designed from scratch for this product. Nothing is inherited from the OKR page or any other project of the owner's, and none of them is a reference. Fonts come from Google Fonts or the system, self-hosted with the OFL licence file beside them; the licensed Euclid files are no longer used and `web/public/fonts/` goes.

The repo owner ranked three temperatures on 9 Oct. These are the references, in order, and they are the only ones. Take the mechanism from each, never the look (section 13.1):

1. **Apple Reminders and Calendar.** Plain, familiar, big dates. What to take: dates as the largest thing, lists that read top to bottom, one tap to complete, nothing to configure.
2. **Linear and Things.** Calm, precise. What to take: a state is one word, lines are dense but never crowded, keyboard flow on desktop, the ask as a first-class object.
3. **Notion and Craft.** Soft, warm white space. What to take: the note that turns into lines, the sentence a draft came from, the page you can print.

Build three static sketches from the fixture data, each showing the member home with an ask line on it, the ask answer open, and the team page, all at 1440px, with one 375px crop of the ask answer. Only the mood varies across the three: light, colour, type, temperature. Layout, copy and data are identical, so the owner compares mood and nothing else. Publish the three as one private artifact page with a caption under each and post the link in the thread. Then build on the recommended one without waiting, unless the repo owner replies with a different pick. Do not build in a mood the sketches did not show, and do not invent a fourth.

- **A. Plain and familiar** (from reference 1). White, near-black, one accent used for dates and the viewer's own lines and nothing else, a clear grotesk, large tabular numbers, states as words in soft pills. Feels like an app the team already has on their phone. Pace: act. Recommended, because it is the most obvious to a non-technical person.
- **B. Calm and precise** (from reference 2). Off-white or light grey, cool temperature, thin rules, tight line height, one accent reserved for "due", tabular numbers. Feels like a planning tool for leads. Pace: scan. Candidate for the lead and founder pages if A is picked.
- **C. Soft and warm** (from reference 3). Warm off-white (not beige, not paper), deep ink, humanist sans, generous spacing, 6px radii. Feels like a well-made notebook. Pace: read.

Three ideas from v1 stay, each reapproached from the new language rather than carried over:

- The one input field at the top of every screen. In v1 it was a search box called FIND. Now it is where you commit and ask, and it reads back the three parts before you confirm.
- The as-of scrubber on the team page. In v1 it was a slider on a ledger. Now it answers one question the founder asks: "what did this week look like on Monday?" One control, a date, and the page redraws.
- Drafts tethered to the sentence in the note. In v1 the tether was a grey quote under a table row. Now the note and its draft lines sit side by side, and picking a line lights the sentence.

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
- Use `frontend-design` to build and `web-design-guidelines` to review. Load `artifact-design` before publishing the sketch page. The Nicobar kit's rule "pick two or three references from the reference stack" is overridden by the owner's newer global rule: design from scratch, and only the owner's own ranked references (section 7) count.
- Order, as work packages (section 13.4): fixtures with Nicobar context and the ask migration (direction-independent, start at once); the three sketches; `DESIGN.md`; then the member home with the ask line; then the team page and the record; then commit from notes; then the Friday and Monday flows.
- The repo owner has said: bypass anything blocked on them. So: commit after each green step without asking, edit `CLAUDE.md` ARCHITECTURE and VERIFY as the code changes, pick the direction from the sketches yourself if they have not replied, and record every such call in DECISIONS with your model name. Still ask before anything outward-facing: pushing to the public repo, deploying, or sending anything to a person. Put the push ask in your end-of-session message, not mid-work.
- Verify headless at 1440px first, then 375px, light and dark, reduced motion on, every screen, every step (section 13.5). Then look at it yourself in the browser pane before you show it.
- When you finish a screen, write two sentences on why it is shaped that way. Not a feature list.

## 11. Verify

```
python3 -I evals/meetings/check.py
python3 -I fixtures/check.py
grep -rilf fixtures/denylist.txt fixtures/*.json evals/ web/app web/components web/lib web/scripts
cd web && npx tsc --noEmit && npm run lint && npm run build && npm run smoke
```

Expected: `OK: 20 cases`, `OK: fixtures`, no grep output, tsc and lint silent, build green, smoke all ok. Then `npm run shots` (section 13.5) writes the contact sheet and reports contrast and reduced-motion results. Then the ten-second test from section 5 on the member home, done by the repo owner or the sponsor, with the answer written into this file.

## 12. Open questions, with the default to use

1. Does a member see other people's lines on their team? Default: yes, read-only, on the team page, not on their week.
2. Can a member tag someone on another team? Default: yes, the ask lands on that person's week; team pages show asks crossing in and out.
3. Does "not me" need a reason? Answered 9 Oct: yes, one line, and the decliner can `@` whoever is responsible, which moves the ask to them (section 4.3).
4. Is the Friday note sent to the whole team or to the lead only? Answered 9 Oct: drafted for the lead, the lead sends it to the team. On by default for the pilot, with a visible off switch (section 4.5).

Answered on 9 Oct by the repo owner, no longer open: desktop first; asks today happen on Slack, in person, email and WhatsApp; the founder sees the record plus every team's week; nobody sends a Friday note today; the temperature ranking in section 7; the three v1 ideas to keep in section 7.

## 13. The method

This is how the repo owner runs design in their other repos, read on 9 Oct from five of them. Each step names the file to copy the shape from. The paths are on the owner's machine, outside this repo. Read the named file before you do the step, and take the shape, not the content.

Two lessons from those repos decide the shape of this section. First: rounds of self-invented moods were rejected as "vibe coded" and "AI slop" because they had nothing to do with the owner's references and the design rules were not used. The fix was to work only from the owner's own picks. Section 7 already gives those picks. Second: a design question is never asked in words alone. Every choice the owner makes is made from something they can see.

### 13.1 Reference study, before the sketches

One short table, one row per reference in section 7: what it does well for this product, what we take, what we leave. Nothing visual is copied; a mechanism is. Put the table at the top of `DESIGN.md` (13.3) under "Sources". Shape: the "what Tare takes" notes on `~/Code/tare/design/refs.html` and the reference table in `~/Code/tare/docs/handoff-ui.md`.

### 13.2 The mood page

One HTML page, three columns, same data, same layout, same copy. Only mood varies. A caption under each saying what it is for and who it is for, in one sentence. Published as one private artifact. Kept in the repo as `docs/design/moods.html` with no font files inside it. Shape: `~/Code/Golf-game/.superpowers/brainstorm/*/content/visual-mood.html` and `~/Code/tare/design/procon.html` (title, one-paragraph intro, options in a grid, each with a caption, same real data). Rejected options stay in the file; they are the record of what was not chosen.

### 13.3 DESIGN.md, the one document that outranks everything visual

Once the mood is picked, write `DESIGN.md` at the repo root before building any screen. From then on it outranks the references, this handout's section 7, and any skill's defaults. If a screen and `DESIGN.md` disagree, the screen is wrong, or `DESIGN.md` is edited first and the edit is a DECISIONS entry.

Shape: `~/Code/awesome-design-md/design-md/linear.app/DESIGN.md`. YAML front matter (version, name, description, colors, typography, rounded, spacing, components that reference `{colors.primary}`), then Overview, Colors, Typography, Layout, Elevation and Depth, Shapes, Components, Do's and Don'ts, Responsive Behavior, Iteration Guide, Known Gaps. That format has no motion and no voice section. Add both:

- **Motion.** The three permitted gestures from section 7, each with duration, easing and what it means. Transform and opacity only. Feedback under 200ms. What reduced motion drops and what it keeps.
- **Voice.** The clarity rules from section 5 and the voice line from section 6, with ten example strings for the interface: a confirmation, an empty state, a late line, an ask, each answer, a move.

Also add a "Sources" table (13.1) and, per component, a "done when" line, the way `~/Code/Golf-game/docs/superpowers/specs/2026-10-05-art-bible.md` does per element. Lint it with `npx @google/design.md lint DESIGN.md` and keep it green. The rules checklist in `~/Code/tare/design/rules.md` (grouped: shape, type, colour, material, motion, copy, before showing) is the shape for the Do's and Don'ts section. Two tests from there go in verbatim: "would this look the same on any other AI-made dashboard?" and, as the last pass on every screen, "remove one accessory".

### 13.4 Work packages

Every item in the order in section 10 is one work package with: what it covers, the files it touches, "done when" (observable in the browser or in a command's output, never "looks right"), and the verify command. One commit per package, message in the imperative, body naming the package. Shape: `~/Code/maahirbr/docs/PHASE-6-THE-STAGE.md` (section 0 is the owner's feedback verbatim, section 7 is verify) and `~/Code/tare/docs/handoff-card-v2.md` (where things stand, what was asked, code map, plan in order, verify).

Tokens live in one file, `web/app/tokens.css`, and nowhere else. Components read variables; no component declares a colour, a size or a duration. Shape: `~/Code/Scansion/src/tokens.css`. The token table in `DESIGN.md` and `tokens.css` are edited together, always.

### 13.5 Verify before showing

Headless Playwright, a script at `web/scripts/shots.ts` run as `npm run shots`. It opens every route as each of the three roles, at 1440 and 375, light and dark, reduced motion on and off, and writes the stills into one contact sheet at `web/.shots/sheet.png` (ignored by git). It measures text contrast on every screen and fails under 4.5:1 for body text. It checks the console is clean. Shape: `~/Code/Golf-game/scripts/sweep.ts`. Every screen has a state switcher by URL hash so the sheet can open each state directly, the way `~/Code/tare/design/panel.html` takes `#<state>/<id>/<width>`.

Before showing anything to the owner: run the sheet, look at it yourself, check the console, check every screen against the Do's and Don'ts in `DESIGN.md`, then apply "remove one accessory". A thing that cannot be tested here is marked "check pending" with who checks it, never claimed as verified.

### 13.6 Review rounds

The owner's notes come back as one message. Split them into two lists, bugs and design, with every note quoted verbatim, not paraphrased. Under each note, a proposal, lettered A, B, C where there is more than one way to answer it. Each round is one append-only DECISIONS entry in `CLAUDE.md` with the model name and a rollback line, before the fix is made. Shape: `~/Code/tare/docs/decisions.md` (Decision, Reason, Rejected, Verified, Rollback) and the handoff format in Scansion ("the owner's notes verbatim, then a proposal for each").

Optional, only when the vendor gate in `web/lib/model/` is on: have Jev rank the three moods against the ten-second test and the clarity rules before the owner sees them, and show the ranking next to the page. The owner picks; the ranking is one more input, shown, never applied.
