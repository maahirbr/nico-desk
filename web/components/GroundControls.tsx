"use client";
// NIGHT and STATIC, in the locked control form. The DOM holds the truth (the boot script set it before paint).
// Each choice is kept in localStorage; it can be blocked, so every access has try/catch.
import { useSyncExternalStore } from "react";

const subs = new Set<() => void>();
const listen = (cb: () => void) => {
  subs.add(cb);
  return () => void subs.delete(cb);
};
const emit = () => subs.forEach((f) => f());
const isNight = () => document.documentElement.classList.contains("dark");
const isStill = () => document.documentElement.dataset.motion === "static";

function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function GroundControls() {
  const night = useSyncExternalStore(listen, isNight, () => false);
  const still = useSyncExternalStore(listen, isStill, () => false);

  const flipNight = () => {
    document.documentElement.classList.toggle("dark", !night);
    remember("nd-ground", night ? null : "night");
    emit();
  };
  const flipStill = () => {
    if (still) delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = "static";
    remember("nd-static", still ? null : "1");
    emit();
  };

  return (
    <div className="flex gap-5">
      <button type="button" className="alt-btn" aria-pressed={night} onClick={flipNight}>
        {night ? "Day" : "Night"}
      </button>
      <button type="button" className="alt-btn" aria-pressed={still} onClick={flipStill}>
        {still ? "Motion on" : "Static"}
      </button>
    </div>
  );
}
