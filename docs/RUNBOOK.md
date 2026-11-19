# Runbook: when something breaks

For a teammate who looks after nico-desk without having built it, for example the PM. Each section says what you see,
what to check, and what to do. For where each account lives, see `HANDOVER-ACCOUNTS.md`. For the setup details, see
`web/README.md` → Hosting.

## Access you need

- **GitHub:** write access to the `nico-desk` repo.
- **Vercel:** a seat in the team that holds the `nico-desk` project. You need it to roll back, read logs and change env vars.
- **Supabase:** Developer or higher in the org that holds the `nico-desk` project. You need it to look at data and backups.
- **The app:** the Admin role, given on the Roster page.

You do not need the git-ignored files (`web/pilot/`, `web/.env.remote.local`) for anything on this page. They hold
real names and the database password, so they are passed by hand, never through git or chat.

## How a change goes live

1. Work goes on the branch `maahir/mvp`. Each push makes a preview build. The preview runs on made-up data, never the
   real pilot.
2. Merging into `main` builds production. It is live on https://nico-desk.vercel.app about a minute later.
3. If the change touches the database schema, run `npm run db:upgrade` from `web/` before the merge. It only adds,
   never deletes.
4. Every deploy gets an entry in `docs/DECISIONS.md` with its rollback line.

## The site is broken after a deploy

1. Roll back first and find the cause later. In Vercel, open the project → **Deployments**. Find the last one that
   worked → **⋯** → **Promote** (Instant Rollback). Or, from `web/`, run the rollback line from the newest
   DECISIONS entry:
   ```bash
   vercel promote <previous deployment url> --yes
   ```
2. Open https://nico-desk.vercel.app/team and check that it loads.
3. To find the cause, open Vercel → project → **Logs**, filtered to errors, around the time it broke.

## The site is down, and no deploy happened

- Check https://www.vercel-status.com and https://status.supabase.com.
- In Supabase, check that the project is not **Paused** and that the org has no unpaid-invoice warning. A paused
  project takes the whole site down. Restore it from the project page.

## Someone cannot sign in

Ask what the sign-in page says, then:
- **"Not on the roster" or "inactive":** an admin adds or reactivates them on the **Roster** page in the app.
- **"Not on the company domain":** they used a personal Gmail. They must sign in with their Nicobar account. A
  partner from outside Nicobar goes in the Vercel env var `NICO_ALLOWED_EMAILS` (comma-separated), then redeploy.
- **Everyone is signed out at once:** someone changed `NICO_SESSION_SECRET` in Vercel. Put the old value back if
  anyone has it. If not, everyone signs in again, and everyone reconnects Claude.

## Claude (the MCP connector) stops working

- **For one person:** they remove and add the connector again in Claude: `https://nico-desk.vercel.app/api/mcp`.
- **For everyone:** see "Everyone is signed out at once" above. The same secret seals Claude's tokens.

## Reminders

- The daily job runs at 09:00 India time and only writes in-app notices. Check it in Vercel → project → **Cron Jobs**.
- A lead sends reminder emails from their own Gmail. If Send fails, they press **Connect Gmail to send** again.
- Resend (sending without Gmail) is off until the `alerts.nicosoul.app` domain is verified. See
  `HANDOVER-ACCOUNTS.md` → Resend.

## Database

WARNING: never run `npm run db:remote` against production. It drops every table and reseeds.

- To look at data: Supabase → project → **Table Editor**. Read only. Make changes through the app, so the history
  stays right.
- **Backups:** Supabase's daily backups on the Pro plan (project → **Database → Backups**), plus any
  `~/Backups/nico-desk/` dumps on the old owner's Mac.
- To restore, ask someone who has the database password and follow the restore line in `web/scripts/backup.sh`.

## Secrets: what never to change

CAUTION: keep these two values as they are, in every move and every new Vercel team.
- `NICO_SESSION_SECRET`: a new value signs everyone out and breaks every Claude connector.
- `NICO_TOKEN_KEY`: a new value makes saved Gmail and Meet links unreadable, so every lead must connect Google again.

The other env vars are listed in `web/.env.example`, with what each one does.

## When to call for help

If a rollback does not fix it, or the data looks wrong (tasks missing, or a person seeing another team's work):
1. Roll back.
2. Tell the team in chat, so nobody keeps working on bad data.
3. Contact the repo owner, or whoever owns the Supabase org.
