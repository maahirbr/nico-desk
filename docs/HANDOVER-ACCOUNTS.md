# Handover: accounts and keys

The repo owner's internship ends soon. Today the app runs on the repo owner's personal accounts. This page lists
each one and how to move it to a Nicobar account. Checked on 18 Nov 2026 against GitHub, Vercel and Supabase.

The new owner is a person at Nicobar, picked by the sponsor or the founder. Each move needs that person to hold an
owner or admin seat in the Nicobar org on the other side.

## What runs where

| # | Thing | Where it is now | What it does |
|---|---|---|---|
| 1 | GitHub repo `nico-desk` | Repo owner's personal GitHub, public, 4 collaborators | The code. Pushes to `main` build production. |
| 2 | Vercel project `nico-desk` | Repo owner's personal Hobby team | Serves https://nico-desk.vercel.app, holds the env vars, runs the daily reminders cron (`web/vercel.json`). |
| 3 | Vercel projects `nico-desk-v2`, `nicobar-okr-poc` | Same Hobby team | Side builds. Move them or delete them. |
| 4 | Supabase project `nico-desk` | Repo owner's personal org, free plan, Mumbai | The production database with the real pilot. |
| 5 | Google Cloud project | Nicobar Workspace org (the consent screen is Internal) | The OAuth client for Google sign-in, Gmail send and Meet notes. |
| 6 | TypeSafe API key (Jev) | Repo owner's TypeSafe account, paid by the repo owner | Set in Vercel. `NICO_JEV` is not set in production, so Jev is off there today. |
| 7 | Nightly backup | launchd job `com.nicodesk.backup` on the repo owner's Mac | Runs `web/scripts/backup.sh` to `~/Backups/nico-desk/`, 14 days kept. Stops when the Mac goes. |
| 8 | Git-ignored files | The repo owner's laptop only | `web/pilot/roster.local.json`, `web/pilot/projects.local.json`, `web/.env.remote.local`, `web/.data/`. |

## Vercel production env vars

11 are set, all Production only: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NICO_SESSION_SECRET`,
`NICO_JOB_SECRET`, `CRON_SECRET`, `NICO_TOKEN_KEY`, `NICO_ALLOWED_DOMAIN`, `NICO_ALLOWED_EMAILS`, `NICO_GMAIL_SEND`,
`TYPESAFE_API_KEY`. `web/.env.example` says what each one does. `ANTHROPIC_API_KEY` is not set in production.

## Two rules for the move

CAUTION: Keep the values of `NICO_SESSION_SECRET` and `NICO_TOKEN_KEY` the same. A new session secret signs everyone
out and breaks each person's Claude connector. A new token key makes saved Gmail and Meet links unreadable, so each
lead must connect Google again.

CAUTION: Keep the address `nico-desk.vercel.app`. A new address needs new Google OAuth redirect URIs (sign-in, Gmail,
Meet: see `web/README.md` Hosting), a new Claude connector URL for each person, and new links for everyone. A Vercel
project transfer keeps the project and its `.vercel.app` address, so use a transfer, not a new project.

## Steps, in order

1. **Google Cloud.** Open IAM on the project that holds the OAuth client. Make sure a Nicobar admin has the Owner
   role. If the repo owner is the only Owner, add one before anything else.
2. **Back up.** Run `web/scripts/backup.sh` once by hand and keep the dump until the move is checked.
3. **Supabase.** In the Nicobar Supabase org, invite the repo owner as a member. Then in the project's General
   settings, transfer `nico-desk` to that org. The repo owner must own the source org (true today). The project,
   its data and `DATABASE_URL` stay the same. If the Nicobar org is on the free plan, it must have room for one more
   free project. Supabase Pro adds daily backups, which would replace step 7.
4. **GitHub.** Settings → Transfer ownership → the Nicobar GitHub org. Old URLs redirect. Collaborators carry over
   as outside collaborators. Then update the local remote: `git remote set-url origin <new url>`.
5. **Vercel.** Make a Nicobar Vercel team. Hobby is for non-commercial use, so the company team needs Pro. Transfer
   `nico-desk` to it (project Settings → Transfer). Then check in the new team:
   - all 11 env vars above are there,
   - the cron shows under Cron Jobs,
   - the Git connection points at the moved repo (reconnect it if not),
   - a push to `main` builds, and https://nico-desk.vercel.app/team signs in.
6. **TypeSafe.** Either Nicobar makes its own key and replaces `TYPESAFE_API_KEY`, or the variable is removed. Then
   the repo owner revokes the old key.
7. **Backups.** Install the launchd job on the new owner's Mac (the plist and `backup.sh` need `libpq` from
   Homebrew and `web/.env.remote.local`), or rely on Supabase Pro backups. Then the repo owner runs
   `launchctl bootout gui/$(id -u)/com.nicodesk.backup`.
8. **Local files.** Hand the git-ignored files in item 8 to the new owner by a private channel, never through git.
   They hold real names and the database password.
9. **Remove the repo owner.** Last, after everything above is checked: take the repo owner off the Supabase org,
   the Vercel team, the GitHub org and the Google Cloud project. Ask the new owner to rotate the Supabase database
   password and then update `DATABASE_URL` in Vercel and `web/.env.remote.local`.

Do steps 3 to 5 on the same day, so the site is at risk for as short a time as possible.

## Not covered here

- Each person's Claude connector and Google links belong to that person and need no move.
- The OKR page and `nicobar-okr-processor` are separate projects with their own owners.
