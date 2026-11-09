"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Close } from "./Icons";

type Props = { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean };

/** Bottom sheet: swipe down (drag the handle) or tap the backdrop to close. Centred panel on desktop. */
export function Sheet({ open, onClose, title, children, tall }: Props) {
  const startY = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Sheet"}
        style={tall ? { height: "92dvh" } : undefined}
        onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          if (startY.current === null || !panel.current) return;
          const dy = e.touches[0].clientY - startY.current;
          const scroller = panel.current.querySelector("[data-scroll]");
          if (dy > 0 && (!scroller || scroller.scrollTop <= 0)) panel.current.style.transform = `translateY(${Math.min(dy, 400)}px)`;
        }}
        onTouchEnd={(e) => {
          if (startY.current === null || !panel.current) return;
          const dy = e.changedTouches[0].clientY - startY.current;
          panel.current.style.transform = "";
          startY.current = null;
          if (dy > 90) onClose();
        }}
      >
        <div className="sheet-handle" />
        <div className="flex items-center justify-between px-4 pt-2">
          <h2 className="text-[var(--text-h2)]">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Close /></button>
        </div>
        <div data-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">{children}</div>
      </div>
    </>
  );
}
