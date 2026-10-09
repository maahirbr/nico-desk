"use client";
// FIND is one field with three jobs: find lines, ask a question that has a view, and commit someone to a day.
// One line under the field says in words what the field understood, before return. The parsing is plain code in
// parse.ts: no model call. Tab completes a suggestion and never forces one.
import { Suspense, use, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { commitFindAction } from "@/app/find/actions";
import { KeyboardRule } from "@/components/week/KeyboardRule";
import { completeFind, parseFind, verbSlot, type RosterName } from "./parse";

// Pages whose lines the field filters in place. Anywhere else, Find goes to /search.
const IN_PLACE = new Set(["/team", "/me", "/team/monday"]);
// What counts as a line when filtering: a desk or sheet line, a draft, a ledger row, an open line in Monday mode.
const LINES = "li.ln, article.bl, .tb-draft, .lg-row, .mon-row";

const noSub = () => () => {};
const slotNow = () => document.getElementById("find-slot");
const slotServer = () => null;

type Here = { text: string; path: string };
export type FindData = { roster: RosterName[]; teamId: string | null; today: string };

// Reads the roster once it has loaded and hands it up. The field itself never waits for it.
function Ready({ data, onReady }: { data: Promise<FindData>; onReady: (d: FindData) => void }) {
  const d = use(data);
  useEffect(() => onReady(d), [d, onReady]);
  return null;
}

// usePathname waits for the request on a dynamic route, so it is read here, inside its own boundary, and handed up.
function Where({ onPath }: { onPath: (p: string) => void }) {
  const path = usePathname();
  useEffect(() => onPath(path), [path, onPath]);
  return null;
}

export function FindBox({ data }: { data: Promise<FindData> }) {
  const router = useRouter();
  // The field renders at once and keeps what is typed. The roster arrives on its own, and until it does Return waits.
  const [ctx, setCtx] = useState<FindData | null>(null);
  const roster = useMemo(() => ctx?.roster ?? [], [ctx]);
  const teamId = ctx?.teamId ?? null;
  const today = ctx?.today ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const [pathname, setPathname] = useState("");
  const slot = useSyncExternalStore(noSub, slotNow, slotServer);
  const [value, setValue] = useState("");
  // The filter and the note belong to the page they were made on. A new page drops them with no effect needed.
  const [applied, setApplied] = useState<Here | null>(null);
  const [note, setNote] = useState<Here | null>(null);
  const [counts, setCounts] = useState({ shown: 0, total: 0 });
  const [busy, setBusy] = useState(false);

  // The input is not controlled, so text typed before the page woke up stays in it. Read it in once on mount.
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed) setValue(typed);
  }, []);

  const parsed = useMemo(() => parseFind(value, roster, today), [value, roster, today]);
  const comp = useMemo(() => completeFind(value, roster, today), [value, roster, today]);
  const filter = applied && applied.path === pathname ? applied.text : null;
  const here = note && note.path === pathname ? note.text : null;

  // Non-matching lines fade to muted ink. The page is server-rendered, so this reads the DOM and watches it:
  // a refresh or a slide that adds a line gets the same treatment.
  useEffect(() => {
    if (filter === null) return;
    const q = filter.toLowerCase();
    let raf = 0;
    const run = () => {
      raf = 0;
      let shown = 0;
      let total = 0;
      document.querySelectorAll(LINES).forEach((el) => {
        total++;
        if ((el.textContent ?? "").toLowerCase().includes(q)) {
          shown++;
          el.removeAttribute("data-find-miss");
        } else el.setAttribute("data-find-miss", "");
      });
      setCounts((c) => (c.shown === shown && c.total === total ? c : { shown, total }));
    };
    raf = requestAnimationFrame(run);
    const mo = new MutationObserver(() => {
      if (!raf) raf = requestAnimationFrame(run);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
      document.querySelectorAll("[data-find-miss]").forEach((el) => el.removeAttribute("data-find-miss"));
    };
  }, [filter]);

  const say = (text: string) => setNote({ text, path: pathname });

  // Sets the field's text and the caret together.
  const put = (text: string, caret: number = text.length) => {
    const el = inputRef.current;
    if (!el) return;
    el.value = text;
    setValue(text);
    setNote(null);
    el.setSelectionRange(caret, caret);
  };

  async function go() {
    if (busy || !ctx) return;
    setNote(null);
    if (parsed.kind === "find") {
      if (IN_PLACE.has(pathname)) setApplied({ text: parsed.q, path: pathname });
      else router.push(`/search?q=${encodeURIComponent(parsed.q)}`);
    } else if (parsed.kind === "ask") {
      const p = new URLSearchParams();
      const team = new URLSearchParams(window.location.search).get("team");
      if (team) p.set("team", team);
      p.set("ask", parsed.ask);
      p.set("person", parsed.personId);
      router.push(`/team?${p.toString()}`);
    } else if (parsed.kind === "commit") {
      if (!teamId) return;
      if (!parsed.verb) {
        // No verb was given and none is invented. The caret goes where the verb belongs.
        const slot = verbSlot(value, roster, today);
        if (slot) {
          put(slot.text, slot.caret);
          // The keyboard rule closes the field on return. Open it again so the caret is there to type at.
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(slot.caret, slot.caret);
          }, 0);
        }
        return;
      }
      if (parsed.pastDay) {
        say(`${parsed.pastDay} is already past. Pick a day from today on.`);
        return;
      }
      setBusy(true);
      const r = await commitFindAction({ teamId, ownerId: parsed.ownerId, what: parsed.what, dueOn: parsed.dueOn });
      setBusy(false);
      if (!r.ok) {
        say(r.error);
      } else if (pathname === "/team/monday") {
        // Monday mode stays on the page. The draft shows in Drafts waiting after the refresh.
        put("");
        say(`Draft made for ${parsed.ownerName}. It is in Drafts waiting.`);
        router.refresh();
      } else {
        router.push(`/notes/${r.noteId}`);
      }
    }
  }

  const clear = () => {
    setApplied(null);
    put("");
  };

  const words = busy
    ? "Making the draft."
    : here ?? (filter !== null ? `Showing ${counts.shown} of ${counts.total} lines with "${filter}".` : parsed.kind === "empty" ? "" : parsed.line);
  const hint = busy || here || filter !== null ? "" : (comp?.hint ?? (parsed.kind === "commit" ? "Return makes a draft for the lead." : ""));

  const line =
    words || filter !== null ? (
      <p className="find-line">
        <span>{words}</span>
        {hint ? <span className="find-hint">{hint}</span> : null}
        {filter !== null ? (
          <button type="button" className="caps act" onClick={clear}>
            Clear
          </button>
        ) : null}
      </p>
    ) : null;

  return (
    <>
      <KeyboardRule />
      <form
        role="search"
        className="alt-field"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="sr-only" htmlFor="find-q">
          Find
        </label>
        <input
          id="find-q"
          name="q"
          type="search"
          placeholder="Find"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          className="caps"
          ref={inputRef}
          onChange={(e) => {
            setValue(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            // Return is handled here, not by the form: the keyboard rule closes the field on return, and a closed
            // field no longer submits.
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            } else if (e.key === "Tab" && !e.shiftKey && comp) {
              e.preventDefault();
              put(comp.text, comp.caret);
            }
          }}
        />
      </form>
      <Suspense fallback={null}>
        <Ready data={data} onReady={setCtx} />
      </Suspense>
      <Suspense fallback={null}>
        <Where onPath={setPathname} />
      </Suspense>
      {slot && line ? createPortal(line, slot) : null}
    </>
  );
}
