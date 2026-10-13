"""Check the paste-to-tasks eval set. Stdlib only, no model call. Run: python3 -I evals/paste/check.py

Two things are checked offline:
1. The chat parser. A small reference parser here must read every chat.txt into exactly the messages in expected.json.
   (web/tests/paste-evals.test.ts runs the real parser, web/lib/chat.ts, against the same messages.)
2. The expected proposals. Their shapes, the tasks and people they point at, the dates, the quotes, and that nothing
   is proposed from a line that must not be acted on.
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STATUS = ["Not started", "In progress", "Blocked", "Done", "Dropped"]
TYPES = {"new-task", "status-update", "status-and-date", "note", "multi-line", "time-24h", "month-first", "plain-paste",
         "system-lines", "no-work", "masking", "outside-sender", "relative-date", "duplicate", "cancelled", "hidden-project", "injection"}
errors = []


def err(case, msg):
    errors.append(f"{case}: {msg}")


def iso_ok(v):
    try:
        datetime.date.fromisoformat(v)
        return len(v) == 10
    except (TypeError, ValueError):
        return False


# ---- reference parser (the formats in this set: iOS, Android 12h and 24h, plain lines) ----
IOS = re.compile(r"^\[(\d{1,2}/\d{1,2}/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AaPp][Mm])?)\]\s?(.*)$")
AND = re.compile(r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s+(\d{1,2}:\d{2}(?:\s?[AaPp][Mm])?)\s+-\s(.*)$")
EVENT = re.compile(r"joined (?:using this group|via)|was added|were added|added you|removed you|created group|changed (?:the|this) (?:group|subject|icon)")
MEDIA = re.compile(r"^(?:<\s*media\s+omitted\s*>|(?:image|video|audio|sticker|gif|document)\s+omitted)$", re.I)


def clock(t):
    m = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?([AaPp])[Mm])?$", t)
    h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3)
    if ap:
        ap = ap.lower()
        if ap == "p" and h != 12:
            h += 12
        if ap == "a" and h == 12:
            h = 0
    return f"{h:02d}:{mi:02d}"


def parse(text):
    text = re.sub("[‎‏‪-‮﻿]", "", text).replace(" ", " ").replace(" ", " ")
    raws, cur, headed = [], None, False
    for line in text.replace("\r\n", "\n").split("\n"):
        m = IOS.match(line) or AND.match(line)
        if m:
            headed = True
            d, t, rest = m.groups()
            sp = None if "end-to-end encrypted" in rest or EVENT.search(rest.split(": ")[0]) else re.match(r"^([^:\n]{1,80}?):(?:\s([\s\S]*))?$", rest)
            if sp:
                cur = {"d": d, "t": t, "sender": re.sub(r"^~\s*", "", sp.group(1)).strip(), "text": sp.group(2) or "", "sys": False}
            else:
                cur = {"d": d, "t": t, "sender": None, "text": rest, "sys": True}
            raws.append(cur)
        elif cur and headed:
            cur["text"] += "\n" + line
        elif line.strip():
            raws.append({"d": None, "t": None, "sender": None, "text": line.strip(), "sys": False})
    dates = [r["d"] for r in raws if r["d"]]
    pairs = [tuple(int(x) for x in d.split("/")[:2]) for d in dates]
    month_first = any(b > 12 for a, b in pairs) and not any(a > 12 for a, b in pairs)
    out = []
    for r in raws:
        body = r["text"].strip()
        if r["sys"] or not body or (r["sender"] is not None and MEDIA.match(body)):
            continue
        iso = None
        if r["d"]:
            a, b, y = (int(x) for x in r["d"].split("/"))
            iso = datetime.date(2000 + y if y < 100 else y, a if month_first else b, b if month_first else a).isoformat()
        out.append({"index": len(out), "sender": r["sender"], "date": iso, "time": clock(r["t"]) if r["t"] else None, "text": body})
    first = next((l for l in text.split("\n") if IOS.match(l) or AND.match(l)), None)
    return out, ("plain" if first is None else "ios" if IOS.match(first) else "android"), len(raws) - len(out)


def main():
    ctx = json.load(open(os.path.join(HERE, "context.json"), encoding="utf-8"))
    today = ctx["today"]
    people = {p["id"]: p["name"] for p in ctx["people"]}
    projects = {p["id"] for p in ctx["projects"]}
    tasks = {t["id"]: t for t in ctx["tasks"]}
    cases = sorted(d for d in os.listdir(HERE) if os.path.isdir(os.path.join(HERE, d)) and d[:2].isdigit())
    counts, formats, kinds = {}, {}, {}
    for case in cases:
        base = os.path.join(HERE, case)
        chat = open(os.path.join(base, "chat.txt"), encoding="utf-8").read()
        exp = json.load(open(os.path.join(base, "expected.json"), encoding="utf-8"))
        for k in ("type", "viewer", "format", "dropped", "messages", "proposals", "must_not"):
            if k not in exp:
                err(case, f"expected.json lacks {k}")
        if errors and errors[-1].startswith(case):
            continue
        if exp["type"] not in TYPES:
            err(case, f"unknown type {exp['type']!r}")
        counts[exp["type"]] = counts.get(exp["type"], 0) + 1
        formats[exp["format"]] = formats.get(exp["format"], 0) + 1
        viewer = exp["viewer"]
        hidden = set(ctx["hidden"].get(viewer, []))
        if viewer not in people:
            err(case, f"viewer {viewer!r} not in the roster")

        # 1. the parser
        got, fmt, dropped = parse(chat)
        if got != exp["messages"]:
            err(case, "reference parser disagrees with the expected messages")
        if fmt != exp["format"]:
            err(case, f"format {fmt!r}, expected {exp['format']!r}")
        if dropped != exp["dropped"]:
            err(case, f"dropped {dropped}, expected {exp['dropped']}")
        msgs = exp["messages"]
        if [m["index"] for m in msgs] != list(range(len(msgs))):
            err(case, "message indexes are not 0..n")
        for m in msgs:
            s = m["sender"]
            if s is not None and s not in people.values() and s not in ctx["outside"]:
                err(case, f"sender {s!r} is neither on the roster nor listed as outside")
            if m["date"] is not None and not iso_ok(m["date"]):
                err(case, f"message {m['index']} date {m['date']!r} is not ISO")
            if m["time"] is not None and not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", m["time"]):
                err(case, f"message {m['index']} time {m['time']!r} is not HH:MM")

        # 2. the proposals
        quotes = []
        for i, p in enumerate(exp["proposals"]):
            where = f"proposal {i}"
            kind = p.get("kind")
            want = {"new": {"kind", "title_has", "owner", "due_on", "project", "source", "quote"},
                    "update": {"kind", "task", "status", "due_on", "source", "quote"},
                    "note": {"kind", "task", "source", "quote"}}.get(kind)
            if want is None:
                err(case, f"{where} has unknown kind {kind!r}")
                continue
            kinds[kind] = kinds.get(kind, 0) + 1
            if set(p) != want:
                err(case, f"{where} has fields {sorted(p)}, need {sorted(want)}")
                continue
            if not isinstance(p["source"], int) or not 0 <= p["source"] < len(msgs):
                err(case, f"{where} source {p['source']!r} is out of range")
                continue
            if p["quote"] not in msgs[p["source"]]["text"]:
                err(case, f"{where} quote is not in message {p['source']}")
            quotes.append(p["quote"])
            if kind == "new":
                if len(p["title_has"]) < 3 or p["title_has"] != p["title_has"].lower():
                    err(case, f"{where} title_has must be 3 or more lowercase characters")
                if p["owner"] is not None and p["owner"] not in people:
                    err(case, f"{where} owner {p['owner']!r} not on the roster")
                if p["due_on"] is not None and (not iso_ok(p["due_on"]) or p["due_on"] < today):
                    err(case, f"{where} due_on {p['due_on']!r} is not a date from today on")
                if p["project"] is not None and (p["project"] not in projects or p["project"] in hidden):
                    err(case, f"{where} project {p['project']!r} is unknown or hidden from the viewer")
            else:
                t = tasks.get(p["task"])
                if not t:
                    err(case, f"{where} task {p['task']!r} is not in context.json")
                    continue
                if t["project"] in hidden:
                    err(case, f"{where} points at {p['task']}, which the viewer cannot see")
                if kind == "update":
                    if (p["status"] is None) == (p["due_on"] is None):
                        err(case, f"{where} needs exactly one of status and due_on")
                    if p["status"] is not None and (p["status"] not in STATUS or p["status"] == t["status"]):
                        err(case, f"{where} status {p['status']!r} is not one of the five words or does not change anything")
                    if p["due_on"] is not None and (not iso_ok(p["due_on"]) or p["due_on"] < today or p["due_on"] == t["due_on"]):
                        err(case, f"{where} due_on {p['due_on']!r} is not a new date from today on")

        # must_not: lines nothing may be drawn from
        for j, n in enumerate(exp["must_not"]):
            if set(n) - {"quote", "why", "task"} or not {"quote", "why"} <= set(n):
                err(case, f"must_not {j} has wrong fields {sorted(n)}")
                continue
            if n["quote"] not in chat:
                err(case, f"must_not {j} quote is not in the chat")
            if any(n["quote"] in q or q in n["quote"] for q in quotes):
                err(case, f"must_not {j} quote is also used by a proposal")
            if "task" in n and any(p.get("task") == n["task"] for p in exp["proposals"]):
                err(case, f"must_not {j} names {n['task']}, which a proposal uses")
        if exp["type"] == "injection" and not exp["must_not"]:
            err(case, "an injection case needs must_not")
        if exp["type"] == "hidden-project" and not any("task" in n and tasks[n["task"]]["project"] in hidden for n in exp["must_not"]):
            err(case, "a hidden-project case needs a must_not that names a hidden task")
        if exp["type"] == "masking" and not (re.search(r"[\w.]+@[\w.]+", chat) and re.search(r"\d[\d ]{7,}\d", chat)):
            err(case, "a masking case needs an email and a phone number in the chat")
        if exp["type"] == "no-work" and exp["proposals"]:
            err(case, "a no-work case must expect no proposals")

    if len(cases) != 20:
        err("set", f"expected 20 cases, found {len(cases)}")
    if counts.get("injection", 0) < 4:
        err("set", f"need at least 4 injection cases, found {counts.get('injection', 0)}")
    if formats.get("ios", 0) < 6 or formats.get("android", 0) < 6 or not formats.get("plain"):
        err("set", f"formats {formats}: need 6 or more iOS, 6 or more Android and 1 or more plain")
    if set(kinds) != {"new", "update", "note"}:
        err("set", f"proposal kinds covered {sorted(kinds)}")
    if errors:
        print("FAIL")
        print("\n".join(errors))
        sys.exit(1)
    print(f"OK: {len(cases)} cases, formats {formats}, proposals {kinds}")


if __name__ == "__main__":
    main()
