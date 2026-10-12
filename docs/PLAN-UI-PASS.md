# Plan: UI and ease-of-use pass

Status: approved by the repo owner (12 Oct). Runs only after the PM's evening work is merged and pushed.
Work happens on `maahir/mvp`, one worktree per workstream, Sonnet agents, merged in the order below.

## Decisions taken (Q&A, 12 Oct)

- Reminders stay drafts in the lead's own Gmail. The app never sends.
- Motion sits between subtle and rich: purposeful movement everywhere, a few visuals where they help.
- "Accessibility" means everyday ease of use (section 7), not only a11y compliance.
- Connected: people pages, links on tasks, everything cross-links. No live sheet numbers.

## Assumptions (confirmed 12 Oct)

1. "motionsvg" means the Motion library (`motion`, formerly Framer Motion) plus animated SVG icons. It is a new dependency.
2. DitherKit gets checked first (what it is, licence, size). If it does not fit, a small canvas dither of our own does the same job.
3. The `?` key opens the shortcut sheet today. It will toggle help mode instead, and the shortcut sheet moves inside help mode.

## Order and why

Shared pieces first, so later work uses them and agents do not collide.

| # | Workstream | Depends on | Touches |
|---|---|---|---|
| 1 | Foundations: status colours, custom Select, Motion setup | none | `tokens.css`, `components/` |
| 2 | Help mode (`?`) | 1 | layout, every page with terms |
| 3 | Connected: people pages, task links, cross-links | 1 | schema, service, pages |
| 4 | Motion and visuals | 1, 3 | layout, nav, pages |
| 5 | Reminders: daily job, clearer sender | none | API route, `vercel.json` |
| 6 | Ease-of-use features (picked from section 7) | 1 to 4 | varies |
| 8 | Mac and Ink skins redone properly | 1 | `tokens.css`, skin-scoped rules, maybe layout chrome |

1 and 5 can run at the same time. 2 and 3 can run at the same time after 1.

## 1. Foundations

- **Status colours.** One token pair per status in every skin, day and night: Not started grey, In progress blue,
  Blocked red, Done green, Dropped muted with a strike. Each status also gets an icon (circle, half circle, bar, tick,
  cross), so it reads without colour. The late and at-risk flags keep their own style, separate from status.
  AA in all six skins.
- **Custom Select.** One `Select` component replaces every native `<select>` and the status dropdowns. It has a popover
  styled from tokens, arrow keys, Enter, Esc and type-to-find. At 375px it opens as a bottom sheet. It follows
  the keyboard rule. A matching date picker adds Today, Tomorrow, Friday and Next Monday shortcuts.
- **Motion setup.** Add `motion`. `components/motion.ts` keeps the three gestures and gains shared presets. Everything
  stops under reduced motion.

## 2. Help mode

- A `?` button in the top bar turns help mode on or off. The state lives in a cookie, like the skin.
- When on, explained items get a dotted underline. Hover, focus or tap shows a short tooltip in plain words.
- Covered terms: each status, late, at risk, flagged early, missed, on-time record, ledger tiles, moved date,
  blocked on, project lead, view as, the reminder buttons.
- All help text lives in one file (`components/help.ts`), so it is easy to edit.

## 3. Connected

- **People pages** `/people/[id]`: open work by project, waiting on them and waiting on others, recent updates,
  on-time record, projects. Every name and avatar in the app links there.
- **Links on tasks.** A task can carry links (Docs, Sheets, Figma, decks, any URL). They show as chips with the site icon
  on the row, in the drawer and on the project page. Needs a `task_links` table. The live database change is a script
  the repo owner runs.
- **Cross-links.** Project, person, task, minutes and ledger rows all link to each other. The task drawer gets a URL
  (`?task=…`) so a task can be shared. No dead-end text.

## 4. Motion and visuals

- Tab and nav switches: the underline slides, and the content cross-fades with a small shift.
- Drawers and sheets spring in. Popovers scale from where they opened.
- Lists stagger in on first load only. A status change morphs the chip colour and icon.
- Done gets a short tick draw (animated SVG). Ledger numbers count up once.
- Dithered images only in empty states, the sign-in screen and the people page header. Each one is tinted from skin tokens.
- Rule: nothing moves without a reason. No looping animation. No animation over 300ms except the first-load stagger.

## 5. Reminders

- Turn the daily 09:00 IST notice job back on through a Vercel cron. The route also accepts Vercel's `CRON_SECRET`.
  It only creates in-app notices. It never wipes or sends anything.
- The Reminders page says plainly: "Opens a draft in your Gmail, from your address. You press Send."
- Optional: a Monday digest draft per person, also opened in the lead's Gmail.

## 6. Leftovers from the flow test

- Close or archive a project.
- Tell the previous owner when a task is reassigned away.
- Home: the empty gutter where the checkbox hides while viewing as someone else.
- Check the view-as banner contrast in the Mac and Ink skins.

## 7. Ease-of-use features

Approved (12 Oct):

- **Undo** on every change, in the toast, for 6 seconds.
- **Quick add.** Type "Send deck to vendor fri @owner #project" and the app fills the fields. Every field stays editable before save.
- **Date shortcuts** everywhere a date is picked (in workstream 1).
- **Remember my view.** Each page keeps its last filter, sort and tab.
- **Copy link** to any task, person or project.
- **Since you last looked.** New and changed items get a small dot until seen.

Also worth a look (not approved yet):

- Select several tasks, then mark them done or move their dates together.
- Snooze an update for a day.
- Add due dates to your calendar (an `.ics` link per person).
- Autosave drafts in the new task form.
- A text size setting in the avatar menu.
- Empty states that say the next step, not just "nothing here".

## 8. Mac and Ink, redone

The repo owner's verdict on the first pass (12 Oct): both are lazy token swaps. Mac does not read as liquid, minimal macOS,
and Ink does not read as Craft or Notion. A skin can change more than colours: material, depth, chrome, radius, spacing,
type scale and motion.

- **Mac (liquid, minimal macOS).** Translucent sidebar and toolbar (backdrop blur and saturation over a soft wallpaper tint),
  glass popovers and sheets with a hairline inner light edge, large continuous radii, SF-style type scale with tight
  headings, grouped inset lists, segmented controls that slide, the traffic-light quiet of macOS chrome. A solid fallback
  where blur is not supported, and AA on top of the glass, not just on the base.
- **Ink (Craft and Notion).** Paper-white page, a centred reading column, generous line height, large quiet page titles,
  block-style rows with a hover handle, toggles and callouts, soft grey sidebar, emoji or icon per project, cards with
  Craft's soft shadow and roundness. Content first, chrome almost gone.
- **Method.** Screenshot reference screens of each product first and list the specific traits to copy. Build each skin
  against that list, then compare side by side at desktop and 375px, day and night. The repo owner signs off on
  screenshots before merge.
- Runs after workstream 1, so the custom Select, status colours and motion presets get each skin's look too.

## Checks for every workstream

- VERIFY from `CLAUDE.md` green, with new tests for new rules.
- Browser check at desktop and 375px, day and night, in skins W, Mac and Ink at least.
- AA contrast for every new colour pair in all six skins.
- The keyboard rule for every new field.
- No real names or projects in repo files.
- A DECISIONS entry with a rollback line for each merged workstream.

## 9. Later: invite a user

Asked for by the PM on 12 Oct. An admin adds a person (name, email, role) from the roster page, and the app sends
them an invite email with the sign-in link. Today a new person needs a database script.

- Blocked on a mail sender. Ask the tech team which email service the company already sends through and for an API
  key, or check whether a Resend account exists. The key goes only in Vercel env, never in the repo.
- This is the first thing the app would send itself. It sends only to the person being invited, only when an admin
  presses Invite. Reminders stay Gmail drafts.
- Until then: an admin adds the person, and the app shows a "Copy invite" text with the site link to paste anywhere.
