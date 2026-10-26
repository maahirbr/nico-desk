#!/bin/zsh
# Nightly backup of the hosted database (SPEC: daily, kept 14 days). The free Supabase plan has none.
# Reads DATABASE_URL from .env.remote.local and never prints it. Dumps go outside the repo, owner-only.
# Restore: pg_restore --no-owner --dbname=<url> <file>. The nico_app role is not in the dump; create it first.
set -euo pipefail
cd "$(dirname "$0")/.."
bin=/opt/homebrew/opt/libpq/bin
out="${NICO_BACKUP_DIR:-$HOME/Backups/nico-desk}"
url=$(sed -n 's/^DATABASE_URL=//p' .env.remote.local | tr -d "\"'")
# pg_dump needs a session, so use the pooler's session port (5432), not the transaction port (6543).
url=${url/:6543\//:5432/}
umask 077
mkdir -p "$out"
f="$out/nico-$(date +%Y-%m-%d).dump"
"$bin/pg_dump" --format=custom --schema=public --no-owner "$url" -f "$f.part"
"$bin/pg_restore" --list "$f.part" >/dev/null
mv "$f.part" "$f"
find "$out" -name 'nico-*.dump' -mtime +14 -delete
echo "backup ok: $f ($(du -h "$f" | cut -f1))"
