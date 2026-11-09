"use client";

import { useState } from "react";
import { Check } from "./Icons";

type Props = { previous?: number | string; disabled?: boolean; onPick: (hhmm: string) => void; onNotSure: () => void };

/** Clock items: the phone's own time wheel (`input type=time` opens the native picker on iOS) plus [Not sure]. */
export function ClockPicker({ previous, disabled, onPick, onNotSure }: Props) {
  const [t, setT] = useState<string>(typeof previous === "string" && /^\d{1,2}:\d{2}$/.test(previous) ? previous.padStart(5, "0") : "");
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="time"
          value={t}
          onChange={(e) => setT(e.target.value)}
          disabled={disabled}
          aria-label="Time"
          className="field flex-1 text-center text-[1.375rem]"
          style={{ fontFamily: "var(--font-display)" }}
        />
        <button type="button" className="btn btn-primary" disabled={disabled || !t} onClick={() => t && onPick(t)} aria-label="Confirm time">
          <Check />
        </button>
      </div>
      <button type="button" className="btn btn-secondary btn-sm self-center" disabled={disabled} onClick={onNotSure}>Not sure</button>
    </div>
  );
}
