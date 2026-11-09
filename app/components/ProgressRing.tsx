"use client";

import type { LensProgress } from "./interview-types";

/** 56px header ring: one arc segment per drawn lens, each filling with its own progress; count in the centre. */
export function ProgressRing({ lenses, size = 56, onClick, label }: { lenses: LensProgress[]; size?: number; onClick?: () => void; label?: string }) {
  const n = Math.max(1, lenses.length);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const gap = n > 1 ? 3 : 0; // px gap between segments
  const seg = c / n - gap;
  const complete = lenses.filter((l) => l.complete).length;
  const title = label ?? `${complete} of ${lenses.length} lenses complete`;
  const content = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {lenses.map((l, i) => {
          const off = -(i * (seg + gap));
          const fill = Math.max(0, Math.min(1, l.percent / 100));
          return (
            <g key={l.lens + i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={3} strokeDasharray={`${seg} ${c - seg}`} strokeDashoffset={off} strokeLinecap="butt" />
              {fill > 0 && (
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-accent)" strokeWidth={3} strokeDasharray={`${seg * fill} ${c - seg * fill}`} strokeDashoffset={off} strokeLinecap="butt" style={{ transition: "stroke-dasharray 320ms var(--ease-out)" }} />
              )}
            </g>
          );
        })}
      </g>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--color-ink)" fontSize={13} fontWeight={500} fontFamily="var(--font-body)">
        {complete}/{lenses.length}
      </text>
    </svg>
  );
  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="icon-btn lg" aria-label={`${title}. Open progress`} style={{ width: size + 4, height: size + 4 }}>
      {content}
    </button>
  );
}
