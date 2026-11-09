"use client";

type Props = {
  options: { key: string; text: string }[];
  value: string | null;
  previous?: number | string;
  disabled?: boolean;
  onPick: (key: string) => void;
};

/** A/B/C: stacked full-width cards, Fraunces letter at left, so the thumb reaches all three. */
export function OptionCards({ options, value, previous, disabled, onPick }: Props) {
  return (
    <div className="flex w-full flex-col gap-2" role="radiogroup" aria-label="Options">
      {options.map((o) => {
        const selected = value === o.key;
        const isPrev = value === null && String(previous ?? "").toLowerCase() === o.key.toLowerCase();
        return (
          <button key={o.key} type="button" role="radio" aria-checked={selected} disabled={disabled} className={`opt ${selected || isPrev ? "selected" : ""}`} onClick={() => onPick(o.key)}>
            <span className="opt-letter">{o.key.toUpperCase()}</span>
            <span className="t-small">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}
