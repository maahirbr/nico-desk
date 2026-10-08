# What the OKR page already gives nico-desk

Source: `~/Code/Nicobar work` (read 5 Oct 2026 by a Sonnet 5.5 subagent). `CLAUDE.md` DECISIONS were read from the Sep 2026 entries only. No real data was copied.

## What exists

**Data contract.** `web/lib/types.ts` defines one `Bundle`: forums, metrics, initiatives, actions, people, and optional tags, org and matrix.

- `Action` is the closest thing to a task. It has owners, deadline, status, RAG, a reason, the latest update and a trail across meetings.
- `Tag` models an "@ask" on a row. It is a stub. Nothing delivers it.
- `Person` has counts and forums. It has no role and no email.

**Views.** All read the same bundle.

- `/sheet`: one claim at a time, the check-in ritual.
- `/table`: every row, click-to-edit, held in the browser.
- `/dashboard`: the org scorecard.
- `/v3`: five tabs (home, goals, checkin, forum, mobile). Likely the keeper. Mobile is pending.
- `/preread/[forum]`: the generated meeting pre-read.
- A FIND palette and a `?as=Name` person picker run across every screen.

**Automation.**

- Pre-read generator (`web/lib/preread/`). Sections 1 and 2 are a checked join. Sections 3 and 4 are model-written. Versions are append-only.
- Daily cron gatekeeper (`web/app/api/cron/gatekeeper`).
- Design only, not built (`docs/PREREAD-AUTOMATION-ARCHITECTURE.md`): Google Calendar as schedule and roster, a "who has not filed" check, and 72-hour reminders.

**UI.** `docs/SHEET-SPEC.md` is the locked spec. Zero radius, tracked-caps underlined controls, Euclid Flex and Geist Mono, day and night grounds, RAG colours always paired with a word, no eyebrows. Tokens are in `web/app/globals.css`. Atoms are in `web/components/ui/` and `web/components/sheet/`. Guards: `tools/lint_rules.py`, `tools/check_contrast.py`, `tools/check_hydration.mjs`.

## What is missing for a hub

| Need | State in the OKR page |
|---|---|
| Backend | None. Reads come from a JSON file. Writes stay in the browser. Only the pre-read store persists. |
| Auth | None. `?as=` is a URL selector. Google sign-in is planned. Seam: `resolvePerson` in `web/lib/selectors.ts`. |
| Tasks and owners | `Action` is derived and read-only. No create, assign or comment. No task outside OKR forums. |
| Projects and what changed | None. Initiatives are workbook rows with a weekly RAG. No change log. |
| Meetings | A schedule fixture with invented dates, and the pre-read. No minutes intake. No attendee roster. |
| Notifications | None. Tags are never delivered. |

## Reusable pieces

Base path: `~/Code/Nicobar work/`.

- Contract and selectors: `web/lib/types.ts`, `loadBundle.ts`, `selectors.ts`, `claims.ts`, `doors.ts`, `filed.ts`, `tagging.ts`.
- Backend seams: `web/lib/loadBundle.ts`, `web/lib/schedule.ts`, `web/lib/preread/store.ts`.
- Synthetic fixture tooling: `tools/make_fixture.py`. Do not copy `web/fixtures/demo.bundle.json`: it holds one real slice.
- UI: `web/components/ui/`, `web/components/sheet/`, `web/components/v3/`, `web/components/table/DataTable.tsx`, `web/components/find/Find.tsx`.
- Charts: `web/components/dither-kit/`. Edit `palette.ts` only.
- Fonts: `web/public/fonts/`. Euclid Flex has no licence file. Internal use only.

## What this means for the hub

- Reuse the tokens and `components/ui` atoms. Do not start a new visual language.
- A task and project store is new work. Follow the append-only pattern in `preread/store.ts`.
- Calendar as roster is the best unbuilt lead for meetings. It needs access from the tracker owner.
- The tracker owner's tracker (Granola to Sheets to APPROVED to email) is an Apps Script that is not in the repo. The hub can only read its output.
- Keep the rule "no invented numbers" on every new surface.
