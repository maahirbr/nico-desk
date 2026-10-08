"""Check the meeting eval set. Stdlib only. Run: python3 -I evals/meetings/check.py"""
import datetime
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TYPES = {"plain", "owner-by-role", "owner-by-pronoun", "relative-date", "duplicate", "cancelled", "injection"}
errors = []


def err(case, msg):
    errors.append(f"{case}: {msg}")


def iso_or_missing(value):
    if value == "missing":
        return True
    try:
        datetime.date.fromisoformat(value)
        return len(value) == 10
    except (TypeError, ValueError):
        return False


roster = json.load(open(os.path.join(HERE, "roster.json"), encoding="utf-8"))
names = {p["name"] for p in roster["people"]}
cases = sorted(d for d in os.listdir(HERE) if os.path.isdir(os.path.join(HERE, d)) and d[:2].isdigit())
counts = {}

for case in cases:
    base = os.path.join(HERE, case)
    text = open(os.path.join(base, "transcript.md"), encoding="utf-8").read()
    exp = json.load(open(os.path.join(base, "expected.json"), encoding="utf-8"))
    body = " ".join(l for l in text.splitlines() if not l.startswith(("#", "Meeting date:", "Present:")))
    words = len(body.split())
    if not 150 <= words <= 400:
        err(case, f"body has {words} words, need 150 to 400")
    if exp.get("type") not in TYPES:
        err(case, f"unknown type {exp.get('type')!r}")
    counts[exp.get("type")] = counts.get(exp.get("type"), 0) + 1
    if f"Meeting date: {exp.get('meeting_date')}" not in text or not iso_or_missing(exp.get("meeting_date")):
        err(case, "meeting_date missing from transcript header or not ISO")
    speakers = {l.split(":", 1)[0] for l in text.splitlines() if ": " in l and not l.startswith(("#", "Meeting date", "Present"))}
    for sp in speakers:
        if sp not in names:
            err(case, f"speaker {sp!r} not in roster")
    for i, t in enumerate(exp["tasks"]):
        if set(t) != {"title", "owner", "due_on", "quote", "critical"}:
            err(case, f"task {i} has wrong fields {sorted(t)}")
        if t["quote"] not in text:
            err(case, f"task {i} quote not in transcript: {t['quote']!r}")
        if t["owner"] != "missing" and t["owner"] not in names:
            err(case, f"task {i} owner {t['owner']!r} not in roster")
        if not iso_or_missing(t["due_on"]):
            err(case, f"task {i} due_on {t['due_on']!r} does not parse")
        if not isinstance(t["critical"], bool):
            err(case, f"task {i} critical is not a bool")
    for q in exp["must_not_draft"]:
        if q not in text:
            err(case, f"must_not_draft quote not in transcript: {q!r}")
    if exp["type"] == "injection" and not exp["must_not_draft"]:
        err(case, "injection case needs must_not_draft")

if len(cases) != 20:
    err("set", f"expected 20 cases, found {len(cases)}")
want = {"plain": 6, "owner-by-role": 2, "owner-by-pronoun": 1, "relative-date": 3, "duplicate": 2, "cancelled": 2, "injection": 4}
if counts != want:
    err("set", f"type counts {counts} differ from {want}")

if errors:
    print("FAIL")
    print("\n".join(errors))
    sys.exit(1)
print(f"OK: {len(cases)} cases, types {counts}")
