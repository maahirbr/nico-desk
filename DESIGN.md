---
version: alpha
name: nico-desk
description: "Mood A, plain and familiar. White ground, near-black ink, and one blue that marks only dates and the viewer's own lines. Geist throughout, with large tabular dates as the biggest thing on every line. States are single words in soft pills. The pace is act: open it, see what is due, press one button."

colors:
  primary: "#1C5BD9"
  on-primary: "#FFFFFF"
  primary-soft: "#E8EFFC"
  ink: "#111317"
  ink-2: "#4D535E"
  ink-3: "#666C77"
  canvas: "#FFFFFF"
  surface: "#FFFFFF"
  sunk: "#F4F5F7"
  pill: "#EEF0F3"
  hairline: "#E6E8EC"
  line-strong: "#C9CED6"
  late: "#C3352B"
  late-soft: "#FCEBEA"
  off: "#93560A"
  off-soft: "#FFF3DC"
  night-primary: "#86ABFF"
  night-primary-soft: "#1A2540"
  night-ink: "#F2F4F7"
  night-ink-2: "#A9B0BB"
  night-ink-3: "#8A909A"
  night-canvas: "#0F1114"
  night-surface: "#171A1F"
  night-sunk: "#171A1F"
  night-pill: "#22262D"
  night-hairline: "#262A31"
  night-line-strong: "#3A3F48"
  night-late: "#FF8A80"
  night-late-soft: "#3A1A18"
  night-off: "#F2B866"
  night-off-soft: "#33270F"

typography:
  date-xl:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  date-lg:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  date-phone:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  page-title:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  ask-title:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  line:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.4
  meta:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  state:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
  button:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  heading:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  small:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  input:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.4

rounded:
  control: 10px
  card: 14px
  pill: 999px
  full: 999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px
  section: 56px

components:
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: 64px
    padding: 0 40px
  commit-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: 40px
    padding: 0 14px
  nav-item:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 6px 12px
  nav-item-on:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 6px 12px
  line-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.line}"
    padding: 16px 0
  date-block:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.date-xl}"
  state-on-track:
    backgroundColor: "{colors.pill}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  state-off-track:
    backgroundColor: "{colors.off-soft}"
    textColor: "{colors.off}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  state-late:
    backgroundColor: "{colors.late-soft}"
    textColor: "{colors.late}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  state-asked:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  state-waiting:
    backgroundColor: "{colors.pill}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  state-done:
    backgroundColor: "{colors.pill}"
    textColor: "{colors.ink-3}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  ask-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ask-title}"
    rounded: "{rounded.card}"
    padding: 20px
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: 36px
    padding: 0 14px
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: 36px
    padding: 0 14px
  answer-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.line}"
    rounded: "{rounded.control}"
    padding: 14px 16px
  date-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  date-chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 12px
  initials-mark:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 26px
  initials-mark-lg:
    backgroundColor: "{colors.pill}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 36px
  side-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    width: 232px
  initials-mark-you:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 26px
  as-of-scrubber:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.control}"
    padding: 5px 12px
  switch-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    size: 36px
  friday-note:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.card}"
    padding: 18px 20px
  draft-line:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.line}"
    rounded: "{rounded.control}"
    padding: 12px 14px
  source-sentence-lit:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  confirmation:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  record-page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: 40px
  hairline-rule:
    backgroundColor: "{colors.hairline}"
    height: 1px
  night-hairline-rule:
    backgroundColor: "{colors.night-hairline}"
    height: 1px
  night-line-row:
    backgroundColor: "{colors.night-canvas}"
    textColor: "{colors.night-ink}"
    typography: "{typography.line}"
    padding: 16px 0
  night-meta:
    backgroundColor: "{colors.night-canvas}"
    textColor: "{colors.night-ink-2}"
    typography: "{typography.meta}"
  night-date-block:
    backgroundColor: "{colors.night-canvas}"
    textColor: "{colors.night-primary}"
    typography: "{typography.date-xl}"
  night-nav-item-on:
    backgroundColor: "{colors.night-sunk}"
    textColor: "{colors.night-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 6px 12px
  night-ask-card:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
    typography: "{typography.ask-title}"
    rounded: "{rounded.card}"
    padding: 20px
  night-state-on-track:
    backgroundColor: "{colors.night-pill}"
    textColor: "{colors.night-ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-state-done:
    backgroundColor: "{colors.night-pill}"
    textColor: "{colors.night-ink-3}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-state-late:
    backgroundColor: "{colors.night-late-soft}"
    textColor: "{colors.night-late}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-state-off-track:
    backgroundColor: "{colors.night-off-soft}"
    textColor: "{colors.night-off}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-state-asked:
    backgroundColor: "{colors.night-primary-soft}"
    textColor: "{colors.night-primary}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
---

# nico-desk design system

This file outranks everything visual in the repo, the handout included. The code follows it: `web/app/tokens.css` holds every value named here and nothing else holds a colour, a size or a radius. Change the two together, in one commit.

## Overview

nico-desk is where a Nicobar team keeps what it promised: who owes what, by when, and what moved. The people using it are busy, slightly non-technical, and already have WhatsApp. So the bar is that a first-time member understands their own week in ten seconds with no help text.

The look is mood A, plain and familiar. It borrows the mechanism of Apple Reminders and Calendar (the date is read first, one tap finishes a thing), of Linear and Things (a state is one word, the ask is an object), and of Notion and Craft (a note turns into lines that keep their source). It borrows none of their looks.

**Key characteristics:**
- The date is the biggest thing on every line. The relative word comes first ("Today", "Mon"), the calendar date under it.
- Every line shows three things and never fewer: what, by when, and one state word.
- One accent, blue `{colors.primary}`, for dates and for the viewer's own marks. Red and amber exist only to say late and off track.
- White ground, near-black ink, hairline rules. No gradients, no texture, no illustration.
- The ask is a first-class object with an asker, an owner, a date, and the line it unblocks.

## Colors

The palette is two neutrals, one accent and two warnings. Every colour has one meaning.

- **Blue ({colors.primary}):** dates on open lines, the viewer's initials mark, the "asked" state, the on switch, the lit source sentence. Nothing else.
- **Ink ({colors.ink}):** text, primary buttons, the selected chip and scrubber day.
- **Ink 2 ({colors.ink-2}):** the second line under a title, nav words, on track and waiting pills.
- **Ink 3 ({colors.ink-3}):** the struck first date, done lines, quiet counts. It clears 4.5:1 on white and on the pill grey.
- **Canvas and surface ({colors.canvas}, {colors.surface}):** both white in day. Cards differ by a hairline and a soft shadow, not by fill.
- **Sunk ({colors.sunk}) and pill ({colors.pill}):** the active nav item, initials marks, neutral state pills.
- **Hairline ({colors.hairline}):** the 1px rule between lines and around controls.
- **Late ({colors.late}) on late soft:** a line past its date with no new date. Also the date of a late line.
- **Off ({colors.off}) on off soft:** a line moved in the open, or that its owner marked off track.

**Night.** Every colour has a `night-` twin, and the `night-*` components pin the pairs that must keep contrast. Night lifts the blue to `{colors.night-primary}` so it keeps contrast, turns cards into one step of surface lift instead of a shadow, and keeps the same meanings.

## Typography

One family, Geist (SIL Open Font License 1.1), loaded through `next/font` from the `geist` npm package. No font file is committed. The licence text sits at `web/app/fonts/OFL.txt`. Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`.

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `{typography.date-phone}` | 36px | 650 | 1.05 | The ask's date on a phone |
| `{typography.date-xl}` | 30px | 650 | 1.05 | The date on My week and in the ask card |
| `{typography.page-title}` | 26px | 600 | 1.2 | "Your week", the team name |
| `{typography.date-lg}` | 22px | 650 | 1.05 | The date on Team and the record |
| `{typography.ask-title}` | 18px | 600 | 1.3 | What the ask is for |
| `{typography.line}` | 16px | 500 | 1.4 | The title of a line |
| `{typography.body}` | 15px | 400 | 1.4 | Body, the commit field |
| `{typography.meta}` | 14px | 400 | 1.4 | The second line under a title, rail text |
| `{typography.button}` | 14px | 500 | 1.2 | Buttons and chips |
| `{typography.state}` | 13px | 500 | 1.3 | State pills, initials |

**Principles:**
- Dates use tabular figures and tighten to -0.02em. Nothing else changes letter-spacing.
- A date is always larger than the page title on My week. The page title is a label, the date is the content.
- Sentence case everywhere. No tracked caps, no eyebrows.

## Layout

- **Base unit:** 4px. Scale: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 40 · `{spacing.section}` 56.
- **Frame:** a 64px top bar, then a page padded 40px on the sides, max width 1360px, left aligned.
- **My week at 1440:** two columns. The lines take the rest. The right rail is 400px and holds "Waiting on you" above "You are waiting on", so an ask is above the fold.
- **Team at 1440:** the same two columns with a 380px rail: moved this week, who waits on whom, the Friday note.
- **A line:** a grid of date (150px on My week, 130px on Team), what (fills), state (fits). Rows are 16px top and bottom on My week, 12px on Team.
- **Whitespace:** groups are separated by 24px to 36px of space, lines by a hairline. Never a box around a group.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat, hairline rules | Lines, groups, the top bar |
| 1 | Hairline border plus `0 1px 2px` and `0 6px 20px` at 5 to 6% ink | The ask card, the Friday note, the answer sheet |
| 2 | Level 1 plus a dimmed page behind | The commit confirm and the "Send to Wren?" step |

Night drops the shadows. A card is one step lighter than the canvas instead.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.control}` | 10px | Buttons, the commit field, answer options, the scrubber |
| `{rounded.card}` | 14px | The ask card, the Friday note |
| `{rounded.pill}` | 999px | State pills, date chips, the switch |
| `{rounded.full}` | 999px | Initials marks |

A pill means a state or a choice of date. Nothing else is a capsule.

## Motion

Three gestures, no more. Each shows a cause. Transform and opacity only. All of them drop to an instant change under `prefers-reduced-motion: reduce`.

1. **A line arrives.** A committed or asked line fades in and rises 8px, 180ms, ease-out. It happens on the page where the line lands.
2. **A date moves.** The old date strikes through over 160ms, then the new date slides in from 6px below, 200ms. The struck date stays.
3. **A state is set.** The pill crossfades to its new word, 120ms, with a scale from 0.96 to 1. No bounce.

Nothing loops, nothing counts up, nothing moves on its own.

Other motion is not a gesture. It is the screen keeping up with the user.

- **A page enters.** The content fades in over `--dur-enter` (140ms). No slide.
- **A panel opens.** A drawer or dialog slides `--panel-shift` (32px) and fades over `--dur-panel` (200ms). It closes the same way, reversed.
- **A confirmation appears.** A small bar at the foot of the screen fades in over `--dur-toast` (160ms), stays for `--dwell-confirm`, then fades out. It has `aria-live="polite"`. At most three show at once.
- **A page loads.** `loading.tsx` shows a skeleton shaped like the real content, in `--skeleton-fill`. The fill is static. There is no shimmer.

Every duration and easing is a token in `web/app/tokens.css`. Under `prefers-reduced-motion: reduce` the three durations above become 0.

## Components

Each component lists its tokens, then the line it must pass before it ships.

**`top-bar`.** Wordmark, the five nav words for the role, the commit field, the viewer's initials and first name.
Done when: the nav shows only My week, Asks and Team (plus Record under Team for leads and the founder), and the commit field is reachable with `/` from any page.

**`commit-field`.** One field on every page. It reads back the three parts before anything is saved: "Wren · final tier names · Wed 14 Oct".
Done when: a line with no owner or no date cannot be saved, the read-back names all three parts, and an `@name` turns it into an ask that asks "Send to Wren?" before it goes.

**`nav-item` / `nav-item-on`.** Plain words, sentence case.
Done when: the current page is the only one with the sunk fill.

**`line-row`.** Date block, what with its second line, one state pill.
Done when: every row shows what, by when and a state word, and a moved line shows its first date struck beside the new one.

**`date-block`.** Relative word on top in `{typography.date-xl}`, calendar date under it in `{typography.meta}`.
Done when: it is the largest text in its row, it is blue on open lines, red on late lines, and ink 3 on done lines.

**`state-*`.** One word: done, on track, off track, late, waiting, asked.
Done when: the six words are the only state words in the interface, and only late and off track carry a warning colour.

**`ask-card`.** "Tamsin needs", the title, the date, "For:" the line it unblocks, three answers.
Done when: it sits above the fold on My week at 1440 and 375, and the three answers are visible without opening anything.

**`button-primary` / `button-secondary`.** Ink fill for the one main action, outline for the rest.
Done when: a screen has at most one primary button in view.

**`answer-option`.** Yes, by then · Later, because… · Not me, because…
Done when: "Later" needs a date and a reason, "Not me" needs a reason and takes an optional `@name`, and the selected option shows its fields inline.

**`date-chip` / `date-chip-on`.** The next three working days plus "Pick".
Done when: a date can be chosen in one tap on a phone.

**`initials-mark` / `initials-mark-you`.** Two letters in a 26px circle. The viewer's mark is blue.
Done when: every person on screen has a mark and a first name, and the viewer reads "you".

**`as-of-scrubber`.** The days of the week. Picking one redraws the team page as it stood that day.
Done when: picking Monday shows Monday's dates and states, and the page says it is a past view.

**`switch-on`.** The visible off switch for anything automatic.
Done when: every automatic behaviour has one, next to what it controls.

**`friday-note`.** Drafted from the week, read and sent by the lead.
Done when: it says the team sees it only when the lead sends it, and the switch turns the drafting off.

**`draft-line` / `source-sentence-lit`.** Draft lines beside the note. Picking one lights the sentence it came from.
Done when: every draft has a lit source sentence, and a draft with no owner or date says what is missing.

**`confirmation`.** One sentence, then gone after four seconds.
Done when: it names where the line went: "On Wren's week for Wednesday."

**`record-page`.** One printable page per team per week: counted, ahead, on time, late, silent slips.
Done when: it prints on one A4 page with no clipped text, judged against each line's first date.

## Do's and Don'ts

Check every screen against this list before showing it. An element that breaks a rule gets fixed or cut, not argued for.

### Shape
1. **One shape, one meaning.** A pill is a state or a date choice. Buttons and fields are 10px rectangles. Cards are 14px. No other radii.
2. **No decoration.** No icons beside nav words, no illustrations, no empty-state art. An initials mark is the only graphic.

### Type
3. **Dates are the largest text on a line,** in Geist 650 with tabular figures.
4. **No letter-spacing changes** except tightening dates and the page title.
5. **Few sizes.** Per screen, at most one date size, one title size and three text sizes.

### Colour
6. **One accent, one meaning.** Blue is dates and you. Red is late. Amber is off track. Nothing else takes a colour. No gradients, no glows, no fourth colour.

### Material
7. **One shadow per card**, and only on the cards listed under Elevation. Lines never get a shadow or a box.

### Motion
8. **Three gestures only** (see Motion). Feedback under 200ms. Reduced motion means instant.

### Copy
9. Plain words, sentence case, the voice below. No em dashes, no eyebrows, no exclamation marks, no whimsy.

### Before showing
10. **Encode or cut.** Every element must answer "what does this tell the person about their week?" If nothing, remove it.
11. **Generic test.** Would this look the same on any other AI-made dashboard? If yes, it is not done.
12. **Remove one accessory.** Last pass, take one thing away.

## Voice

A colleague, not a mascot. Short, plain, first names, the viewer is "you". Verbs in the interface: commit, ask, done, move, decline. Never renegotiate, ledger, outcome, event or approve. "Send" appears only on the button that sends, and on the line that says nothing goes until you press it.

1. "Nothing on you today."
2. "On Wren's week for Wednesday."
3. "Send to Wren?"
4. "Wren will see this when you send it."
5. "Tamsin needs: Final tier names for the landing page."
6. "Late by 2 days, no word yet."
7. "Moved: the store count changed."
8. "Who is this for, and by when?"
9. "The team sees the Friday note when you send it."
10. "You are looking at Monday. Back to today."

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| Desktop | 1440px | The design width. Two columns. |
| Laptop | 1280px | Same, rail narrows to 340px. |
| Tablet | 1024px | Rail moves under the lines. |
| Phone | 375px | One column. My week and the ask answer are designed here. Team is readable, not designed. |

- **Phone order on My week:** waiting on you first, then your lines, then you are waiting on. The ask is the one thing a member must not miss.
- **Touch:** every control is at least 44px tall on touch screens.
- **Keyboard:** the on-screen keyboard closes on a tap outside a field, on return or done, and on scroll. No field leaves it stuck open.
- **The commit field** stays in the top bar on desktop and becomes a bottom bar on phones.

## Iteration Guide

1. Change one component at a time and name it by its `components:` key.
2. A new value goes in the front matter and in `web/app/tokens.css` in the same commit.
3. Run `npx @google/design.md lint DESIGN.md` after every edit.
4. Run `npm run shots --prefix web` and look at the contact sheet before showing anyone.
5. A new variant is a new component entry, with its own "done when" line.
6. Treat blue as scarce. If a new thing wants a colour, it probably wants a word.

## Sources

The three ranked references from the handout, section 7. Take the mechanism, never the look.

| Reference | What it does well | What we take | What we leave |
|---|---|---|---|
| 1. Apple Reminders and Calendar | The date is read before anything else. Lists run top to bottom. One tap completes. Nothing to set up. | The relative date as the largest text on a line. Done in one tap. No settings screen. Empty states that give the good news. | iOS chrome, colour-coded lists, smart lists, the red badge for today. |
| 2. Linear and Things | A state is one word. Rows are dense but still breathe. The keyboard drives everything. An issue is an object with one owner. | One-word states. The row rhythm. One field that takes commands from the keyboard. The ask as its own object with an asker, an owner and a date. | Cycles, priorities, estimates, the project tree, brand purple, the round checkboxes. |
| 3. Notion and Craft | Text turns into structure. A block keeps its source. A page prints clean. | The note turns into draft lines beside it. Picking a line lights the sentence it came from. The record prints as one page per week. | Blank-canvas freedom, slash menus, nested pages, emoji icons, cover images. |

Mood page: `docs/design/moods.html`. A is the default. B and C are offered as skins (see Skins).

## Skins

A skin is a block of token overrides in `web/app/tokens.css`, selected by `data-skin` on `<html>`. Each has a day set and a night set. Components read `var(--...)` only, so a skin never needs a component change.

| Id | Name | Type | Accent (day / night) | Shape |
|---|---|---|---|---|
| a | Plain and familiar (default) | Geist, Geist Mono | `#1c5bd9` / `#86abff` | 6px controls, soft pills, light shadow |
| b | Calm and precise | IBM Plex Sans, IBM Plex Mono | `#0a736e` / `#4fc2bb` | 3px corners, outlined pills, no shadow |
| c | Soft and warm | Source Sans 3 | `#2d6a55` / `#7cc3a6` | 6px corners, warm ground, soft card shadow |

- The choice is stored in the cookie `nd_skin`. `layout.tsx` reads it on the server and sets `data-skin`, so there is no flash on reload.
- The switcher is the half-filled circle next to the avatar. Its items use the names above.
- Fonts load only through `next/font/google`. No font file is committed.
- Skin hooks, beyond colour and type: `--bar`, `--avatar-bg`, `--avatar-you-ring`, `--pill-ring`, `--callout-bg`, `--callout-line`, `--card-shadow`, `--row-pad`, `--font-date`, `--skeleton-fill`, `--toast-bg`, `--toast-ink`.
- Text contrast is at least 4.5:1 in all six skin and scheme sets, for ink, ink-2, ink-3, primary, late and off on canvas, surface, sunk and the bar, and for each state pill on its fill. Lowest ratios: A day 4.63, A night 4.73, B day 4.76, B night 5.17, C day 4.57, C night 5.66.
- Night follows the system setting. `data-theme="light"` or `"dark"` on `<html>` overrides it.

## Keyboard

`/` or Ctrl/Cmd+K focuses the search. `n` opens New task. `?` lists the shortcuts. `Esc` closes a panel, a menu or the search. Keys are ignored while a field has focus. Every control shows a focus ring from `--ring-width`, `--ring-color` and `--ring-offset`.

## Known Gaps

- The founder's four-week record across teams is specified but not yet drawn.
- Print styles for the record are untested on paper.
- Night values are set but not yet reviewed on a real screen in a dark room.
- The phone layout of Team is readable but not designed.
- Error states for a failed save or a lost connection are not yet written.
