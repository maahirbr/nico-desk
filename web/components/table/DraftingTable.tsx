"use client";
// The drafting table. The note is the left page, each quoted sentence underlined in its owner's ink.
// Each draft sits on the right as one line, tied to its sentence by a thread. Accepting a line slides it
// to a small stack of the owner's week sheet. Decisions run the existing server actions.
import { useEffect, useMemo, useRef, useState } from "react";
import { DraftLine } from "./DraftLine";
import { layoutNote } from "./segments";
import type { TableDraft, TablePerson } from "./types";

const NS = "http://www.w3.org/2000/svg";

type Props = {
  title: string;
  day: string;
  body: string;
  drafts: TableDraft[];
  people: TablePerson[];
  isLead: boolean;
};

export function DraftingTable({ title, day, body, drafts, people, isLead }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawn = useRef<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const laid = useMemo(() => layoutNote(body, drafts.map((d) => ({ id: d.id, quote: d.quote })), title), [body, drafts, title]);
  const draftById = useMemo(() => new Map(drafts.map((d) => [d.id, d])), [drafts]);

  // The owner a draft has now: the matched one, or the one picked on its line.
  const ownerOf = (d: TableDraft): TablePerson | null => {
    const id = d.ownerId ?? chosen[d.id];
    return id ? (byId.get(id) ?? null) : null;
  };
  const inkOf = (d: TableDraft) => ownerOf(d)?.ink ?? d.ink;

  const waiting = drafts.filter((d) => d.state === "draft").length;

  // Tethers. Each runs along its sentence's underline to the gutter, down, and into its draft line.
  // Every point stays inside the sheet, so no thread crosses the sheet border.
  const sig = drafts.map((d) => `${d.id}:${d.state}:${ownerOf(d)?.id ?? ""}`).join("|");
  useEffect(() => {
    const sheet = sheetRef.current;
    const svg = svgRef.current;
    if (!sheet || !svg) return;
    let alive = true;
    let frame = 0;
    const draw = () => {
      if (!alive) return;
      svg.replaceChildren();
      if (window.matchMedia("(max-width: 720px)").matches) return;
      const box = sheet.getBoundingClientRect();
      const slot = new Map<Element, number>();
      for (const d of drafts) {
        const q = sheet.querySelector<HTMLElement>(`u[data-q="${CSS.escape(d.id)}"]`);
        const line = sheet.querySelector<HTMLElement>(`[data-draft="${CSS.escape(d.id)}"] [data-first]`);
        const cell = line?.closest(".tb-c");
        if (!q || !line || !cell) continue;
        const rects = q.getClientRects();
        const end = rects[rects.length - 1];
        if (!end) continue;
        const k = slot.get(cell) ?? 0;
        slot.set(cell, k + 1);
        const lr = line.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(line).lineHeight);
        const cellLeft = cell.getBoundingClientRect().left - box.left;
        const x1 = end.right - box.left + 2;
        const y1 = end.bottom - box.top + 1;
        const y2 = lr.top - box.top + (Number.isFinite(lh) ? lh : lr.height) / 2;
        const gx = Math.max(x1 + 6, cellLeft - 30 + k * 5);
        const dx = Math.max(gx + 8, cellLeft - 6);
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", `M ${x1} ${y1} L ${gx} ${y1} L ${gx} ${y2} L ${dx} ${y2}`);
        p.style.stroke = inkOf(d);
        if (d.state !== "draft") p.style.opacity = "0.35";
        svg.appendChild(p);
        p.style.setProperty("--len", String(Math.ceil(p.getTotalLength()) + 1));
        if (!drawn.current.has(d.id)) {
          drawn.current.add(d.id);
          p.classList.add("draw");
        }
      }
    };
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(soon);
    ro.observe(sheet);
    sheet.querySelectorAll(".tb-draft").forEach((el) => ro.observe(el));
    soon();
    if (document.fonts) void document.fonts.ready.then(soon);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
    // inkOf and drafts are read through sig, so one signature is the whole dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, body]);

  // The tray: one small stack per owner who has a draft on this table.
  const trayIds: string[] = [];
  for (const d of drafts) {
    const o = ownerOf(d);
    if (o && !trayIds.includes(o.id)) trayIds.push(o.id);
  }
  const accepted = (id: string) => drafts.filter((d) => d.state === "approved" && d.ownerId === id).length;

  // Module-level component, so a field on a line keeps its focus when the table redraws.
  const line = (d: TableDraft) => (
    <DraftLine
      d={d}
      people={people}
      isLead={isLead}
      owner={ownerOf(d)}
      ink={inkOf(d)}
      chosen={chosen[d.id] ?? ""}
      onChoose={(id) => setChosen((c) => ({ ...c, [d.id]: id }))}
    />
  );

  return (
    <div className="tb">
      <div className="stack">
        <div className="sheet" ref={sheetRef}>
          <h1 className="tb-title">{title}</h1>
          <p className="tb-meta">
            {day}. {waiting === 1 ? "1 draft waiting" : `${waiting} drafts waiting`}.
          </p>
          <div className="tb-grid">
            {laid.rows.map((row, i) => (
              <div className="tb-row" key={i}>
                <p className="tb-p">
                  {row.pieces.map((pc, j) =>
                    pc.draftId && draftById.get(pc.draftId) ? (
                      <u key={j} data-q={pc.draftId} style={{ ["--p" as string]: inkOf(draftById.get(pc.draftId)!) }}>
                        {pc.text}
                      </u>
                    ) : (
                      <span key={j}>{pc.text}</span>
                    ),
                  )}
                </p>
                <div className="tb-c">
                  {row.draftIds.map((id) => {
                    const d = draftById.get(id);
                    return d ? <div key={id}>{line(d)}</div> : null;
                  })}
                </div>
              </div>
            ))}
            {laid.unplaced.length > 0 ? (
              <div className="tb-row">
                <p className="tb-p tb-miss">These drafts quote words that are not in the note text.</p>
                <div className="tb-c">
                  {laid.unplaced.map((id) => {
                    const d = draftById.get(id);
                    return d ? <div key={id}>{line(d)}</div> : null;
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <svg
            ref={svgRef}
            className="threads"
            aria-hidden
            onAnimationEnd={(e) => {
              if (e.animationName === "thread-draw") (e.target as Element).classList.remove("draw");
            }}
          />
          {trayIds.length > 0 ? (
            <div className="tb-tray">
              <h2 className="caps">Week sheets</h2>
              <div className="tb-minis">
                {trayIds.map((id) => {
                  const p = byId.get(id)!;
                  const n = accepted(id);
                  return (
                    <div className="tb-mini" key={id} data-tray={id}>
                      <div className="tb-mini-s">
                        <span className="who">
                          <i style={{ ["--p" as string]: p.ink }} />
                          {p.name}&apos;s sheet
                        </span>
                        <span className="tb-n">{n === 0 ? "none from this note yet" : `${n} from this note`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
