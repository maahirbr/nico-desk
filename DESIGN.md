---
version: alpha
name: nico-desk
description: "NicoWarm, the default skin. Warm paper ground, near-black ink, and one terracotta accent that marks dates and the viewer's own marks. Inter for text and Fraunces for titles. A dark sidebar holds the navigation. Status is one of five words in a soft chip with an icon. Late, At risk, Ahead and On time are small flags worked out from dates. The pace is act: open it, see what is due, press one button."

colors:
  primary: "#B3522C"
  on-primary: "#FFFFFF"
  primary-soft: "#F6E6DC"
  ink: "#1F1C18"
  ink-2: "#6E675C"
  ink-3: "#766E61"
  canvas: "#F5F2EC"
  surface: "#FFFFFF"
  sunk: "#FAF8F4"
  pill: "#E8E1D3"
  hairline: "#E8E2D6"
  line-strong: "#D6CEBF"
  late: "#B83D27"
  late-soft: "#FAE5DF"
  off: "#8C5B14"
  off-soft: "#F8ECD0"
  status-idle: "#ECE9E3"
  status-idle-ink: "#57514A"
  status-active: "#FBEFC9"
  status-active-ink: "#7A5A00"
  status-blocked: "#FBE1DC"
  status-blocked-ink: "#A8321F"
  status-done: "#DCF1E3"
  status-done-ink: "#22663F"
  status-dropped: "#5F5951"
  status-dropped-ink: "#FFFFFF"
  side-bg: "#1E1B17"
  side-hover: "#2B2722"
  side-surface: "#26231F"
  side-line: "#38332C"
  side-ink: "#E9E3D7"
  side-ink-2: "#9D9588"
  side-primary: "#E07B4F"
  night-primary: "#E07B4F"
  night-on-primary: "#1B1916"
  night-primary-soft: "#3A261C"
  night-ink: "#EDE8DE"
  night-ink-2: "#A39B8E"
  night-ink-3: "#A39B8E"
  night-canvas: "#12110F"
  night-surface: "#1B1916"
  night-sunk: "#211F1B"
  night-pill: "#2B2822"
  night-hairline: "#2E2B26"
  night-line-strong: "#403B34"
  night-late: "#F07158"
  night-late-soft: "#3A1F1A"
  night-off: "#E5A845"
  night-off-soft: "#33281A"
  night-status-idle: "#34302B"
  night-status-idle-ink: "#CFC8BB"
  night-status-active: "#3D3317"
  night-status-active-ink: "#F0C75E"
  night-status-blocked: "#3F201B"
  night-status-blocked-ink: "#FF9A8A"
  night-status-done: "#1C3527"
  night-status-done-ink: "#7FD6A3"
  night-status-dropped: "#57514A"
  night-status-dropped-ink: "#F2EDE4"
  night-side-bg: "#0C0B0A"

typography:
  date-xl:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  date-lg:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  date-phone:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontFeature: '"tnum" 1'
  page-title:
    fontFamily: Fraunces
    fontSize: 30px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.02em
  ask-title:
    fontFamily: Fraunces
    fontSize: 21px
    fontWeight: 500
    lineHeight: 1.2
  line:
    fontFamily: Inter
    fontSize: 14.5px
    fontWeight: 500
    lineHeight: 1.55
  body:
    fontFamily: Inter
    fontSize: 14.5px
    fontWeight: 400
    lineHeight: 1.55
  meta:
    fontFamily: Inter
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.5
  state:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
  flag:
    fontFamily: Inter
    fontSize: 10.5px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.03em
  button:
    fontFamily: Inter
    fontSize: 13.5px
    fontWeight: 600
    lineHeight: 1.2
  heading:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  small:
    fontFamily: Inter
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.5
  input:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.4

rounded:
  control: 8px
  card: 12px
  project-card: 14px
  flag: 4px
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
    padding: 12px 40px
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 9px 64px 9px 40px
  side-nav:
    backgroundColor: "{colors.side-bg}"
    textColor: "{colors.side-ink-2}"
    typography: "{typography.body}"
    width: 236px
    padding: 22px 14px
  nav-item:
    backgroundColor: "{colors.side-bg}"
    textColor: "{colors.side-ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 9px 10px
  nav-item-on:
    backgroundColor: "{colors.side-hover}"
    textColor: "{colors.side-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 9px 10px
  line-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.line}"
    padding: 12px 0
  date-block:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.date-xl}"
  status-not-started:
    backgroundColor: "{colors.status-idle}"
    textColor: "{colors.status-idle-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  status-in-progress:
    backgroundColor: "{colors.status-active}"
    textColor: "{colors.status-active-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  status-blocked:
    backgroundColor: "{colors.status-blocked}"
    textColor: "{colors.status-blocked-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  status-done:
    backgroundColor: "{colors.status-done}"
    textColor: "{colors.status-done-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  status-dropped:
    backgroundColor: "{colors.status-dropped}"
    textColor: "{colors.status-dropped-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  flag-late:
    textColor: "{colors.late}"
    typography: "{typography.flag}"
    rounded: "{rounded.flag}"
  flag-at-risk:
    textColor: "{colors.off}"
    typography: "{typography.flag}"
    rounded: "{rounded.flag}"
  flag-neutral:
    textColor: "{colors.ink-2}"
    typography: "{typography.flag}"
    rounded: "{rounded.flag}"
  waiting-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: 20px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: 20px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
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
  date-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: 4px 12px
  initials-mark:
    backgroundColor: "{colors.side-hover}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 28px
  initials-mark-lg:
    backgroundColor: "{colors.pill}"
    textColor: "{colors.ink-2}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 36px
  initials-mark-you:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.state}"
    rounded: "{rounded.full}"
    size: 28px
  switch-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    size: 36px
  confirmation:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: 10px 16px
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
    padding: 12px 0
  night-meta:
    backgroundColor: "{colors.night-canvas}"
    textColor: "{colors.night-ink-2}"
    typography: "{typography.meta}"
  night-date-block:
    backgroundColor: "{colors.night-canvas}"
    textColor: "{colors.night-primary}"
    typography: "{typography.date-xl}"
  night-side-nav:
    backgroundColor: "{colors.night-side-bg}"
    textColor: "{colors.side-ink-2}"
    typography: "{typography.body}"
    width: 236px
  night-card:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: 20px
  night-button-primary:
    backgroundColor: "{colors.night-primary}"
    textColor: "{colors.night-on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: 36px
    padding: 0 14px
  night-flag-late:
    textColor: "{colors.night-late}"
    typography: "{typography.flag}"
    rounded: "{rounded.flag}"
  night-flag-at-risk:
    textColor: "{colors.night-off}"
    typography: "{typography.flag}"
    rounded: "{rounded.flag}"
  night-status-not-started:
    backgroundColor: "{colors.night-status-idle}"
    textColor: "{colors.night-status-idle-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-status-in-progress:
    backgroundColor: "{colors.night-status-active}"
    textColor: "{colors.night-status-active-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-status-blocked:
    backgroundColor: "{colors.night-status-blocked}"
    textColor: "{colors.night-status-blocked-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-status-done:
    backgroundColor: "{colors.night-status-done}"
    textColor: "{colors.night-status-done-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
  night-status-dropped:
    backgroundColor: "{colors.night-status-dropped}"
    textColor: "{colors.night-status-dropped-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.pill}"
    padding: 3px 10px
---

# nico-desk design system

This file outranks everything visual in the repo, the handout included. The code follows it: `web/app/tokens.css` holds every value named here and nothing else holds a colour, a size or a radius. Change the two together, in one commit.

The values in the front matter and the prose below are NicoWarm, the default skin. The Skins section lists the others. Where a value here differs from `tokens.css`, `tokens.css` is what the app shows, so fix this file.

## Overview

nico-desk is where a Nicobar team keeps what it promised: who owns what, by when, and what moved. The people using it are busy, slightly non-technical, and already have WhatsApp. So the bar is that a first-time member understands their own week in ten seconds with no help text.

The default look is NicoWarm: a paper ground, near-black ink, one terracotta accent, a dark sidebar and a serif for titles. The pilot team asked for it (see NicoWarm, the default skin). Cool (once NicoOS), a grey and blue look, is the one other skin in the account menu. Both come in Light and Dark, and Light is the default. The mechanism comes from Apple Reminders and Calendar (the date is read first, one tap finishes a thing), from Linear and Things (a status is one word) and from Notion and Craft (a note turns into lines that keep their source). It borrows none of their looks.

**Key characteristics:**
- The date is the biggest thing on every line. The relative word comes first ("Today", "Mon"), the calendar date under it.
- Every line shows three things and never fewer: what, by when, and one status word.
- Status is one of five words: Not started, In progress, Blocked, Done, Dropped. A person picks it.
- Late, At risk, Ahead and On time are flags. The app works them out from dates. A person never picks one. On time is judged against the first due date.
- One accent, terracotta `{colors.primary}`, for dates, the main button and the viewer's own marks. Red marks Late and the Blocked chip, and amber marks At risk. The other status chips use soft grey, yellow and green, one fill for each word.
- Paper ground, near-black ink, hairline rules. A dark sidebar. No gradients and no texture.
- Pictures are rare: icons on the nav and on status chips, and an ordered-dither picture in empty states.

## Colors

The palette is a warm neutral set, one accent and two warnings. The five status chips add a soft fill each. Every colour has one meaning.

- **Terracotta ({colors.primary}):** dates on open lines, the main button, links, the viewer's initials mark, the on switch. White text on it (`{colors.on-primary}`).
- **Ink ({colors.ink}):** text, and the selected segment in a switch such as By person and By status.
- **Ink 2 ({colors.ink-2}):** the second line under a title, table headings, the neutral flags (Ahead, On time).
- **Ink 3 ({colors.ink-3}):** done lines, quiet counts.
- **Canvas and surface ({colors.canvas}, {colors.surface}):** paper and white. A card is white on paper, with a hairline and a soft shadow.
- **Sunk ({colors.sunk}) and pill ({colors.pill}):** a recessed area, and the neutral pill and initials fill.
- **Hairline ({colors.hairline}) and line strong ({colors.line-strong}):** the 1px rule between lines, and the edge of controls.
- **Late ({colors.late}) on late soft:** a line past its date and not done. The Late flag.
- **Off ({colors.off}) on off soft:** the At risk flag.
- **Status chips:** Not started is warm grey, In progress is soft yellow, Blocked is soft red, Done is soft green and Dropped is a dark grey chip with struck text. The pairs are in the front matter.
- **Sidebar:** the sidebar is dark in day and in night (`{colors.side-bg}`, deeper in night). Its text uses `{colors.side-ink}` and `{colors.side-ink-2}`. The logo tile and the edge of the current page use `#b5532c`. Code in `tokens.css` re-points the colour tokens on `.side`, so no component changes.

**Night.** Every colour has a `night-` twin. Night lifts the terracotta to `{colors.night-primary}` and puts dark text on it (`{colors.night-on-primary}`). A card is one step of surface lift with no shadow. The meanings stay the same. Night sets ink 2 and ink 3 to the same value.

## Typography

Two families, loaded only through `next/font/google` in `web/app/layout.tsx`. No font file is committed. Inter (SIL Open Font License 1.1) carries text, dates and buttons. Fraunces (also OFL) carries titles: the page title, the ask title, the stat numbers (28px, weight 500) and the wordmark (16px, weight 600). Fallback for Inter: `system-ui, -apple-system, "Segoe UI", sans-serif`.

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `{typography.date-phone}` | 36px | 650 | 1.05 | A date on a phone |
| `{typography.date-xl}` | 30px | 650 | 1.05 | The big date |
| `{typography.page-title}` | 30px | 500 | 1.15 | Page titles (Fraunces) |
| `{typography.date-lg}` | 22px | 650 | 1.05 | A date in a table or card |
| `{typography.ask-title}` | 21px | 500 | 1.2 | Card and callout titles (Fraunces) |
| `{typography.heading}` | 16px | 600 | 1.3 | Section headings |
| `{typography.line}` | 14.5px | 500 | 1.55 | The title of a line |
| `{typography.body}` | 14.5px | 400 | 1.55 | Body, the search field |
| `{typography.meta}` | 13.5px | 400 | 1.5 | The second line under a title |
| `{typography.button}` | 13.5px | 600 | 1.2 | Buttons and links that act |
| `{typography.small}` | 12.5px | 400 | 1.5 | Counts, hints, date chips |
| `{typography.state}` | 12px | 500 | 1.3 | Status chips, initials |
| `{typography.flag}` | 10.5px | 600 | 1 | Flags such as Late |

Form fields use 16px (`{typography.input}`) so a phone does not zoom in.

**Principles:**
- Dates use tabular figures and tighten to -0.02em.
- The page title and the wordmark tighten to -0.02em too.
- Flags are the one place with tracked capitals: uppercase, 10.5px, 0.03em. Section headings stay in sentence case. No eyebrows above headlines.
- Form field labels, and the headings and titles inside a form, use Title Case: "Project Name", "Project Description", "Start a Project" (the PM's call, 13 Oct). "(optional)" and "(if any)" are always lower case, even inside a Title Case label: "Category (optional)", "Details (if any)" (the PM's call, 14 Oct). Typed text is the largest (`--type-input`, 16px), then the field label (`--type-label`, 14px), then the hint inside the field (`--type-small`, 13px). Short words stay lower case (a, an, the, and, of, in, on, to, for). Hints, notes, placeholders, options and buttons keep sentence case. The Start a project form follows this today; other forms move over as they are touched.
- Sentence case everywhere else.

## Layout

- **Base unit:** 4px. Scale: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 40 · `{spacing.section}` 56.
- **Frame:** a dark left sidebar 236px wide, then the main area. The top of the main area is a 64px bar with a centred search field (560px at most). The page is padded 40px at the sides. Its maximum width is 1120px.
- **Home (`/me`) and Team (`/team`):** one column, no side rail. Both use the `calm` width, 980px at most.
- **Page widths.** There are two. Pages built around a table or a board (Roster, Ledger, Reminders, Feedback, a project board, a task) use the full page. Every other page uses the `calm` column, 980px at most: Home, Team, Projects, a person, Your profile, New task, Search, Connections and the Guide. Cards, forms included, fill their column. A title sits in a `page-head` or has a lede under it, so the space before the content is the same on every page.
- **Home** opens with a greeting and one summary line, then a small glance of charts, an updates card and the "Waiting on you" callout when something is waiting. Your tasks follow in groups: Late, Today, This week, Later. Your projects and a collapsed "Done this week" come last.
- **Team** has a week switcher, a By person and By status switch, a project filter and a person search. By person, each person's tasks sit in Late, This week and Coming up.
- **A line:** a grid of date (about 150px), what (fills) and status (fits). Rows are 12px top and bottom.
- **Whitespace:** groups are separated by 24px to 36px of space, lines by a hairline.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | Flat, hairline rules | Lines, groups, the top bar |
| 1 | Hairline border plus `0 1px 2px` and `0 4px 14px` at 4 to 5% ink | Cards, the "Waiting on you" callout |
| 2 | Level 1 plus a dimmed page behind | A drawer or a dialog over the page |

Night drops the card shadow. A card is one step lighter than the canvas instead.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.control}` | 8px | Buttons, fields, menus |
| `{rounded.card}` | 12px | Cards, the callout |
| `{rounded.project-card}` | 14px | Project cards |
| `{rounded.flag}` | 4px | Flags such as Late |
| `{rounded.pill}` | 999px | Status chips, date chips, the search field, the switch |
| `{rounded.full}` | 999px | Initials marks |

A pill means a status, a choice of date or the search field. Nothing else is a capsule.

## Motion

Three gestures, plus the small moves listed after them. Each shows a cause. Transform and opacity only, with these named exceptions: a status chip eases its colour; a tick, the Home trend line, the ledger ring, an empty state's mark and the sign-in wordmark draw their strokes; a fold opens its height; and the focus ring fades in its colour. The curve is the settle curve `--ease`, `cubic-bezier(.2, .8, .2, 1)`: quick out of the gate, a long soft landing. Nothing runs past 300ms except the first-load stagger and the stroke draws. A stroke draws on its own even curve `--ease-draw`: a tick after a click over `--dur-draw-tick` (320ms), a longer line over `--dur-draw` (480ms), so it reads as drawn and not as a flicker. All of it drops to an instant change under `prefers-reduced-motion: reduce`.

1. **A line arrives.** A committed or asked line fades in and rises 8px, 180ms, ease-out. It happens on the page where the line lands.
2. **A date moves.** The old date strikes through over 160ms, then the new date slides in from 6px below, 200ms. The struck date stays.
3. **A state is set.** The pill crossfades to its new word, 120ms, with a scale from 0.96 to 1. No bounce.

Nothing loops and nothing moves on its own.

Other motion is not a gesture. It is the screen keeping up with the user.

- **A page enters.** The content fades in and rises `--page-shift` (4px) over `--dur-enter` (140ms).
- **A tab or nav item is chosen.** One marker slides to it (`indicatorMotion`, a spring of about 240ms with no bounce), and a tab's content cross-fades with the same 4px shift over `--dur-tab` (160ms).
- **A panel opens.** A drawer springs in from 32px to the side and a dialog from 12px below with a scale from 0.98, both in under 300ms (`drawerMotion`, `modalMotion`). They close the same way, faster. A menu scales from the control that opened it.
- **A list loads.** The first time a list is shown in a browser tab, its rows rise `--stagger-rise` (6px) and fade over `--dur-stagger` (200ms), 30ms apart, the delay capped at the eighth row. It never replays for a row added later. This is the one motion allowed to run past 300ms.
- **A status changes.** The chip eases its fill and text colour over `--dur-state` (120ms). Its icon morphs (see The status icon morphs).
- **A task is marked done.** The tick in the box draws itself over `--dur-draw-tick` (320ms). The same tick draws in the Done chip.
- **The Home glance draws in.** The first time Home is shown in a browser tab, its bars grow from the left (`transform: scaleX`) and the on-time line draws itself (`stroke-dashoffset`, the third named exception, like the tick) over `--dur-draw` (480ms) on `--ease-draw`. It never replays on a later visit in the same tab, and reduced motion shows the finished charts at once.
- **A project status bar grows in.** The first time a project's bar is shown in a browser tab (the card list counts as one surface, each project page as another), its segments grow from the left over `--dur-slide` (200ms), by `transform: scaleX` only. It never replays in the same tab, and reduced motion shows the finished bar at once. The person page cards use the Home glance move above.
- **A number counts up.** A figure on the ledger counts from 0 to its value once per session, in 280ms. A hard page load, a repeat visit and reduced motion show the true value at once.
- **A new notice arrives.** While Home is open and the tab is visible, it asks for notices every 60 seconds. When a new one comes, the "N new notices" count beside the date fades in and rises 8px over 180ms (the `.arrive` class, transform and opacity only), and reduced motion shows it at once. Nothing moves on page load. With Sounds on, a soft ping plays once for it (see Sounds).
- **A dithered picture is shown.** Only in empty states, the 404 and error pages, the sign-in screen and the people page header. It is an ordered dither (`web/lib/dither.ts`) in `--dither-ink`, a thin tint of the skin accent. It never sits under text and is hidden from screen readers. In empty states and on the 404 and error pages it fades in by rows, once, from the top: each row is its own path and starts `--dither-spread` times its depth (0 to 120ms) after the first, fading over `--dur-dither` (160ms), so the picture is done within 280ms, by opacity only. The sign-in screen and the people header stay still.
- **A new comment arrives.** A comment you post rises in 8px and fades in over 180ms (the `.arrive` class, `--dur-arrive`). A comment already in the thread when the page opens does not move.
- **A mention chip is picked.** When you pick a person, task or project with @ or #, a chip for it appears under the comment box and pops in from a scale of `--pop-scale-from` (0.8) with a fade, over `--dur-pop` (140ms). No overshoot. Chips already there when you edit a comment show at once.
- **Clickable text is hovered.** A text link or text button gets no underline and no fill behind it. The text turns the accent over `--dur-hover` (150ms) and reads a touch bolder from a hairline stroke (`--link-stroke`), so nothing reflows. Keyboard focus shows the same look. On touch screens there is no hover state.
- **A control is pressed.** A button scales to `--press-scale` (0.96) and a card to `--press-scale-card` (0.98) while it is held.
- **A focus ring appears.** The ring fades in its colour over `--dur-hover` (150ms), a named exception.
- **A fold opens.** A fold-out list (Done this week, Dropped, Completed tasks, Update log, History, Removed lines) opens its height on grid rows from `0fr` to `1fr` and fades in over `--dur-fold` (240ms), a named exception. Its chevron is a drawn arrow that turns 90 degrees by transform. A closed fold is inert, so it takes no tab stop. It closes the same way. When it opens past the bottom of the screen, the page then scrolls just enough to show it, and never takes its own button above the top bar. The scroll is smooth, and instant under reduced motion.
- **A checkpoint or ask is ticked.** The tick draws itself in the box, the same as a task (`--dur-draw-tick`).
- **A link or invite is copied.** The button says "Copied" for about 1.6 seconds, and a tick draws itself before the word over `--dur-draw-tick`.
- **A Roster row is edited.** An admin's Edit opens one window for name, job title, email and access (Active, Lead, Admin). Save closes it and a toast says "Saved" with the name.
- **The ledger ring draws in.** Beside the kept share on the ledger, a small ring draws its arc to the share (`stroke-dashoffset`, a named exception) over `--dur-draw` (480ms), once per session. Reduced motion and a repeat visit show it at once.
- **A line icon is hovered.** Nothing moves. The sidebar icons, Feedback and the help button stay still, since a redraw on hover replayed on every tab switch (the PM's call, 26 Oct). The help button is a drawn question mark, not a typed one.
- **An empty state shows.** Where an empty state has no picture, the page's own icon (search for no match, the calendar for nothing due, the speech bubble for no feedback) draws itself above the words over `--dur-draw` (480ms).
- **The sign-in page loads.** The Nicobar wordmark draws its letters' outlines over `--dur-draw`, and the filled letters fade in over its second half.
- **The status icon morphs.** When a status changes, the ring stays, the old glyph shrinks to half size and fades out while the new glyph pops in from a scale of 0.5, both over `--dur-glyph` (120ms). A tick draws its stroke as it arrives (`--dur-draw-tick`). It does not run on first render.
- **A confirmation appears.** A small bar at the foot of the screen fades in over `--dur-toast` (160ms), stays for `--dwell-confirm`, then fades out. It has `aria-live="polite"`. At most three show at once.
- **Sounds.** Off until a person turns on Sounds in the account menu (the `nd_sound` cookie). Three Web Audio tones, no files, each under 200ms and quiet: a soft ping for a new notice, a light tick for Done, a low tone for a refused action. None plays on page load. Reduced motion does not mute them, only the switch does (`components/sound.ts`).
- **A page loads.** `loading.tsx` shows a skeleton shaped like the real content, in `--skeleton-fill`. The fill is static. There is no shimmer.

Every duration and easing is a token in `web/app/tokens.css`. Under `prefers-reduced-motion: reduce` every duration above becomes 0 and the JS springs and count-ups do not run.

## Components

Each component lists its tokens, then the line it must pass before it ships.

**`top-bar`.** A 64px bar above the page with the search field in the middle and the help toggle.
Done when: search opens with `/` or Ctrl/Cmd+K from any page, and the bar holds no navigation words.

**`search-field`.** A pill-shaped field with a search icon and a key hint.
Done when: it finds tasks, projects, people and plan lines, and `Esc` closes it.

**`side-nav` / `nav-item` / `nav-item-on`.** The dark sidebar. Home (`/me`), Team (`/team`) and Projects (`/projects`) come first, each with an icon. A "More" group follows with Ledger, plus Reminders for leads and admins and Roster for admins. A "+ New task" button sits in the sidebar. The account menu is at the bottom. On a phone the sidebar becomes a sticky row at the top.
Done when: the current page is the only item with the raised fill and the edge mark, and each role sees only its own words.

**`line-row`.** Date block, what with its second line, one status chip and a flag when there is one.
Done when: every row shows what, by when and a status word, and a moved line shows its first date struck beside the new one.

**`date-block`.** Relative word on top in `{typography.date-xl}`, calendar date under it in `{typography.meta}`.
Done when: it is the largest text in its row, terracotta on open lines, red on late lines, and ink 3 on done lines.

**`status-*`.** One of five words: Not started, In progress, Blocked, Done, Dropped. Each chip has an icon. A person picks the status.
Done when: the five words are the only status words in the interface, and Dropped reads struck through.

**`flag-*`.** Late, At risk, Ahead and On time. The app works them out from dates. A person never picks one. Late is red, At risk is amber, and Ahead and On time are neutral. Each flag explains itself on hover or in help mode.
Done when: no screen lets a person set a flag, and On time is judged against the first due date.

**`waiting-card`.** The "Waiting on you" callout on Home. It lists tasks where someone else is blocked until you act, with a Done button on each row.
Done when: it sits above your task groups on Home at 1440 and 375, and it is absent when nothing waits on you.

**`card`.** White on paper, 12px radius, a hairline and a soft shadow. Project cards use 14px.
Done when: in day a card is white on paper, and in night it is one step lighter than the canvas.

**`button-primary` / `button-secondary`.** Terracotta fill for the one main action, outline (the ghost button) for the rest. A red variant marks a destructive action.
Done when: a screen has at most one primary button in view.

**`date-chip`.** Quick date choices beside a date field. The chosen one has a sunk fill.
Done when: a common date can be chosen in one tap on a phone.

**`initials-mark` / `initials-mark-you`.** Two letters in a 28px circle. The viewer's mark is terracotta on its soft tint.
Done when: every person on screen has a mark and a name, and the viewer reads "you".

**`switch-on`.** The visible off switch for anything automatic, such as Sounds in the account menu.
Done when: every automatic behaviour has one, next to what it controls.

**`confirmation`.** One sentence in a small bar at the foot of the screen, then gone.
Done when: it is announced politely to screen readers, and at most three show at once.

## Do's and Don'ts

Check every screen against this list before showing it. An element that breaks a rule gets fixed or cut, not argued for.

### Shape
1. **One shape, one meaning.** A pill is a status, a date choice or the search field. Buttons and fields are 8px rectangles. Cards are 12px, project cards 14px, flags 4px. No other radii.
2. **Little decoration.** Icons appear on the nav and on status chips, nowhere else. The only picture is the ordered dither in empty states, the sign-in screen and the people page header. An initials mark is the only other graphic.

### Type
3. **Dates are the largest text on a line,** in Inter 650 with tabular figures.
4. **No letter-spacing changes** except tightening dates, the page title and the wordmark, and the tracked capitals on flags.
5. **Few sizes.** Per screen, at most one date size, one title size and three text sizes.

### Colour
6. **One accent, plain meanings.** Terracotta is dates, the main button and you. Red is Late and the Blocked chip. Amber is At risk. The other status chips take their one fill each. Nothing else takes a colour. No gradients, no glows.

### Material
7. **One shadow per card,** and only on cards. Lines never get a shadow or a box.

### Motion
8. **Only the motions listed under Motion.** Feedback under 200ms, nothing past 300ms except the first-load stagger and the stroke draws (480ms at most), nothing loops. Reduced motion means instant.

### Copy
9. Plain words, sentence case (Title Case for form labels and form headings), the voice below. No em dashes, no eyebrows, no exclamation marks, no whimsy.

### Before showing
10. **Encode or cut.** Every element must answer "what does this tell the person about their week?" If nothing, remove it.
11. **Generic test.** Would this look the same on any other AI-made dashboard? If yes, it is not done.
12. **Remove one accessory.** Last pass, take one thing away.

## Voice

A colleague, not a mascot. Short, plain, first names, the viewer is "you". Verbs in the interface: add, update, move, done, block. Never renegotiate, outcome, event or approve. "Ledger" names one page and is not a word for body copy. "Send" appears only on the button that sends, and on the line that says nothing goes until you press it.

1. "Nothing on you today."
2. "Waiting on you."
3. "A teammate is waiting on this."
4. "Late by 2 days, no word yet."
5. "Moved: the store count changed."
6. "Who owns this, and by when?"
7. "You're clear. Nothing open on your side."

## Responsive Behavior

| Name | Width | Key changes |
|---|---|---|
| Desktop | Above 860px | The sidebar sits on the left. A page is one of two widths: the full page for tables and boards, the `calm` 980px column for everything else. |
| Phone | 860px and under | The sidebar becomes a sticky row at the top. One column. Controls grow to 40px. Home is designed at 375px. Team is readable, not designed. |

- **Phone order on Home:** the summary, the glance and the updates, then "Waiting on you", then your tasks. Something someone else is blocked on must not be missed.
- **Touch:** buttons are 36px tall on desktop and 40px at 860px and under. Plain links and the row opener are about 24px tall, and their hit area grows by 4px above and below on a phone. A few controls already reach 44px (`--touch-min` in `tokens.css`): the sign-in buttons, the guide note close button, the remove button on a list chip and some list rows. The goal is 44px for every control on a touch screen. That goal is open. See Known Gaps.
- **Keyboard:** the on-screen keyboard closes on a tap outside a field, on return or done, and on scroll. No field leaves it stuck open.
- **The top bar** is sticky on desktop and static on a phone. On Cool at desktop width, the page sheet is its own scroll area with no bounce, so its rounded corners hold. The top bar is an opaque cap in the sheet colour, so no row shows above or around the bar. The bar itself is a glass pill inside the cap, lined up with the page's own column: 980px on `calm` pages, the full page elsewhere. Content fades out over up to 16px as it goes under the cap, and does not fade while a sticky table head or group heading sits right under it. A new page starts at the top. On Warm and on a phone the window scrolls, as before.

## Iteration Guide

1. Change one component at a time and name it by its `components:` key.
2. A new value goes in the front matter and in `web/app/tokens.css` in the same commit.
3. Run `npx @google/design.md lint DESIGN.md` after every edit.
4. Run the app (`npm run dev --prefix web`, port 3100). Check `/team`, `/me` and a project page at desktop width and 375px, in day and night, before showing anyone. There is no `shots` script.
5. A new variant is a new component entry, with its own "done when" line.
6. Treat the terracotta as scarce. If a new thing wants a colour, it probably wants a word.

## Sources

The three ranked references from the handout, section 7. Take the mechanism, never the look.

| Reference | What it does well | What we take | What we leave |
|---|---|---|---|
| 1. Apple Reminders and Calendar | The date is read before anything else. Lists run top to bottom. One tap completes. Nothing to set up. | The relative date as the largest text on a line. Done in one tap. Empty states that give the good news. | iOS chrome, colour-coded lists, smart lists, the red badge for today. |
| 2. Linear and Things | A status is one word. Rows are dense but still breathe. The keyboard drives everything. | One-word statuses. The row rhythm. Single-key shortcuts. | Cycles, priorities, estimates, brand purple, the round checkboxes. |
| 3. Notion and Craft | Text turns into structure. A page prints clean. | Pasted minutes turn into proposed tasks beside the note. | Blank-canvas freedom, slash menus, nested pages, emoji icons, cover images. |

Mood page: `docs/design/moods.html`. A, B and C came from it. W, NicoWarm, is the default (see Skins).

## Skins

A skin is a block of token overrides in `web/app/tokens.css`, selected by `data-skin` on `<html>`. Each has a day set and a night set. Components read `var(--...)` only, so a skin never needs a component change.

Two skins are offered, at the PM's call (13 Oct): Warm and Cool. Each comes in Light and Dark, and anyone can pick either.

| Id | Name in the menu | Was | Type | Accent (day / night) | Shape |
|---|---|---|---|---|---|
| w | Warm (Default) | NicoWarm | Inter, Fraunces titles | `#b3522c` / `#e07b4f` | 8px controls, 12px cards, warm paper, dark sidebar |
| m | Cool | NicoOS | Geist and Geist Mono through `next/font/google`, the system face as the fallback | `#0062cc` / `#64a8ff` | 10px controls, 18px cards, 7px pills, grey window with white cards, translucent source-list sidebar (solid where blur is not supported), segmented pickers, Apple green and teal for done and ahead |

The token blocks for the retired skins (a NicoPlain, b NicoCalm, c NicoSoft, i NicoNote) are still in `tokens.css` but are not offered. The base `:root` values (once NicoPlain) stay, since W and M override them.

- The choice is stored in the cookie `nd_skin`. `layout.tsx` reads it on the server and sets `data-skin`, so there is no flash on reload. With no cookie, or an unknown value (including the retired `a`, `b`, `c` and `i`), the server sets `w`.
- The switcher is the Appearance row in the account menu (the button at the bottom left of the sidebar). Its items are Warm and Cool. The same flyout holds the Light and Dark choice. The closed row says "Default" on Warm and Light, and otherwise the skin picked ("Cool", or "Warm" on Dark). The list marks the default: "Warm (Default)" and "Cool". The search box also runs "Appearance: Warm", "Cool", "Light" and "Dark".
- Fonts load only through `next/font/google`. No font file is committed.
- Skin hooks, beyond colour and type: `--bar`, `--avatar-bg`, `--avatar-you-ring`, `--pill-ring`, `--callout-bg`, `--callout-line`, `--card-shadow`, `--row-pad`, `--font-date`, `--skeleton-fill`, `--toast-bg`, `--toast-ink`.
- Text contrast. NicoWarm was measured again on 13 Oct, from the current hex values in `tokens.css`, with the WCAG relative-luminance formula. Cool (NicoOS) was not measured since 12 Oct, so its ratios are not stated here.
  - NicoWarm day: ink on canvas 15.19, ink 2 on canvas 5.00, ink 3 on canvas 4.50, terracotta on canvas 4.52, on surface 5.05, white on terracotta 5.05, Late red on canvas 5.03, At risk amber on canvas 5.19. Late red on its soft fill is 4.64 and amber on its soft fill is 4.94. The five status chips run from 5.38 to 6.92. The sidebar text runs from 5.79 to 13.42.
  - NicoWarm night: ink on canvas 15.46, ink 2 on canvas 6.86, terracotta on canvas 6.39, dark text on terracotta 5.94, red on canvas 6.48, amber on canvas 9.00. The status chips run from 6.72 to 7.88. The lowest night pair is red on its soft fill, 5.18.
  - Below 4.5 in day, and still to review where they are used for small text: terracotta on its soft tint (the viewer's initials mark) 4.15, ink 2 on the pill grey 4.30 and ink 3 on the pill grey 3.87.
- Light is the default for everyone (the PM's call, 13 Oct), whatever the system setting. The Appearance flyout offers Light and Dark, kept in the cookie `nd_theme` (one year). `layout.tsx` reads it and always sets `data-theme="light"` or `"dark"` on `<html>` on the server, so there is no flash and the OS setting never overrides the pick. With no cookie, or any other value (including the retired `system`), the page is light. Warm and Cool each have a day block and a night block.

### NicoWarm, the default skin

The pilot team built its own version of this tool, and that build used a warm look: paper ground, one terracotta accent, a dark sidebar and a serif for headings. The pilot team asked for nico-desk to match it, so W is the default and Cool stays one click away in the menu. W starts from the team's own values (paper `#f5f2ec`, ink `#1f1c18`, the dark sidebar `#1e1b17`, border `#e8e2d6`) and keeps the rules above: one accent for dates and the viewer, red for late, amber for at risk, chips for status. Some values were darkened so they read as text. The accent is now `#b3522c` (the team's own was `#b5532c`, which the logo tile and the current-page edge still use). The Late red is `#b83d27` and the At risk amber is `#8c5b14`. The team's lighter grey `#9a9284` is not used for text, and the team's purple, green and navy ledger bars have no token here. Titles (page title, ask title, stat numbers, the wordmark) use Fraunces through `next/font/google`, scoped to W by `--font-serif`. Body, dates and buttons use Inter. The sidebar is dark in day and night, set by re-pointing the colour tokens on `.side` in `tokens.css`, so no component changes.

## Keyboard

`/` or Ctrl/Cmd+K focuses the search. `n` opens New task. `?` lists the shortcuts. `Esc` closes a panel, a menu or the search. Keys are ignored while a field has focus. Every control shows a focus ring from `--ring-width`, `--ring-color` and `--ring-offset`.

## Known Gaps

- The founder's four-week record across teams is specified but not yet drawn.
- Print styles for the record are untested on paper.
- Night values are set but not yet reviewed on a real screen in a dark room.
- The phone layout of Team is readable but not designed.
- Error states exist as `web/app/error.tsx` and `web/app/not-found.tsx`. They have not yet been checked in a browser.
- Touch targets: the goal is 44px for every control. Buttons are 36px (40px on a phone), and plain links are about 24px. This is open.
- Contrast: only NicoWarm was measured again, on 13 Oct. Cool (NicoOS) was last measured on 12 Oct. The three NicoWarm day pairs below 4.5 (see Skins) need a review.
- The first design had an as-of scrubber, a Friday note, draft lines that light their source sentence, an Asks page and a commit field. None of these is in the app, so this file no longer describes them.
