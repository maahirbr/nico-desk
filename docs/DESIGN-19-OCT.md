# Design: the setup check-list and the run-the-meeting view

Status: draft, 19 Oct. For review by the repo owner before anything is built.
The build plan, the gates and the rules are in `docs/PLAN-19-OCT.md`. This file is only how the two features look,
read and move.

`DESIGN.md` outranks this file. Every value below is a token that already exists in `web/app/tokens.css`. If a build
needs a new value, it goes into `DESIGN.md` and `tokens.css` in the same commit, never only here.

The examples use the synthetic fixture project `prj_landing` ("Autumn landing page") and its fixture people. The
agenda text is what `meetingAgenda` returns for it today.

## What each surface is for

- **The setup check-list** answers one question for a new lead: "What is left before this project is ready for its
  first meeting?" It is a short list that empties itself. It is not a tour and not a wizard.
- **The run-the-meeting view** answers: "What do we talk about next, and what did we decide?" The lead keeps it on a
  shared screen or a laptop in the room. One item has the focus at a time, so the room reads the same line.

Both pass the "encode or cut" test in DESIGN.md: each row says something about this project's week. Anything that does
not is cut.

## 1. The setup check-list

### Where it sits

On the project page, between the header (people, stat cards) and the board heading "Tasks" or "Plan". It is the same
width as the board. Only the project's owner, its lead, a team lead and an admin see it.

### Desktop, part done

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Set up this project                                                    2 of 4 done  │
│                                                                                      │
│  ✓  Add the people who work on it                                                    │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  ✓  Add the first tasks                                                              │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  ○  Set when the team meets                                   [ Set the rhythm ]     │  <- primary (first open step)
│     A rhythm gives the project a next meeting date and an agenda.                    │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│  ○  Bring in the first minutes                                [ Import minutes ]     │  <- outline
│                                                                                      │
│  Hide this list                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Card:** `card` component. `--surface` on `--canvas`, `--radius-card` (12px), `--card-pad` (20px),
  `--card-shadow`. Night drops the shadow, as every card does.
- **Heading:** "Set up this project" in `--type-heading` (16/600). No eyebrow above it.
- **Count:** "2 of 4 done" in `--type-small`, `--ink-2`, right aligned on the heading line, tabular figures.
- **Rows:** 12px top and bottom, a `--hairline` rule between rows, none after the last.
  - The mark is a 16px circle in `--line-strong`. When done, it fills with `--ink-2` and a tick draws in it.
  - The words are in `--type-line` (14.5/500), `--ink`.
  - Only the first open step shows a hint line, in `--type-meta`, `--ink-2`. The others stay one line, so the card
    stays short.
- **Done rows:** the words turn `--ink-2`. They are not struck through, since strike-through means Dropped in this app.
  They keep no button.
- **Buttons:** the first open step has the one primary button (`button-primary`). Every other open step has an outline
  button (`button-secondary`).
  - The board's "+ Add task" button is also primary. To keep one primary in view, the board's button turns outline
    while the list is showing and has an open step.
- **Hide this list:** a text button in `--type-small`, `--ink-2`, bottom left. It uses the link hover in DESIGN.md
  Motion. It shows no confirm. The project Settings modal gets "Show the setup list" to bring it back.

### The step words

| Step | Words | Hint (first open step only) | Button |
|---|---|---|---|
| members | Add the people who work on it | Members see the project and get its tasks. | Add people |
| work (tasks) | Add the first tasks | Each task has one owner and a date. | Add a task |
| work (plan) | Add the first lines | A line is one piece of the plan with a date. | Add a line |
| rhythm | Set when the team meets | A rhythm gives the project a next meeting date and an agenda. | Set the rhythm |
| minutes | Bring in the first minutes | Paste notes or pick them from a connected note-taker. The app turns them into tasks for you to check. | Import minutes |
| partner (plan) | Name the partner | The partner's people show beside yours on the plan. | Name the partner |

The rhythm step shows only if gate G1 is a yes (see the plan).

### States

- **First visit, nothing done:** "0 of 4 done". The first row carries the hint and the primary button.
- **A step is done in another part of the page:** the mark fills and the tick draws over `--dur-draw-tick`. The count
  updates. The hint and the primary button move to the next open step with `fadeShift`. Nothing jumps: the row heights
  stay the same, except the hint line, which folds with `--dur-fold`.
- **All done:** the heading reads "Ready for the first meeting." for `--dwell-confirm`. Then the card folds away
  (`--dur-fold`, height and opacity, the named exception for a fold). It does not come back.
- **Hidden:** gone for this person, on this project, in this browser.
- **View as:** shown as the viewed person sees it, with no buttons and no "Hide this list".
- **Reduced motion:** every tick, fold and shift is instant.

### Phone (375px)

```
┌───────────────────────────────────┐
│ Set up this project    2 of 4 done│
│                                   │
│ ✓ Add the people who work on it   │
│ ───────────────────────────────── │
│ ✓ Add the first tasks             │
│ ───────────────────────────────── │
│ ○ Set when the team meets         │
│   A rhythm gives the project a    │
│   next meeting date and an agenda.│
│ ┌───────────────────────────────┐ │
│ │        Set the rhythm         │ │  <- full width, 40px
│ └───────────────────────────────┘ │
│ ───────────────────────────────── │
│ ○ Bring in the first minutes      │
│ ┌───────────────────────────────┐ │
│ │        Import minutes         │ │
│ └───────────────────────────────┘ │
│                                   │
│ Hide this list                    │
└───────────────────────────────────┘
```

- The button drops under the words, full width, 40px tall.
- "Hide this list" grows its hit area to 44px (`--touch-min`).

## 2. The run-the-meeting view

### How a lead gets there

- The project header gets an outline button "Run the meeting", beside Settings. It shows to people who pass
  `mayRunMeeting`.
- On the day of the next meeting (`meet_next` is today), the project header's meta line adds "Meeting today" in
  `--primary`. Dates and "you" are what terracotta is for, so this fits.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Autumn landing page                                                                             │
│                                                                                                   │
│ Weekly meeting, Mon 19 Oct                                              [ End the meeting ]      │
│ Next one Mon 26 Oct · 7 to talk about                                                             │
│                                                                                                   │
│ ┌────────────────────────┐  ┌──────────────────────────────────────────────────────────────────┐ │
│ │ LATE                 4 │  │                                                                  │ │
│ │ ▸ Fix form error me…   │  │  6 days late                                                     │ │
│ │   Sign off sign-up f…  │  │  13 Oct                                                          │ │
│ │   Review landing pag…  │  │                                                                  │ │
│ │   Run landing page l…  │  │  Fix form error messages                                         │ │
│ │                        │  │  Kabir Sethi · Blocked on Meera Iyer                             │ │
│ │ BLOCKED              1 │  │  “Need the final error wording signed off before I can change   │ │
│ │   Update site footer…  │  │   the text.”                                                     │ │
│ │                        │  │                                                                  │ │
│ │ DUE IN 7 DAYS        2 │  │  [ Done ]  [ Move the date ]  [ Unblock ]          [ Next  → ]   │ │
│ │   Final tier names f…  │  │                                                                  │ │
│ │   Build the festive …  │  └──────────────────────────────────────────────────────────────────┘ │
│ │                        │                                                                       │
│ │ CHANGED THIS WEEK    3 │  Up next                                                              │
│ │ FINISHED THIS WEEK   2 │  Sign off sign-up form error wording · Meera Iyer · 5 days late       │
│ │                        │                                                                       │
│ │ NEW BUSINESS           │  This meeting                                                         │
│ │ END                    │  Nothing changed yet.                                                 │
│ └────────────────────────┘                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Three parts, top to bottom on the left and right:

1. **The meeting head.**
   - A back link to the project, as on other pages.
   - The title "Weekly meeting, Mon 19 Oct" in `--type-page-title` (Fraunces on Warm). The rhythm word comes from
     `meetsWords`. With no rhythm set, the title is "Meeting, Mon 19 Oct".
   - The meta line in `--type-meta`, `--ink-2`: the next date and how many items have actions.
   - "End the meeting" is an outline button. It jumps to the End step. It does not mark the meeting held.
2. **The agenda rail** (left, 260px, sticky under the top bar).
   - Section headers in tracked caps, `--type-state`, `--ink-2`, with the count on the right. They label a
     compartment of the page, so they are section headers, not eyebrows.
   - Item rows are one line, `--type-meta`, truncated with an ellipsis. The full title is in the `title` attribute
     and the accessible name.
   - The focused item has `--sunk` behind it and a 2px `--primary` mark on its left edge, the same edge mark as
     `nav-item-on`.
   - A handled item gets a small tick before it and turns `--ink-2`.
   - "Changed this week" and "Finished this week" are read-only. They are folded to their header and count, and open
     with the fold motion.
   - "New business" and "End" are the last two rows, always present.
   - Clicking any row moves the focus there. Nothing has to be taken in order.
3. **The focus card** (right, the rest of the width).
   - A `card` with `--card-pad`.
   - The `date-block`: the relative word ("6 days late", "Due Wed", "Due in 4 days") in `--type-date-xl`, and the
     calendar date under it in `--type-meta`. Red (`--late`) for late, `--primary` for open, `--ink-3` for done.
   - The title in `--type-ask-title` (21px Fraunces on Warm). This is the one title size on the screen.
   - The meta line: the owner's `initials-mark` and name, then flags and the block in `--type-meta`. The ask that
     blocks the task is quoted below in `--type-body`, `--ink-2`.
   - The action row: outline buttons on the left, "Next" on the right. The focus card holds no primary button. The
     only primary on this screen is "Meeting held" in the End step, so the room never wonders which button matters.
   - Below the card: "Up next", one line about the next item, `--type-meta`, `--ink-2`. Then "This meeting", the
     running list of what changed (see below).

### The actions, per item

| Item | Buttons, in order | Key |
|---|---|---|
| Late, at risk or due-soon task | Done · Move the date · Block · Next | d · m · b · j |
| Blocked task | Done · Move the date · Unblock · Next | d · m · b · j |
| Plan line | Set the status · Move the date · Next | s · m · j |
| Ask | Done · Next | d · j |
| Action | Done · Next | d · j |
| Changed, finished | Next | j |

- `k` goes back one item. `a` opens "Add an action" from anywhere. `Esc` closes a form.
- Each button shows its key on hover and in help mode, as a small `--type-small` key cap. The key caps are not shown
  otherwise. That keeps the room view calm.
- Buttons the person may not use are not shown. If none are left, the card says "Only the owner or a lead can change
  this." in `--type-meta`, `--ink-2`, and "Next" stays.

### What each action looks like

**Done.**
1. The button press scales to `--press-scale`.
2. The status chip on the card morphs to Done (the DESIGN.md glyph morph), and the tick draws.
3. After `--dwell-confirm`, the focus moves to the next item with `fadeShift`.
4. A confirmation bar says "Done: Fix form error messages." with Undo, under the `canUndo` rules.
5. The rail row gets its tick.

**Move the date.** A `Modal` (`modalMotion`), titled "Move the date".

```
┌─────────────────────────────────────────────┐
│ Move the date                               │
│                                             │
│ New Date                                    │
│ [ 23 Oct          ]  (Fri) (Mon) (+1 week)  │  <- date-chip choices
│                                             │
│ Why It Moved                                │
│ [ Waiting on the legal wording            ] │
│                                             │
│ Everyone on the project sees the reason.    │
│                                             │
│                     [ Cancel ]  [ Move it ] │  <- primary inside the modal
└─────────────────────────────────────────────┘
```

- The fields follow DESIGN.md: 16px inputs (`--type-input`), labels in Title Case (`--type-label`).
- The reason is required. "Move it" stays disabled until the reason has three characters.
- Return in the reason field submits and closes the keyboard.
- The confirmation reads "Moved to 23 Oct: Waiting on the legal wording."

**Block.** The same modal shape, titled "Block". The fields are "Waiting On" (a person picker, optional, never the
owner) and "What Is Needed" (required, 280 characters). The confirmation reads "Blocked: waiting on the legal
wording." Unblock has no modal. It acts at once and offers Undo.

**Set the status (plan line).** A popover with the five status words, from the control (`popoverMotion`). Blocked and
Not started ask for a reason in a second step, as on the plan board.

### New business

The rail row "New business" moves the focus card to the add form. `a` opens it from anywhere.

```
┌──────────────────────────────────────────────────────────────────┐
│  Add an action                                                    │
│                                                                   │
│  What                                                             │
│  [ Send the festive banner sizes to the partner                ] │
│                                                                   │
│  Owner                          Due                               │
│  [ Priya Menon         ▾ ]      [ 23 Oct   ]  (Fri) (Mon)         │
│                                                                   │
│                                              [ Add the action ]   │
│                                                                   │
│  Added in this meeting                                            │
│  Send the festive banner sizes to the partner · Priya · 23 Oct    │
└──────────────────────────────────────────────────────────────────┘
```

- "Add the action" is the only primary in view while this card shows. On a task board it makes a task. On a plan
  board it makes an action under "Other actions", or under a line if one is picked in an optional "Line" field.
- After adding, the form clears and keeps the focus in "What", so the lead can add the next one at once.
- The owner list shows the project's people first, then a rule, then the rest of the team.
- Each added action shows under "Added in this meeting" with `fadeShift`.

### The End step

```
┌──────────────────────────────────────────────────────────────────┐
│  End the meeting                                                  │
│                                                                   │
│  In this meeting                                                  │
│  ✓ Done      Fix form error messages                              │
│  → Moved     Run landing page link check to 23 Oct                │
│               “Staging is back, the check starts Monday.”         │
│  ⏸ Blocked   Update site footer links                             │
│  + Added     Send the festive banner sizes to the partner         │
│                                                                   │
│  Not talked about: 3 items.                                       │
│                                                                   │
│  Next meeting  Mon 26 Oct                                         │
│                                                                   │
│  [ Copy the notes ]                         [ Meeting held ]      │
└──────────────────────────────────────────────────────────────────┘
```

- The list is the session list: what changed in this meeting, in the order it happened. The verb column is in
  `--type-state`, `--ink-2`. Each verb has its status icon, as on chips. No new colours.
- "Not talked about" counts items the focus never reached. It is a fact, not a warning, so it stays `--ink-2`.
- "Next meeting" shows the date `nextAfterHeld` will set, in `--primary`.
- "Meeting held" is the screen's one primary. After it, the button reads "Held" with the drawn tick, and the project
  header's next date updates.
- "Copy the notes" is outline. It copies plain text and says "Copied" with the drawn tick for about 1.6 seconds, as
  DESIGN.md sets for copy buttons. A line under it reads "Nothing is sent. Paste the notes where your team reads them."
- If the page was reloaded during the meeting, a line in `--type-small` reads "Changes made before the reload are
  saved, but are not listed here."

### Phone (375px)

```
┌───────────────────────────────────┐
│ ← Autumn landing page             │
│ Weekly meeting, Mon 19 Oct        │
│ Next one Mon 26 Oct               │
│                                   │
│ Late · 1 of 4          [Agenda ▾] │  <- opens the rail as a sheet
│ ┌───────────────────────────────┐ │
│ │ 6 days late                   │ │
│ │ 13 Oct                        │ │
│ │                               │ │
│ │ Fix form error messages       │ │
│ │ KS Kabir Sethi                │ │
│ │ Blocked on Meera Iyer         │ │
│ │ “Need the final error wording │ │
│ │  signed off before I can      │ │
│ │  change the text.”            │ │
│ └───────────────────────────────┘ │
│                                   │
│ Up next                           │
│ Sign off sign-up form error…      │
│                                   │
├───────────────────────────────────┤
│ [ Done ] [ Move ] [ Unblock ]     │  <- sticky action bar, 40px buttons
│ [ ←  ]              [ Next  → ]   │
└───────────────────────────────────┘
```

- The rail becomes a sheet (`sheetMotion` with `scrimMotion`), opened by "Agenda". Picking a row closes the sheet and
  moves the focus.
- The position line "Late · 1 of 4" sits above the card in `--type-small`. It is a position, not a kicker, and it
  sits beside the Agenda button, not over the title.
- The action bar is sticky at the foot of the screen, on `--surface` with a `--hairline` top rule. Buttons are 40px.
  "Move the date" shortens to "Move" here only.
- A swipe does not change items. Only the buttons do. A swipe on a shared phone moves too easily.
- When a modal field has focus, the sticky bar hides, so the keyboard and the bar never stack.

### Read-only and empty states

- **Read only** (a member, a viewer, or View as): the same page with no action buttons, no "New business" form and no
  "Meeting held". The focus card's action row shows only Previous and Next. The head says "You can follow the agenda.
  Only the project's owner or lead runs it." in `--type-meta`.
- **Nothing on the agenda:** the focus card shows the page's calendar icon drawing in (the DESIGN.md empty state
  motion) and "Nothing late, blocked or due before the next meeting." The rail goes straight to New business.
- **No rhythm set:** the meeting still runs. The End step says "No rhythm set, so no next date." with a text button
  "Set the rhythm".
- **Held today already:** the End step shows "Held today." and no button. The rest of the page still works.
- **A write fails:** the action button returns to normal. A confirmation bar says what failed in plain words, from
  the API error message. The focus does not move.

## Motion summary

| Moment | Motion | Token |
|---|---|---|
| A setup step ticks | Tick draws, count changes | `--dur-draw-tick` |
| The hint moves to the next step | Fold and `fadeShift` | `--dur-fold` |
| The list completes | Dwell, then fold away | `--dwell-confirm`, `--dur-fold` |
| Focus moves to another item | Card content cross-fades with a 4px shift | `fadeShift`, under 200ms |
| Done on an item | Glyph morph, tick, dwell, move on | `--dur-glyph`, `--dur-draw-tick`, `--dwell-confirm` |
| Move or Block opens | Dialog | `modalMotion` |
| Agenda sheet on a phone | Sheet and scrim | `sheetMotion`, `scrimMotion` |
| Confirmation | Foot bar | `--dur-toast`, `--dwell-confirm` |

Nothing else moves. Under reduced motion, every row above is instant.

## Words

- Verbs on buttons: Done, Move the date, Block, Unblock, Set the status, Next, Add the action, Meeting held, Copy the
  notes, End the meeting, Run the meeting, Hide this list.
- Never: renegotiate, outcome, event, approve, sync, standup, wizard, onboarding, "Let's", "Great job", exclamation
  marks, em dashes.
- The viewer is "you". Other people go by first name in confirmations and by full name on the card.
- Help terms (`components/help.ts`):
  - `setup_list`: "The few things a new project needs before its first meeting. Each step ticks itself when it is
    done."
  - `meeting_run`: "Walks the agenda one item at a time. Each change is saved as you make it, the same as on the
    board."
  - `meeting_new_business`: "Actions agreed in the meeting. Each gets an owner and a date."
  - `meeting_notes`: "A plain text list of what changed in this meeting. Nothing is sent."

## Access and keyboard

- The rail is a `nav` with `aria-label="Agenda"`. The focused row has `aria-current="true"`.
- The focus card is a region with `aria-live="polite"`, so a screen reader hears the new item when the focus moves.
- Every control shows the focus ring (`--ring-width`, `--ring-color`, `--ring-offset`).
- The single-key shortcuts follow the rules in `components/keys.ts`: ignored while typing and inside a modal. They are
  listed in `SHORTCUTS`, so the `?` pop-up and the Guide show them.
- The mobile keyboard rule: a tap outside a field, return, or a scroll closes the keyboard (`KeyboardDismiss`).

## Before it ships (check in the browser)

At 1440px and 375px, in Warm and Cool, day and night:

1. A new project as the lead: the list shows, each step ticks, the list folds away. Only one primary button is in
   view at any time.
2. The same project as a member: no list.
3. `/projects/prj_landing/meeting`: walk all items with the keys, mark one Done and undo it, move one with a reason,
   block one, add two actions, end the meeting, copy the notes.
4. `/projects/prj_studio/meeting`: set a line's status, tick an ask, add an action under a line.
5. On a phone: open the Agenda sheet, move an item, check that the keyboard closes after the reason field.
6. View as a member: no buttons on either surface.
7. Reduced motion on: nothing animates.
