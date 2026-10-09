"use client";
// One draft as a line of commitment grammar, with its checks and its decisions. The drafting table and Monday
// mode both use it, so a draft reads and acts the same in both places. Accepting a line slides it onto the
// owner's small sheet (the FLIP), then refreshes the page. Decisions run the existing server actions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import { fmtLong, fmtShort, lcFirst } from "@/components/week/lines";
import { approveDraftAction, mergeDraftAction, rejectDraftAction } from "@/lib/actions/drafts";
import type { TableDraft, TablePerson } from "./types";

const TRAVEL = "cubic-bezier(0.83, 0.12, 0.35, 0.96)"; // --ease-travel
const TRAVEL_MS = 300; // --dur-travel

type Kind = "approve" | "reject" | "merge";

const still = () =>
  document.documentElement.dataset.motion === "static" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  d: TableDraft;
  people: TablePerson[];
  isLead: boolean;
  // The owner the draft has now (the matched one, or the one picked on the line) and that owner's ink.
  owner: TablePerson | null;
  ink: string;
  chosen: string;
  onChoose: (personId: string) => void;
  // Monday mode shows the quoted sentence under the line, since no note page sits beside it.
  showQuote?: boolean;
};

export function DraftLine({ d, people, isLead, owner, ink, chosen, onChoose, showQuote = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState(false);
  const [error, setError] = useState("");

  async function decide(kind: Kind, form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("draftId", d.id);
    setError("");
    setBusy(true);
    const ownerId = String(fd.get("ownerId") ?? "") || d.ownerId || "";
    let flyer: HTMLElement | null = null;
    let from: DOMRect | null = null;
    if (kind === "approve" && !still()) {
      // Take the line off the page now. The fresh page may land before the slide ends.
      from = form.getBoundingClientRect();
      flyer = form.cloneNode(true) as HTMLElement;
      flyer.querySelectorAll(".tb-acts, .tb-quote, [role=alert]").forEach((n) => n.remove());
      flyer.removeAttribute("id");
      flyer.setAttribute("aria-hidden", "true");
      flyer.classList.add("tb-flyer");
      Object.assign(flyer.style, { top: `${from.top}px`, left: `${from.left}px`, width: `${from.width}px` });
      document.body.appendChild(flyer);
      setFlying(true);
    }
    const act = kind === "approve" ? approveDraftAction : kind === "reject" ? rejectDraftAction : mergeDraftAction;
    const res = await act(null, fd);
    if (res?.error) {
      flyer?.remove();
      setFlying(false);
      setBusy(false);
      setError(res.error ?? "");
      return;
    }
    if (flyer && from) {
      const target = document.querySelector(`[data-tray="${CSS.escape(ownerId)}"] .tb-mini-s`);
      if (target) {
        const t = target.getBoundingClientRect();
        const scale = Math.max(0.2, Math.min(1, t.width / from.width));
        try {
          await flyer.animate(
            [
              { transform: "translate(0px, 0px) scale(1)" },
              { transform: `translate(${t.left - from.left}px, ${t.top - from.top}px) scale(${scale})` },
            ],
            { duration: TRAVEL_MS, easing: TRAVEL, fill: "forwards" },
          ).finished;
        } catch {
          // A cancelled slide still ends with the refresh below.
        }
      }
      flyer.remove();
    }
    router.refresh();
    setFlying(false);
    setBusy(false);
  }

  const open = d.state === "draft";
  const edit = open && isLead;
  const pickOwner = edit && d.ownerId === null;
  const pickDate = edit && d.dueOn === null;
  const name = owner?.name ?? d.ownerName;
  const by = d.dueOn ? fmtLong(d.dueOn) : "a day not yet set";
  const oks = d.checks.filter((c) => c.kind === "ok");
  const label = pickOwner && pickDate ? "Set the owner and date and accept" : pickOwner ? "Set the owner and accept" : pickDate ? "Set the date and accept" : `Accept onto ${name ?? "the owner"}'s sheet`;
  const hide: CSSProperties | undefined = flying ? { visibility: "hidden" } : undefined;
  return (
    <form
      className={`tb-draft${open ? "" : " done"}`}
      data-draft={d.id}
      style={hide}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void decide("approve", e.currentTarget);
      }}
    >
      <p className="tb-will" data-first>
        {pickOwner ? (
          <select
            name="ownerId"
            required
            aria-label="Owner"
            className="tb-sel no-ring"
            value={chosen}
            onChange={(e) => onChoose(e.target.value)}
          >
            <option value="" disabled>
              Choose an owner
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="who">
            <i style={{ ["--p" as string]: ink }} />
            {name ?? "Nobody named"}
          </span>
        )}{" "}
        will {lcFirst(d.title)} <span className="by">by {by}</span>.
      </p>
      {showQuote ? <q className="tb-quote">{d.quote}</q> : null}
      {open ? (
        <div className="tb-checks">
          {d.checks
            .filter((c) => c.kind === "critical")
            .map((c) => (
              <span key={c.word} className="tb-crit caps">
                {c.word}
              </span>
            ))}
          {oks.length > 0 ? <span className="tb-ok">{oks.map((c) => c.word).join(" · ")}</span> : null}
          {d.checks
            .filter((c) => c.kind === "attention")
            .map((c) => (
              <span key={c.word} className="mark m-amber open">
                <i aria-hidden />
                {c.word}
              </span>
            ))}
        </div>
      ) : null}
      {d.state === "approved" && d.sheetHref && d.sheetWeek ? (
        <p className="tb-where">
          <Link href={d.sheetHref}>
            On {name}&apos;s sheet for the week of {fmtShort(d.sheetWeek)}
          </Link>
          .
        </p>
      ) : null}
      {d.state === "rejected" ? <p className="tb-where">{d.merged ? `Same as ${d.duplicateTitle ?? "an open task"}.` : "Not a commitment."}</p> : null}
      {open && !isLead ? <p className="tb-where">The team lead accepts drafts. You can read this one here.</p> : null}
      {edit ? (
        <div className="tb-acts">
          {pickDate ? (
            <label className="tb-fld">
              <span className="caps">Date</span>
              <input type="date" name="dueOn" required />
            </label>
          ) : null}
          <button type="submit" className="caps act" disabled={busy}>
            {label}
          </button>
          <button type="button" className="caps act" disabled={busy} onClick={(e) => void decide("reject", e.currentTarget.form!)}>
            Not a commitment
          </button>
          {d.duplicateTitle ? (
            <button type="button" className="caps act" disabled={busy} onClick={(e) => void decide("merge", e.currentTarget.form!)}>
              Same as {d.duplicateTitle}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="tb-err">
          {error}
        </p>
      ) : null}
    </form>
  );
}
