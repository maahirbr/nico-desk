"use client";
// Threads from a moved line back to the sheet behind it (in) or forward to the sheet it moved to (out).
// They draw in only when the view opens or a date moves. A redraw for a resize or a font load stays still.
import { useEffect, useRef } from "react";

const NS = "http://www.w3.org/2000/svg";

// layout changes when lines move on the sheet without a date moving. It redraws the threads, still.
export function ThreadLayer({ sig, layout }: { sig: string; layout?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawn = useRef<string | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const stack = svg?.parentElement;
    const sheet = stack?.querySelector(".sheet");
    if (!svg || !stack || !sheet) return;
    let alive = true;
    let size = "";

    const draw = (withMotion: boolean) => {
      const box = stack.getBoundingClientRect();
      const sh = sheet.getBoundingClientRect();
      size = `${Math.round(box.width)}x${Math.round(box.height)}`;
      svg.replaceChildren();
      stack.querySelectorAll<HTMLElement>("[data-thread]").forEach((el) => {
        // The hook lands at the middle of the line's first text row, and stops just short of the text.
        const first = el.querySelector<HTMLElement>("[data-first]") ?? el;
        const r = first.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(first).lineHeight);
        const y = r.top - box.top + (Number.isFinite(lh) ? lh : r.height) / 2;
        const x = sh.left - box.left + 9;
        const hook = Math.max(x + 4, r.left - box.left - 6);
        // Every point stays inside the sheet box. A backward thread starts just inside the top edge, where the
        // stacked sheet peeks out behind. A forward thread ends in a short tick at least 14px above the bottom edge.
        const top = sh.top - box.top + 2;
        const tickY = Math.max(y + 8, sh.bottom - box.top - 14);
        const d =
          el.dataset.thread === "in"
            ? `M ${x + 14} ${top} C ${x + 4} ${top + 24}, ${x} ${Math.max(top + 24, y - 40)}, ${x} ${Math.max(top + 30, y - 6)} L ${x} ${y} L ${hook} ${y}`
            : `M ${hook} ${y} L ${x} ${y} L ${x} ${tickY} L ${x + 14} ${tickY}`;
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        p.style.stroke = el.dataset.ink ?? "var(--ink)";
        svg.appendChild(p);
        p.style.setProperty("--len", String(Math.ceil(p.getTotalLength()) + 1));
        if (withMotion) p.classList.add("draw");
      });
    };

    let ro: ResizeObserver | undefined;
    const start = () => {
      if (!alive) return;
      draw(drawn.current !== sig);
      drawn.current = sig;
      ro = new ResizeObserver(() => {
        const box = stack.getBoundingClientRect();
        if (`${Math.round(box.width)}x${Math.round(box.height)}` !== size) draw(false);
      });
      ro.observe(stack);
    };
    requestAnimationFrame(() => (document.fonts ? document.fonts.ready.then(start) : start()));
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [sig, layout]);

  // A drawn thread keeps its full length: the class goes when the animation ends.
  return (
    <svg
      ref={svgRef}
      className="threads"
      aria-hidden
      onAnimationEnd={(e) => {
        if (e.animationName === "thread-draw") (e.target as Element).classList.remove("draw");
      }}
    />
  );
}
