"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";

type Props = {
  accessToken: string;
  callId: string;
  transport?: "gateway" | "livekit";
  iceServers?: RTCIceServer[];
  onEnded: (error?: string) => void;
  onTalking: (talking: boolean) => void;
  onLiveTurns: (turns: Turn[]) => void; // instant, client-side copy of the call transcript
  stopSignal?: number; // bump to hang up from outside (e.g. the person typed a chat message)
};

type Turn = { role: string; content: string };

export function describeCallError(err: unknown): string {
  const e = err as { name?: string; message?: string } | string | undefined;
  const name = typeof e === "object" && e ? e.name ?? "" : "";
  const msg = typeof e === "string" ? e : (typeof e === "object" && e && e.message) || "";
  if (name === "NotAllowedError" || /permission denied/i.test(msg)) return "Microphone permission was denied. Allow the microphone for localhost:3000 and try again.";
  if (name === "NotFoundError" || /device not found/i.test(msg)) return "No microphone found in this browser. Open http://localhost:3000 in Chrome and try again.";
  return `Call failed: ${msg || name || "unknown error"}`;
}

/** Headless voice session: keeps the Retell call alive and streams its transcript into the shared thread. */
export function VoiceSession({ accessToken, callId, transport, iceServers, onEnded, onTalking, onLiveTurns, stopSignal }: Props) {
  const clientRef = useRef<RetellWebClient | null>(null);
  const [connected, setConnected] = useState(false);
  const lastPush = useRef(0);
  const pending = useRef<Turn[] | null>(null);

  useEffect(() => {
    let alive = true;
    const client = new RetellWebClient();
    clientRef.current = client;
    const push = (turns: Turn[]) => fetch((process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call_id: callId, turns }) }).catch(() => {});

    client.on("call_started", () => alive && setConnected(true));
    client.on("agent_start_talking", () => alive && onTalking(true));
    client.on("agent_stop_talking", () => alive && onTalking(false));
    client.on("update", (u: { transcript?: Turn[] }) => {
      if (!alive || !u.transcript) return;
      onLiveTurns(u.transcript);
      pending.current = u.transcript;
      const now = Date.now();
      if (now - lastPush.current > 1500) { lastPush.current = now; push(u.transcript); pending.current = null; }
    });
    client.on("call_ended", () => { if (pending.current) push(pending.current); if (alive) onEnded(); });
    client.on("error", (err: unknown) => { console.error("[retell] error", err); if (alive) onEnded(describeCallError(err)); });
    client.startCall({ accessToken, callId, transport, iceServers }).catch((err: unknown) => { console.error("[retell] startCall failed", err); if (alive) onEnded(describeCallError(err)); });

    return () => { alive = false; try { client.stopCall(); } catch { /* ignore */ } };
  }, [accessToken, callId, transport, iceServers, onEnded, onTalking, onLiveTurns]);

  useEffect(() => { if (stopSignal) clientRef.current?.stopCall(); }, [stopSignal]);

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-pill)] border border-[var(--color-line)] px-4 py-3 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-[var(--color-accent)] orb-breathe" : "bg-[var(--color-muted)]"}`} />
      <span className="flex-1 text-[var(--color-muted)]">{connected ? "Voice on. Talk, or type below to switch." : "connecting…"}</span>
      <button type="button" onClick={() => clientRef.current?.stopCall()} className="text-xs text-[var(--color-ink)] underline">End voice</button>
    </div>
  );
}
