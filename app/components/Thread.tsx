"use client";

import { useEffect, useRef } from "react";
import { Waveform } from "./Icons";

export type ThreadTurn = { role: "agent" | "user"; content: string; mode: "voice" | "chat"; at: string; pending?: boolean; failed?: boolean };

const VOICE_KEY = "soul-voice-turns";
type VoiceMark = { content: string; at: number };

/** The engine stamps every turn as chat; spoken answers are remembered here so the thread can mark them. */
export function rememberVoiceTurn(content: string) {
  try {
    const list: VoiceMark[] = JSON.parse(localStorage.getItem(VOICE_KEY) ?? "[]");
    list.push({ content: content.trim(), at: Date.now() });
    localStorage.setItem(VOICE_KEY, JSON.stringify(list.slice(-600)));
  } catch { /* storage unavailable */ }
}
function voiceMarks(): VoiceMark[] {
  try { return JSON.parse(localStorage.getItem(VOICE_KEY) ?? "[]"); } catch { return []; }
}
export function isVoiceTurn(t: ThreadTurn, marks: VoiceMark[]): boolean {
  if (t.mode === "voice") return true;
  if (t.role !== "user") return false;
  const at = t.at ? Date.parse(t.at) : NaN;
  return marks.some((m) => m.content === t.content.trim() && (Number.isNaN(at) || Math.abs(m.at - at) < 120_000));
}

export function Thread({ turns, busy, name }: { turns: ThreadTurn[]; busy?: boolean; name?: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  const marks = typeof window !== "undefined" ? voiceMarks() : [];
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);
  return (
    <div className="flex flex-col gap-3 text-[1rem] leading-6">
      {turns.length === 0 && <p className="muted t-small">Nothing yet. Your questions and answers, typed or spoken, show up here.</p>}
      {turns.map((t, i) => {
        const voice = isVoiceTurn(t, marks);
        return (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`bubble ${t.role === "user" ? "bubble-user" : "bubble-agent"} ${voice ? "has-mark" : ""} ${t.pending ? "bubble-pending" : ""} ${t.failed ? "outline outline-1 outline-[var(--color-danger)]" : ""}`} aria-label={`${t.role === "user" ? name ?? "You" : "Soul Map"}${voice ? ", spoken" : ""}`}>
              {t.content}
              {voice && <span className="voice-mark" role="img" aria-label="spoken"><Waveform size={16} /></span>}
              {t.failed && <span className="t-caption block opacity-80">tap to retry</span>}
            </div>
          </div>
        );
      })}
      {busy && (
        <div className="flex justify-start"><div className="bubble bubble-agent dots" aria-label="Soul Map is thinking"><span>·</span><span>·</span><span>·</span></div></div>
      )}
      <div ref={endRef} />
    </div>
  );
}
