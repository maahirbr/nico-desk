"""Fixture check. Stdlib only. Run: python3 -I fixtures/check.py

1. Every file has exactly the DDL columns (SPEC.local.md section 3.3), with valid types, enums and CHECKs.
2. Replaying events.json in order gives tasks.json and projects.json exactly.
3. The on-time ledger recomputed from the rows equals the table in fixtures/README.md.
4. The denylist and email guards hold.
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASOF = "2026-10-09"
errors = []


def err(msg):
    errors.append(msg)


def load(name):
    with open(os.path.join(HERE, name + ".json"), encoding="utf-8") as f:
        return json.load(f)


# Column lists from the DDL. Generated or derived columns (search_tsv, version) are left out on purpose.
COLS = {
    "people": ["id", "display_name", "role", "department", "email", "active"],
    "teams": ["id", "name", "team_type"],
    "team_members": ["team_id", "person_id", "app_role"],
    "projects": ["id", "team_id", "name", "department", "owner_id", "status", "status_note", "status_at"],
    "tasks": ["id", "team_id", "title", "owner_id", "project_id", "first_due_on", "due_on", "note", "health",
              "status", "status_category", "priority", "priority_set_by", "priority_set_at", "blocked_on_id",
              "blocked_ask", "blocked_at", "origin", "origin_ref", "created_by", "created_at", "closed_at",
              "closed_on", "asked_by_id", "for_task_id", "ask_state"],
    "events": ["id", "entity_type", "entity_id", "field", "before", "after", "reason", "actor_id", "origin", "at"],
    "notes": ["id", "team_id", "source_app", "external_id", "title", "body", "held_at", "received_at",
              "drafted_at", "status", "synthetic"],
}
NOT_NULL = {
    "people": ["id", "display_name", "role", "department", "email", "active"],
    "teams": ["id", "name", "team_type"],
    "team_members": ["team_id", "person_id", "app_role"],
    "projects": ["id", "team_id", "name", "department", "owner_id", "status", "status_at"],
    "tasks": ["id", "team_id", "title", "owner_id", "first_due_on", "due_on", "status", "status_category",
              "origin", "created_at"],
    "events": ["id", "entity_type", "entity_id", "field", "origin", "at"],
    "notes": ["id", "team_id", "source_app", "title", "held_at", "received_at", "status", "synthetic"],
}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TSZ = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
DATE_COLS = {"tasks": ["first_due_on", "due_on", "closed_on"]}
TS_COLS = {"projects": ["status_at"],
           "tasks": ["priority_set_at", "blocked_at", "created_at", "closed_at"],
           "events": ["at"],
           "notes": ["held_at", "received_at", "drafted_at"]}
ENUMS = {
    ("teams", "team_type"): {"launch", "run", "partner", "pipeline"},
    ("team_members", "app_role"): {"member", "lead", "admin"},
    ("projects", "status"): {"on_track", "at_risk", "off_track"},
    ("tasks", "health"): {"not_started", "off_track", "on_track", "ahead"},
    ("tasks", "status_category"): {"open", "done", "dropped"},
    ("tasks", "priority"): {"high", "normal", "low"},
    ("tasks", "origin"): {"app", "sheet", "notes"},
    ("tasks", "ask_state"): {"asked", "accepted", "returned"},
    ("events", "entity_type"): {"task", "project"},
    ("events", "origin"): {"app", "sheet", "notes"},
    ("notes", "status"): {"received", "drafted", "failed", "cleared"},
}
FKS = {
    "team_members": [("team_id", "teams"), ("person_id", "people")],
    "projects": [("team_id", "teams"), ("owner_id", "people")],
    "tasks": [("team_id", "teams"), ("owner_id", "people"), ("project_id", "projects"),
              ("priority_set_by", "people"), ("blocked_on_id", "people"), ("created_by", "people"),
              ("asked_by_id", "people"), ("for_task_id", "tasks")],
    "events": [("actor_id", "people")],
    "notes": [("team_id", "teams")],
}

data = {n: load(n) for n in COLS}


def ok_date(v):
    try:
        datetime.date.fromisoformat(v)
        return bool(DATE.match(v))
    except Exception:
        return False


def ok_ts(v):
    try:
        datetime.datetime.strptime(v, "%Y-%m-%dT%H:%M:%SZ")
        return bool(TSZ.match(v))
    except Exception:
        return False


def ist_day(at):
    d = datetime.datetime.strptime(at, "%Y-%m-%dT%H:%M:%SZ") + datetime.timedelta(hours=5, minutes=30)
    return d.date().isoformat()


# ---- 1. shape, types, CHECKs
for name, rows in data.items():
    if not isinstance(rows, list):
        err(f"{name}: not an array")
        continue
    for r in rows:
        who = f"{name}:{r.get('id', r)}"
        if sorted(r) != sorted(COLS[name]):
            err(f"{who}: keys differ from DDL: extra {sorted(set(r) - set(COLS[name]))} missing {sorted(set(COLS[name]) - set(r))}")
            continue
        for c in NOT_NULL[name]:
            if r[c] is None:
                err(f"{who}: {c} is null")
        for c in DATE_COLS.get(name, []):
            if r[c] is not None and not (isinstance(r[c], str) and ok_date(r[c])):
                err(f"{who}: {c} not an ISO date: {r[c]!r}")
        for c in TS_COLS.get(name, []):
            if r[c] is not None and not (isinstance(r[c], str) and ok_ts(r[c])):
                err(f"{who}: {c} not an ISO timestamp with Z: {r[c]!r}")
        for (n, c), vals in ENUMS.items():
            if n == name and r[c] is not None and r[c] not in vals:
                err(f"{who}: {c}={r[c]!r} not in {sorted(vals)}")
        for c, target in FKS.get(name, []):
            if r[c] is not None and r[c] not in {x["id"] for x in data[target]}:
                err(f"{who}: {c}={r[c]!r} has no row in {target}")
    ids = [r.get("id") for r in rows if "id" in r]
    if len(ids) != len(set(ids)):
        err(f"{name}: duplicate ids")

for r in data["people"]:
    if not isinstance(r["active"], bool):
        err(f"people:{r['id']}: active not boolean")
emails = [r["email"] for r in data["people"]]
if len(emails) != len(set(emails)):
    err("people: duplicate email")
keys = [(r["team_id"], r["person_id"], r["app_role"]) for r in data["team_members"]]
if len(keys) != len(set(keys)):
    err("team_members: duplicate primary key")

for t in data["tasks"]:
    w = "tasks:" + t["id"]
    if not 3 <= len(t["title"]) <= 200:
        err(f"{w}: title length")
    if t["note"] is not None and len(t["note"]) > 200:
        err(f"{w}: note over 200 chars")
    if t["blocked_ask"] is not None and not 10 <= len(t["blocked_ask"]) <= 280:
        err(f"{w}: blocked_ask length")
    if (t["origin"] == "app") != (t["origin_ref"] is None):
        err(f"{w}: origin_ref rule")
    if (t["status_category"] == "done") != (t["closed_at"] is not None):
        err(f"{w}: closed_at vs status_category")
    if (t["closed_at"] is None) != (t["closed_on"] is None):
        err(f"{w}: closed_at vs closed_on")
    if t["closed_at"] and t["closed_on"] != ist_day(t["closed_at"]):
        err(f"{w}: closed_on is not the Asia/Kolkata day of closed_at")
    if (t["priority"] is None) != (t["priority_set_by"] is None):
        err(f"{w}: priority vs priority_set_by")
    if (t["blocked_on_id"] is None) != (t["blocked_ask"] is None):
        err(f"{w}: blocked_on_id vs blocked_ask")
    if not (t["origin"] == "sheet" or t["status_category"] != "open" or t["health"] is not None):
        err(f"{w}: open non-sheet task needs health")
    if t["status"] != t["status_category"] and t["origin"] != "sheet":
        err(f"{w}: status must equal status_category for app and notes tasks")
    if (t["ask_state"] is None) != (t["asked_by_id"] is None):
        err(f"{w}: ask_state vs asked_by_id")
    if t["asked_by_id"] is not None and t["asked_by_id"] == t["owner_id"]:
        err(f"{w}: an ask made of its own asker")
    if t["blocked_on_id"] == t["owner_id"]:
        err(f"{w}: blocked on the owner")
    if t["origin"] == "sheet" and t["created_by"] is not None:
        err(f"{w}: sheet task has created_by")
    if t["title"] != t["title"].strip() or chr(0x2014) in json.dumps(t, ensure_ascii=False):
        err(f"{w}: title spacing or em dash")
tkeys = [(t["origin"], t["origin_ref"]) for t in data["tasks"] if t["origin_ref"]]
if len(tkeys) != len(set(tkeys)):
    err("tasks: duplicate (origin, origin_ref)")

for e in data["events"]:
    w = "events:" + e["id"]
    if e["reason"] is not None and len(e["reason"]) > 280:
        err(f"{w}: reason over 280")
    if e["field"] in ("due_on", "_reopened") and not e["reason"]:
        err(f"{w}: {e['field']} event without reason")
    if e["field"] == "status_category" and e["after"] == "dropped" and not e["reason"]:
        err(f"{w}: drop without reason")
    if e["field"].startswith("_") and e["field"] not in ("_created", "_update", "_reopened"):
        err(f"{w}: unknown field {e['field']}")
ats = [e["at"] for e in data["events"]]
if ats != sorted(ats):
    err("events: not in time order")
if [e["id"] for e in data["events"]] != ["evt_%04d" % i for i in range(1, len(data["events"]) + 1)]:
    err("events: ids are not evt_0001.. in file order")

for n in data["notes"]:
    w = "notes:" + n["id"]
    if (n["source_app"] == "paste") != (n["external_id"] is None):
        err(f"{w}: external_id rule")
    if (n["status"] == "cleared") != (n["body"] is None):
        err(f"{w}: cleared vs body")
    if n["synthetic"] is not True:
        err(f"{w}: synthetic must be true")
    if n["source_app"] not in ("granola", "paste"):
        err(f"{w}: source_app")
    if n["body"] and len(n["body"]) >= 1500:
        err(f"{w}: body too long")
nk = [(n["source_app"], n["external_id"]) for n in data["notes"] if n["external_id"]]
if len(nk) != len(set(nk)):
    err("notes: duplicate (source_app, external_id)")
# A note still waiting to be drafted (status received) has no tasks yet and is skipped here.
drafted = [n for n in data["notes"] if n["status"] != "received"]
note_tasks = {t["origin_ref"].split("#")[0] for t in data["tasks"] if t["origin"] == "notes"}
note_keys = {n["external_id"] or n["id"] for n in drafted}
if note_tasks != note_keys:
    err(f"notes: origin_ref prefixes {sorted(note_tasks)} do not match notes {sorted(note_keys)}")
for n in drafted:
    k = n["external_id"] or n["id"]
    cnt = sum(1 for t in data["tasks"] if t["origin"] == "notes" and t["origin_ref"].split("#")[0] == k)
    if cnt not in (2, 3):
        err(f"notes:{n['id']}: {cnt} commitments (want 2 or 3)")
    for t in data["tasks"]:
        if t["origin"] == "notes" and t["origin_ref"].split("#")[0] == k:
            if t["created_at"] < (n["drafted_at"] or n["received_at"]):
                err(f"notes:{n['id']}: task {t['id']} created before the note was drafted")

# ---- 2. replay
rep = {"task": {}, "project": {}}
for e in data["events"]:
    bucket = rep[e["entity_type"]]
    f = e["field"]
    if f == "_created":
        bucket[e["entity_id"]] = {"id": e["entity_id"], **e["after"]}
        continue
    row = bucket.get(e["entity_id"])
    if row is None:
        err(f"replay: {e['id']} before _created")
        continue
    if f in ("_update", "_reopened"):
        continue
    if f not in row:
        err(f"replay: {e['id']} unknown column {f}")
        continue
    if row[f] != e["before"]:
        err(f"replay: {e['id']} before={e['before']!r} but row has {row[f]!r}")
    row[f] = e["after"]
    if e["entity_type"] == "task" and f == "priority":
        row["priority_set_by"], row["priority_set_at"] = e["actor_id"], e["at"]
    if e["entity_type"] == "task" and f == "blocked_on_id":
        row["blocked_at"] = e["at"] if e["after"] is not None else None
    if e["entity_type"] == "project" and f in ("status", "status_note"):
        row["status_at"] = e["at"]
for kind, table in (("task", "tasks"), ("project", "projects")):
    want = {r["id"]: r for r in data[table]}
    if set(rep[kind]) != set(want):
        err(f"replay: {table} ids differ")
    for i, r in want.items():
        got = rep[kind].get(i)
        if got != r:
            diff = {k: (got.get(k) if got else None, r[k]) for k in r if not got or got.get(k) != r[k]}
            err(f"replay: {table}:{i} differs (replayed, file): {diff}")
        elif list(got) != list(r) and set(got) != set(r):
            err(f"replay: {table}:{i} keys differ")

# ---- 3. ledger
def monday(d):
    x = datetime.date.fromisoformat(d)
    return (x - datetime.timedelta(days=x.weekday())).isoformat()


ledger = {}
for t in data["tasks"]:
    if t["status_category"] == "dropped":
        continue
    if t["closed_on"] is not None:
        c, fd = t["closed_on"], t["first_due_on"]
        state = "ahead" if c < fd else "on_time" if c == fd else "late"
    elif t["due_on"] < ASOF:
        state = "open"
    else:
        continue
    row = ledger.setdefault(monday(t["first_due_on"]), dict(counted=0, ahead=0, on_time=0, late=0, open=0))
    row["counted"] += 1
    row[state] += 1
total = {k: sum(r[k] for r in ledger.values()) for k in ("counted", "ahead", "on_time", "late", "open")}

readme = open(os.path.join(HERE, "README.md"), encoding="utf-8").read()
stated = {}
for line in readme.splitlines():
    m = re.match(r"^\|\s*(2026-\d\d-\d\d|Total)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*$", line)
    if m:
        stated[m.group(1)] = dict(zip(("counted", "ahead", "on_time", "late", "open"), map(int, m.groups()[1:])))
want_ledger = dict(ledger)
want_ledger["Total"] = total
if stated != want_ledger:
    err(f"ledger: README table {stated} != recomputed {want_ledger}")
if total["ahead"] + total["on_time"] + total["late"] + total["open"] != total["counted"]:
    err("ledger: buckets do not add up")

# story checks
by = {t["id"]: t for t in data["tasks"]}
def outcome(t):
    return None if not t["closed_on"] else "ahead" if t["closed_on"] < t["first_due_on"] else "on_time" if t["closed_on"] == t["first_due_on"] else "late"
if outcome(by["tsk_008"]) != "late" or outcome(by["tsk_017"]) != "on_time":
    err("story: tsk_008 must be late and tsk_017 on time under the first-date rule")
due_events = [e for e in data["events"] if e["field"] == "due_on"]
early = [e for e in due_events if ist_day(e["at"]) <= e["before"]]
late = [e for e in due_events if ist_day(e["at"]) > e["before"]]
if len(early) < 3 or len(late) != 1:
    err(f"story: want open renegotiations >= 3 (two plus the off-track one) and exactly 1 late; got {len(early)} and {len(late)}")
if sum(1 for t in data["tasks"] if t["blocked_on_id"]) != 2:
    err("story: want exactly 2 tasks blocked now")
if sum(1 for t in data["tasks"] if t["status_category"] == "dropped") != 1:
    err("story: want 1 dropped task")
if sum(1 for e in data["events"] if e["field"] == "_reopened") != 1:
    err("story: want 1 reopen")
if sum(1 for t in data["tasks"] if t["health"] == "off_track" and t["due_on"] != t["first_due_on"] and not t["asked_by_id"]) != 1:
    err("story: want 1 off_track task carrying a new date outside the asks")
asks = [t for t in data["tasks"] if t["asked_by_id"]]
if sorted(t["id"] for t in asks) != ["tsk_037", "tsk_038", "tsk_039"]:
    err("story: want exactly three asks, tsk_037 to tsk_039")
if any(t["status_category"] != "open" or t["due_on"] < ASOF for t in asks):
    err("story: an ask is closed or overdue, so it would enter the ledger")
by_id = {t["id"]: t for t in data["tasks"]}
a38 = by_id["tsk_038"]
if not (a38["ask_state"] == "accepted" and a38["health"] == "off_track" and a38["due_on"] > a38["first_due_on"]
        and any(e["entity_id"] == "tsk_038" and e["field"] == "due_on" and e["reason"] for e in data["events"])):
    err("story: tsk_038 must be an accepted ask with a 'later, because' answer")
if by_id["tsk_037"]["ask_state"] != "asked":
    err("story: tsk_037 must still be waiting for an answer")
waiting = [n for n in data["notes"] if n["status"] == "received"]
if len(waiting) != 1 or len(re.findall(r"\bI will\b", waiting[0]["body"] or "")) != 4:
    err("story: want one undrafted note holding exactly four 'I will' commitments")
tm = [r for r in data["team_members"] if r["team_id"] == "team_run"]
if sorted(r["app_role"] for r in tm) != ["admin", "lead", "member", "member", "member", "member"]:
    err("story: pilot team needs 1 lead, 1 admin, 4 members")
roster = json.load(open(os.path.join(HERE, "..", "evals", "meetings", "roster.json"), encoding="utf-8"))["people"]
pilot = {r["person_id"] for r in tm}
if pilot != {p["id"] for p in roster}:
    err("story: pilot team is not the roster")
for p in roster:
    match = [x for x in data["people"] if x["id"] == p["id"]]
    if not match or match[0]["display_name"] != p["name"] or match[0]["department"] != p["department"]:
        err(f"roster: {p['id']} differs from people.json")

# ---- 4. guards
deny = [l.strip().lower() for l in open(os.path.join(HERE, "denylist.txt"), encoding="utf-8") if l.strip()]
for fn in sorted(os.listdir(HERE)):
    if fn.endswith(".json"):
        txt = open(os.path.join(HERE, fn), encoding="utf-8").read().lower()
        for d in deny:
            if d in txt:
                err(f"guard: {fn} contains denylisted {d!r}")
        if chr(0x2014) in txt:
            err(f"guard: {fn} contains an em dash")
for p in data["people"]:
    if not p["email"].endswith("@example.test"):
        err(f"guard: email {p['email']!r} not @example.test")
for fn in sorted(os.listdir(HERE)):
    if fn.endswith(".json"):
        for m in re.findall(r"[\w.+-]+@[\w.-]+", open(os.path.join(HERE, fn), encoding="utf-8").read()):
            if not m.endswith("@example.test"):
                err(f"guard: {fn} has email-like text {m!r}")

if errors:
    print("FAIL: fixtures")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("OK: fixtures")
