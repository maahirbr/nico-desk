# Project visibility: the plan (13 Oct, built the same day)

## As built

The plan below was built on 13 Oct, with these differences:

- The flag is `people.restricted`, not `team_members.restricted`. An admin sets it on the Roster.
- Viewers are a new `project_viewers(project_id, person_id, added_by)` table, not `project_members.access`.
  `updateProject` re-inserts members, so a separate table keeps viewer rows safe. The project's Settings
  has a "Can also view" field.
- `lib/sight.ts` (`sightOf`, `seesProject`, `seesTask`) and `lib/visibility.ts` (`seenTasks`, `seenProjects`,
  `taskFor`, `projectFor`) hold the rule. Pages and routes read through them. A test bans `teamTasks` and
  `teamProjects` in `app/` and `components/`.
- A task with no project is visible to a restricted person only when they own it, created it or it is
  blocked on them.
- An inactive person, or someone not on the team, sees nothing.
- `maskDictFor` keeps the full project list. It is server-only, so masking more names is the safe side.
- The week, by-status and ledger API views refuse a restricted person (403). The pages filter instead.
- Hidden reads as missing: 404 on the API, `notFound()` on pages.
- The open questions took the proposed answers: the per-person flag, a blocked-on person sees that one
  task, and a task owner still joins the project.


The ask: selected people see only the projects they are on, or were given view rights on. Admins see
everything. This file maps today's model and the smallest change. Line numbers are from 13 Oct.

## Today

- Visibility is team-wide. Project membership gates writes and the "Your projects" list, never reads.
- Roles: `member`, `lead`, `admin` in `team_members.app_role` (`lib/schema.ts:36-41`).
  `isLeadOrAdmin` is `lib/roles.ts:3-6`. `rolesIn()` is `lib/service.ts:84-93`.
- Projects: `owner_id`, `lead_id` (null means the owner leads), `archived_at`. Archive is not access
  control. `project_members(project_id, person_id, project_role)` holds free-text roles. The owner and
  lead are not rows in it.
- People join a project through `createProject` (`lib/plan.ts:666`), `updateProject` (`:735`, deletes
  and re-inserts members) and `joinProject` (`lib/service.ts:240`, when a task owner is set).
- No-project tasks are visible to the whole team.
- "View as" (admin only) swaps the reader to the viewed person, so it can test the new filter.
- No test covers read visibility.

## The change

1. Schema, in `lib/schema.ts` and `upgrade()`:
   - `team_members.restricted boolean NOT NULL DEFAULT false` (or on `people`). Only flagged members
     are limited, so nothing changes for the pilot until someone is flagged.
   - `project_members.access text CHECK (access IN ('member','viewer')) DEFAULT 'member'`.
2. One shared helper: `visibleProjectIds(db, teamId, me)` returns "all" for a lead, an admin or an
   unrestricted person. Otherwise it returns projects where the person is owner, lead or has a
   `project_members` row. `canSeeTask` is true when the person owns it, it is blocked on them, or its
   project is visible. No-project tasks: owned by, created by or blocked on the person.
3. Filter in the loaders, so most views follow:
   - `lib/service.ts`: `teamTasks` (`:143`, covers week, by status, ledger, updates, person view),
     `getTask` (`:137`), `taskLog` (`:149`), `projectLog` (`:807`), `projectTasks` (`:820`),
     `listProjects` (`:100`), `listNotices` (`:644`), `linksFor`, `markUpdatesSeen`.
   - `lib/plan.ts`: `teamProjects`, `getProject`, `planState`, `projectCounts`, `projectSplits`,
     `projectPeopleMap`.
4. Gates: `app/projects/[id]/page.tsx` and `app/tasks/[id]/page.tsx` call `notFound()`. Every
   `/api/v1/tasks/[id]/*` and `/api/v1/projects/[id]/*` route checks access, not just `sameTeam`.
   `/api/v1/teams/[id]/week`, `/by-status` and `/ledger` get a lead or admin check.
5. Leaks to close:
   - Search: `gather` in `lib/search.ts` puts project names in task hits. The Jev re-rank sends them.
   - `maskDictFor` (`lib/redact.ts:145`) lists every project name. Pass the filtered set.
   - `lookups().projectNames` (`lib/page.ts:9`) and `app/layout.tsx:56` (`projectPeopleMap`) ship every
     project to every page.
   - Home charts (`app/me/page.tsx:35`, `glanceOf` on all tasks) and the updates feed.
   - People pages: `personView` (`lib/service.ts:910`) lists projects and recent events.
   - The new-task project picker (`app/tasks/new/page.tsx`).
   - `updateProject` re-inserts members: keep the viewer rows.
6. UI: the project form gets a "Can view" list next to members. Only the owner, the lead, a lead or an
   admin adds viewers. The account menu for an admin gets the restricted flag per person.

## Open questions for the repo owner

- "Selected" means a per-person flag (proposed), or every plain member?
- A person a task is blocked on: may they see that one task in a hidden project? Proposed: yes.
- Giving a task to someone outside the project adds them as a member today. Should that still happen
  for a restricted person? Proposed: yes, as now, because the owner of a task must see it.

## Order

1. Tests on the helper, through "View as".
2. The loaders.
3. The page and route gates.
4. The leaks.
5. The UI for viewers and the flag.
