"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  max: 5 | 6;
  labels: Record<number, string> | null;
  value: number | null; // selected (echoed) value
  previous?: number | string; // pre-selected on "back"
  disabled?: boolean;
  onPick: (v: number) => void;
};

/** 1–5: one row of five 56-tall segments. 1–6: two rows of three. Tap or drag; arrows move, Enter confirms. Long-press shows the full label. */
export function ScalePicker({ max, labels, value, previous, disabled, onPick }: Props) {
  const [focus, setFocus] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const dragging = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const nums = Array.from({ length: max }, (_, i) => i + 1);
  const lo = labels?.[1] ?? "not at all";
  const hi = labels?.[max] ?? (max === 6 ? "very much like me" : "completely");

  useEffect(() => () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }, []);

  const fromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const v = el?.closest?.("[data-v]")?.getAttribute("data-v");
    return v ? Number(v) : null;
  };

  return (
    <div ref={ref} className="w-full select-none">
      <div className="t-caption muted mb-2 flex justify-between" aria-hidden>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
      <div
        role="radiogroup"
        aria-label={`Scale 1 to ${max}`}
        className={`picker ${max === 6 ? "picker-6" : "picker-5"}`}
        onKeyDown={(e) => {
          if (disabled) return;
          const cur = focus ?? value ?? (typeof previous === "number" ? previous : 0);
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setFocus(Math.min(max, cur + 1)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setFocus(Math.max(1, cur - 1)); }
          if ((e.key === "Enter" || e.key === " ") && cur) { e.preventDefault(); onPick(cur); }
          if (/^[1-6]$/.test(e.key) && Number(e.key) <= max) { e.preventDefault(); onPick(Number(e.key)); }
        }}
        onPointerDown={(e) => { if (disabled) return; dragging.current = true; const v = fromPoint(e.clientX, e.clientY); if (v) { setFocus(v); pressTimer.current = window.setTimeout(() => setHint(v), 450); } }}
        onPointerMove={(e) => { if (!dragging.current || disabled) return; const v = fromPoint(e.clientX, e.clientY); if (v && v !== focus) { setFocus(v); setHint(null); if (pressTimer.current) window.clearTimeout(pressTimer.current); } }}
        onPointerUp={(e) => {
          if (!dragging.current || disabled) return;
          dragging.current = false;
          if (pressTimer.current) window.clearTimeout(pressTimer.current);
          const wasHint = hint !== null;
          setHint(null);
          if (wasHint) return; // the long-press only showed the label
          const v = fromPoint(e.clientX, e.clientY) ?? focus;
          if (v) onPick(v);
        }}
        onPointerCancel={() => { dragging.current = false; setHint(null); if (pressTimer.current) window.clearTimeout(pressTimer.current); }}
      >
        {nums.map((n) => {
          const selected = value === n;
          const isPrev = value === null && previous === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n}${labels?.[n] ? `, ${labels[n]}` : ""}`}
              data-v={n}
              tabIndex={(focus ?? value ?? 1) === n ? 0 : -1}
              disabled={disabled}
              className={`seg ${selected ? "selected" : ""} ${isPrev ? "previous" : ""} ${focus === n && !selected ? "outline outline-2 outline-[var(--color-accent)] -outline-offset-2" : ""}`}
              onClick={(e) => e.preventDefault()}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="t-caption muted mt-2 min-h-[1.2em] text-center" aria-live="polite">
        {hint !== null && labels?.[hint] ? labels[hint] : value && labels?.[value] ? labels[value] : previous && labels?.[Number(previous)] ? `before: ${labels[Number(previous)]}` : " "}
      </div>
    </div>
  );
}
