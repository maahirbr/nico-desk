# Nico Desk design guide

This is the short, plain-language guide to how Nico Desk looks and reads. The PM edits it directly on GitHub.

`DESIGN.md` is the full engineering file. It stays as it is and still outranks everything visual. This guide says what the team wants. The repo owner then carries the changes into `DESIGN.md` and `web/app/tokens.css`.

Token names are in `[brackets]` so engineers can find the value. The PM can ignore them.

## 1. What it should feel like

Nico Desk is a calm desk for a small team's week. It shows who owes what, by when, and what moved. A new person should understand their own week in ten seconds, with no help text.

It should feel warm, plain and quiet. It looks like paper and ink, not a dashboard. The date is the first thing the eye finds. Nothing shouts, nothing decorates, and nothing moves on its own.

Every screen answers one question: what does this tell the person about their week? If it tells them nothing, cut it.

## 2. The look

### Colour roles

Every colour has one meaning. Values below are for the default skin, NicoWarm, in day mode.

| Role | What it is for | Token |
|---|---|---|
| Primary (terracotta) | Dates on open lines, "you", the focus ring, links | `[--primary]` |
| Ink | Main text, the one main button | `[--ink]` |
| Ink 2 and ink 3 | Second lines, quiet counts, done lines | `[--ink-2]`, `[--ink-3]` |
| Canvas (paper) | The page ground | `[--canvas]` |
| Surface (white) | Cards, menus, fields | `[--surface]` |
| Sunk and pill | Active nav item, neutral chips, initials | `[--sunk]`, `[--pill]` |
| Hairline | The 1px rule between lines and around controls | `[--hairline]` |
| Sidebar (dark) | The left navigation, dark in day and night | `[--side-bg]` |

Status colours. These are the same on status chips, the project status bar and the charts.

| Status | Colour | Token |
|---|---|---|
| Not started | Warm grey | `[--status-todo-fg]` on `[--status-todo-bg]` |
| In progress | Yellow | `[--status-doing-fg]` on `[--status-doing-bg]` |
| Blocked | Red, hatched on the bar | `[--status-blocked-fg]` on `[--status-blocked-bg]` |
| Done | Green | `[--status-done-fg]` on `[--status-done-bg]` |
| Dropped | Dark grey, struck through | `[--status-dropped-fg]` |
| Late (a flag, not a status) | Red, solid | `[--late]` on `[--late-soft]` |
| At risk (a flag) | Amber | `[--off]` on `[--off-soft]` |

Rules for colour:
- Colour never carries meaning alone. A word or a count always sits beside it.
- Blocked and late are both red. So blocked is hatched on the bar and late is solid.
- Late counts in late only. It is not also counted in its status.
- Every text and background pair must reach 4.5:1 contrast, in day and night.
- Do not add a new colour. If something wants a colour, it probably wants a word.

### Type

- Body and dates use Inter in NicoWarm `[--font-sans]`. Page titles and the wordmark use Fraunces, a serif `[--font-serif]`.
- Sizes in NicoWarm: page title 30px, body 14.5px, second line 13.5px, status chip 12px `[--type-*]`.
- Dates use tabular figures, so columns line up `[--features-date]`.
- Use sentence case everywhere. Use no tracked capitals for labels.
- A screen uses at most three text sizes, plus the title.

### Spacing and shapes

- Spacing steps in 4px units: 4, 8, 12, 16, 24, 32, 40, 56 `[--space-*]`.
- Groups sit apart by space. Lines sit apart by a hairline. Do not draw a box around a group.
- Controls have 8px corners and cards 12px in NicoWarm `[--radius-control]`, `[--radius-card]`.
- A pill is a status or a choice of date. Nothing else is a capsule.
- A card gets one soft shadow at most `[--card-shadow]`. Rows and lists never get a shadow.
- Page width stops at 1120px in NicoWarm `[--page-max]`. Content is left aligned.

### Skins

A skin changes colour, type, corners and spacing, and nothing else. The choice is in the account menu, under Appearance. System, Light and Dark is a separate choice and works in every skin.

| Skin | One line |
|---|---|
| NicoWarm (default, id `w`) | Warm paper, one terracotta accent, dark sidebar, serif headings, Inter text. |
| NicoPlain (`a`) | White ground, one blue accent, Geist, soft pills. |
| NicoCalm (`b`) | IBM Plex, small 3px corners, outlined pills, no shadow. |
| NicoSoft (`c`) | Source Sans 3, warm ground, soft card shadow. |
| NicoOS (`m`) | System font, grey window with white cards, segmented pickers. |
| NicoNote (`i`) | Inter, off-white page, 4px corners, no shadow, muted tags. |

## 3. Words and copy

The five status words. They are the only status words in the interface:
1. Not started
2. In progress
3. Blocked
4. Done
5. Dropped

Ahead, at risk and late are flags worked out from dates. A person never picks them. On time is judged against the first due date.

Voice:
- Write like a colleague, not a mascot. Short, plain, first names. The viewer is "you".
- Use sentence case for buttons, labels, headings and menu items. "Clear block", not "Clear Block".
- Use plain verbs: add, move, mark, clear, drop. Say "Send" only on a button that really sends. Nothing is sent for anyone without their yes.
- Say what happens, then stop. "Nothing on you today." is a full sentence.
- No exclamation marks, no emoji, no jokes.

Banned patterns:
- No typographic eyebrows. That is a small kicker label above a headline, such as "INTRODUCING" or "STEP 01". Let the headline carry itself.
- No whimsy copy, no cute names, no fake enthusiasm.
- No em dashes. Use a comma, a colon or a full stop.
- No illustrations or stock art. The only picture is the dither (see section 4).

## 4. New parts added this round

### Project status bar, split by colour
- What: one thin bar that splits a project's tasks by status. Left to right: done, in progress, not started, blocked, late. The counts are written under it.
- Where: on every project card, and at the top of each project page.
- Rules: each segment uses its status colour. Dropped tasks are left out. The parts add up to the total. A plan board uses the same five words. Blocked is hatched and late is solid. A screen reader gets one sentence with the counts.

### Home charts and the weekly done-against-due chart
- Home at a glance: four small charts. This week (done, open, late), your on-time rate over four weeks, open load per project, and for leads a team table.
- Weekly chart: on each project page. Two thin bars per week for the last six weeks: work done and work due, with the numbers written under each week.
- The person page reuses two of the Home charts.
- Rules: drawn from tokens, no chart library. Every chart has a sentence for screen readers, an empty state and a link to the full list. On a phone the Home charts start closed, with one tap to open.

### Jev status nudge
- What: after a person writes a note on a task, Jev may offer a status. The line reads "Sounds done. Mark as Done?" with two buttons: "Mark as Done" and "Leave it".
- Where: inside the task drawer, under the note. It is also wanted on the full-page update form (decided yes, the look is the PM's call).
- Rules: it only offers. Nothing changes until the person clicks. It uses the normal status rules, so Blocked still asks for a reason. It never shows a text field. It stays quiet when it is not sure.

### Guide page (`/guide`)
- What: a short page for the team. What Nico Desk is for, a week in it, the five statuses, the one rule, when you are blocked, what leads see, help mode and shortcuts, and where to give feedback.
- Where: in the account menu, and in a note on the first visit to Home that the person can dismiss.
- Rules: one screen per idea. Plain words. No eyebrows. The one rule: move a date before it passes, and say why.

### 404 page
- What: a plain page for an address that does not exist, headed "This page is not here". It has a dither picture, one line of help, and two links: Go to Home and Search.
- Rules: it must look right in every skin, day and night. An `error.tsx` page does the same job for a crash, with a retry button.

### Project form wording
- Phase is gone from the form. A project that has one keeps it.
- The description is one line, labelled "Project description", with the hint "In one line" (600 characters at most).
- "Category (optional)" replaces "Category line". The add button reads "+ Add person".
- The headings "The project" and "Dates" are gone.
- The reason Start is off shows only after a try with something missing, in red above the buttons.

### Help mode
- What: a `?` button at the top right, or the `?` key. When on, words with a dotted underline show a short tooltip.
- Rules: all help text lives in one file, `web/components/help.ts`. Use short sentences and plain words. A new term needs a new line there.

### The dither picture
- An ordered-dot picture in a thin tint of the accent `[--dither-ink]`.
- It appears only in empty states, the sign-in screen, the people page header and the 404 page. It never moves and never sits under text.

## 5. Motion

- Keep it small. Motion shows a cause, such as a line arriving or a status changing.
- Use transform and opacity only. Three named exceptions: a status chip eases its colour, and the tick and the Home trend line draw their strokes.
- Nothing runs longer than 300ms. The first-load list stagger is the one exception.
- Nothing loops. Nothing moves on its own.
- Everything stops under the "reduce motion" setting. The finished state shows at once.
- Charts and the status bar draw in once per browser tab, then stay still.

## 6. Phone rules

- Design at 375px. Make sure nothing scrolls sideways. Wide tables scroll inside their own card.
- The page gutter is 16px `[--page-pad]`.
- The keyboard rule: the on-screen keyboard closes when the person taps outside a field, presses return or done, or scrolls. No field may leave it open. One listener covers the whole app (`KeyboardDismiss.tsx`). Every new text field must keep to it.
- Text fields use 16px type on a phone, so the browser does not zoom in.
- Tap targets: aim for 44px tall `[--touch-min]`. Buttons are 36px today, and small links get a 24px hit area. See the open calls.
- The Home charts start closed on a phone.
- Check every changed screen at 375px, in day and night, before it ships.

## 7. Open design calls for the PM

Each line is a decision that is the PM's to make. The current default is in brackets.

1. Sentence case or title case for form labels. (Default: sentence case, as `DESIGN.md` asks.)
2. Whether "Suggested order" needs its own visual marker in the sort menu. (Not built yet. Default: it looks like any other sort option.)
3. Colours for the status bar segments, if she wants them changed. (Default: the status chip colours, with blocked hatched and late solid red.)
4. The look of the Jev nudge on the full-page update form. (Decided: it appears there too. Default: the same banner as in the drawer.)
5. The empty-state and 404 picture. (Default: the accent-tint dither "hill". Options: a different dither, a plain line, or no picture.)
6. The look of comments with @ and # chips. (Coming next. Default: none designed yet.)
7. The look of "Connects to" lists. (Coming next. Default: none designed yet.)
8. Whether Done should be green everywhere. (Default: green on chips, the bar and charts. The skin file still sets a purple for Done in some plain-text marks.)
9. Tap target size on a phone. (Default: 36px buttons and 24px link hit areas. The goal in `DESIGN.md` is 44px.)

## 8. Cut or out of date in DESIGN.md

These parts of `DESIGN.md` no longer match the app. Nothing is deleted. The repo owner decides what to cut or rewrite. Line numbers are for `DESIGN.md` as it stands.

| Lines | What no longer matches |
|---|---|
| 4, 366-377 | The overview describes NicoPlain (white, blue, Geist). The default is NicoWarm (paper, terracotta, Inter, Fraunces). |
| 6-37, 380-393 | The colour table and "Colors" text are NicoPlain's values. NicoWarm's palette is not listed. |
| 39-111, 397-415 | Type is all Geist. NicoWarm uses Inter at 14.5, 13.5 and 12px, and Fraunces titles at 500 weight. |
| 164-199, 493-494 | Six state words (on track, off track, waiting, asked). The app has five status words plus flags. |
| 375, 391, 543, 494 | "Red and amber only mean late and off track", "no fourth colour". The app also uses yellow, green and the terracotta accent. |
| 130-135, 478-479 | A top bar with a commit field and five nav words. The app has a left side nav (Home, Team, Projects, and More: Ledger, Reminders, Roster) and a search. |
| 481-483, 635 | The commit field is reached with `/`. No commit field is in the app. `/` opens search (line 635 is right). |
| 182-188, 496-503, 563-567 | Asks, answer options, "Send to ...?". There is no Asks page. "Waiting on you" is a card with a Done button. |
| 421-424, 579-586 | "My week" and "Team" layouts, rail widths, 1360px page width. Home is `/me`, and NicoWarm stops at 1120px. Line 586 describes a bottom commit bar that does not exist. |
| 534-535 | "No icons beside nav words, no empty-state art." The nav has icons, status chips have icons, and empty states have a dither picture (line 468 allows it). |
| 415, 552 | "No tracked caps." In NicoWarm the small flags (such as Late) are uppercase and letter-spaced (`tokens.css`, `.flag`). |
| 438-445, 533 | One radius set (10 and 14px, "no other radii"). NicoWarm uses 8 and 12px, 14px project cards and a pill search field. |
| 615, 631 | The skin table says NicoWarm is Geist with an accent of `#a24621`. It is Inter, and the accent is now `#b3522c`. The red and amber values quoted in line 631 have also changed (`#b83d27`, `#8c5b14`). |
| 626 | Contrast ratios were measured before NicoWarm's values changed on 12 Oct. They have not been measured again. |
| 584 | "Every control is at least 44px tall on touch screens." Buttons are 36px and small links 24px. |
| 593 | `npm run shots` does not exist in `web/package.json`. |
| 643 | "Error states are not yet written." `error.tsx` and `not-found.tsx` exist (not yet checked in a browser). |
| 432, 481-482, 496, 524, 564-567 | Fixture first names appear in the examples. `CLAUDE.md` says no people's names in repo files. Use roles or generic words. |

## 9. How to edit this file

1. Open `docs/DESIGN-GUIDE.md` on GitHub and press the pencil icon.
2. Make your change in plain words. Keep sentences short.
3. Open a pull request against `maahir/mvp`. Say in one line what you changed and why.
4. The repo owner reviews it, then syncs the change into `DESIGN.md` and `web/app/tokens.css`.

Keep these rules when you edit:
- This repo is public. Use no people's names, no real company data and no internal links. Say "the PM" and "the repo owner".
- No em dashes, no eyebrows, no whimsy.
- If you answer an open call in section 7, move it to the sections above and write the new rule there.
