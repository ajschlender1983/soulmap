"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, useHref } from "./api";
import { SoulMap, type Live } from "./SoulMap";
import { MapDetails } from "./MapDetails";
import { ProgressRing } from "./ProgressRing";
import { ScalePicker } from "./ScalePicker";
import { OptionCards } from "./OptionCards";
import { ClockPicker } from "./ClockPicker";
import { Sheet } from "./Sheet";
import { Thread, rememberVoiceTurn, type ThreadTurn } from "./Thread";
import { useVoice, voiceUnsupportedReason } from "./useVoice";
import { ArrowLeft, ArrowRight, ArrowUp, Keyboard, List, Mic, Skip, Stop, Waveform } from "./Icons";
import { lensName, minutesLeft, normNext, type AnswerResult, type Item, type Next } from "./interview-types";

const EMPTY_LIVE: Live = { progress: { enneagram: 0, attachment: 0, kolbe: 0, birth: 0 }, enneagram: null, attachment: null, kolbe: null, chart: null };
type MapResp = Live & { turns?: ThreadTurn[]; status?: string; profile?: { name?: string; consent_at?: string; enabled_lenses?: string[] }; has_chart?: boolean };

type View = "loading" | "home" | "interview" | "reveal";

export function Interview() {
  const h = useHref();
  const [view, setView] = useState<View>("loading");
  const [name, setName] = useState("");
  const [next, setNext] = useState<Next | null>(null);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [pendingTurn, setPendingTurn] = useState<string | null>(null);
  const [intro, setIntro] = useState<string | null>(null);
  const [clarify, setClarify] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [draft, setDraft] = useState("");
  const [liveDraft, setLiveDraft] = useState("");
  const [composer, setComposer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<null | "transcript" | "map" | "progress">(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [resumeTick, setResumeTick] = useState(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const voiceRef = useRef<{ stop: () => void }>({ stop: () => {} });
  const wasDone = useRef<boolean | null>(null);
  const holdTimer = useRef<number | null>(null);

  // ---------- data ----------
  const refreshMap = useCallback(async () => {
    const j = await api<MapResp>("/api/map");
    if (j._status !== 200) return;
    setLive(j);
    setTurns((j.turns ?? []).map((t) => ({ role: t.role, content: t.content, mode: t.mode, at: t.at })));
    if (j.profile?.name) setName(j.profile.name);
  }, []);

  const applyNext = useCallback((raw: unknown) => {
    const n = normNext(raw);
    setNext(n);
    setSelected(null);
    setClarify(null);
    setDraft("");
    setLiveDraft("");
    if (n.intro) setIntro(n.intro);
    if (wasDone.current === false && n.done) setView("reveal");
    wasDone.current = n.done;
    return n;
  }, []);

  useEffect(() => {
    (async () => {
      const prof = await api<{ profile?: { consent_at?: string; name?: string } }>("/api/profile");
      if (prof._status === 200 && !prof.profile?.consent_at) { window.location.replace(h("/onboarding")); return; }
      if (prof.profile?.name) setName(prof.profile.name);
      const [n] = await Promise.all([api<Next>("/api/interview/next", { method: "POST", json: {} }), refreshMap()]);
      const nn = normNext(n);
      wasDone.current = nn.done;
      setNext(nn);
      if (nn.intro) setIntro(nn.intro);
      setView("home");
    })().catch(() => { setErr("Could not reach the Soul Map. Is the app running on this Mac?"); setView("home"); });
  }, [refreshMap]);

  // poll the map while it is on screen
  useEffect(() => {
    if (view === "interview" && sheet !== "map") return;
    const id = window.setInterval(() => { refreshMap().catch(() => {}); }, 4000);
    return () => window.clearInterval(id);
  }, [view, sheet, refreshMap]);

  // the home screen never goes stale: re-ask the engine every 5 s and whenever the tab comes back
  useEffect(() => {
    if (view !== "home") return;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      const n = await api<Next>("/api/interview/next", { method: "POST", json: {} }).catch(() => null);
      if (!alive || !n || n._status !== 200) return;
      const nn = normNext(n);
      setNext(nn);
      if (nn.intro) setIntro(nn.intro);
      if (wasDone.current === false && nn.done) setView("reveal");
      wasDone.current = nn.done;
    };
    const id = window.setInterval(() => { tick(); }, 5000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [view]);

  const item = next?.item ?? null;
  const progress = next?.progress ?? null;
  const done = !!next?.done;

  // ---------- answering ----------
  const submit = useCallback(async (opts: { value?: number | string; text?: string; mode: "tap" | "text" | "voice" }) => {
    if (!item || busy) return;
    const text = (opts.text ?? "").trim();
    if (opts.value === undefined && !text) return;
    setBusy(true); setErr("");
    if (opts.value !== undefined) setSelected(opts.value);
    if (text) { setPendingTurn(text); if (opts.mode === "voice") rememberVoiceTurn(text); }
    try {
      const r = await api<AnswerResult>("/api/interview/answer", { method: "POST", json: { item_id: item.id, text, value: opts.value ?? null, mode: opts.mode === "voice" ? "voice" : "chat" } });
      if (r._status >= 500) throw new Error(r.error ?? "The Soul Map could not save that answer.");
      if (r.command) {
        // the words were a command, not an answer
        if (r.paused) { voiceRef.current.stop(); applyNext(r.next); setView("home"); setNote("Paused. Pick up any time."); return; }
        if (r.command === "back" && (r.next as { reopened?: boolean }).reopened === false) setNote("You are at the start of this part.");
        applyNext(r.next);
        return;
      }
      if (r.ok) {
        const echoed = r.parsed?.value;
        if (echoed !== undefined && opts.value === undefined) setSelected(echoed);
        await new Promise((res) => setTimeout(res, 250)); // show the chosen pill before advancing
        applyNext(r.next);
      } else if (r.needs_clarification) {
        setClarify(r.prompt ?? "Could you say that another way?");
        setSelected(null);
        if (r.next?.item && r.next.item.id !== item.id) applyNext(r.next);
      } else {
        setErr(r.error ?? "That answer did not go through. Try again.");
        setSelected(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Offline. Your answer was not saved; try again.");
      setSelected(null);
    } finally {
      setBusy(false); setPendingTurn(null); setDraft(""); setLiveDraft("");
      refreshMap().catch(() => {});
    }
  }, [item, busy, applyNext, refreshMap]);

  const skip = useCallback(async () => {
    if (!item || busy) return;
    setBusy(true); setErr("");
    try { const r = await api<{ next?: Next } & Next>("/api/interview/skip", { method: "POST", json: { item_id: item.id } }); applyNext(r.next ?? r); }
    catch { setErr("Could not skip right now."); }
    finally { setBusy(false); refreshMap().catch(() => {}); }
  }, [item, busy, applyNext, refreshMap]);

  const back = useCallback(async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api<{ next?: Next; reopened?: boolean } & Next>("/api/interview/back", { method: "POST", json: {} });
      if (r.reopened === false) setNote("You are at the start of this part.");
      applyNext(r.next ?? r);
    } catch { setErr("Could not go back right now."); }
    finally { setBusy(false); }
  }, [busy, applyNext]);

  useEffect(() => { if (!note) return; const id = window.setTimeout(() => setNote(""), 2200); return () => window.clearTimeout(id); }, [note]);

  // ---------- voice ----------
  const voice = useVoice({
    onFinal: (t) => {
      const cmd = t.toLowerCase().replace(/[^a-z ]/g, "").trim();
      if (/^(skip|skip it|pass|next)$/.test(cmd)) { skip(); return; }
      if (/^(go back|back)$/.test(cmd)) { back(); return; }
      if (/^(stop voice|end voice)$/.test(cmd)) { voice.stop(); return; }
      submit({ text: t, mode: "voice" }); // "faster", "slower", "stop", "pause" are handled by the engine

    },
    onInterim: setLiveDraft,
    onError: (m, fatal) => { setVoiceNote(m); if (fatal) setComposer(true); },
  });
  voiceRef.current = voice;
  const unsupported = voiceUnsupportedReason(voice.support);

  // say it once why the mic is hidden
  useEffect(() => {
    if (!unsupported || view === "loading") return;
    try { if (localStorage.getItem("soul-voice-note") === unsupported) return; localStorage.setItem("soul-voice-note", unsupported); } catch { /* ignore */ }
    setVoiceNote(unsupported);
  }, [unsupported, view]);

  // read whatever is current: intro, clarification, or the question; then listen
  const spokenFor = useRef<string>("");
  useEffect(() => {
    if (!voice.on || view !== "interview") return;
    const key = `${intro ? "intro" : clarify ? "clar:" + clarify : "item:" + (item?.id ?? "")}|${resumeTick}`;
    if (spokenFor.current === key) return;
    spokenFor.current = key;
    if (intro) { voice.speak(intro, false, () => setIntro(null)); return; }
    if (clarify) { voice.speak(clarify, true); return; }
    if (item) {
      const cue = item.scale && item.index === 1 && !next?.compact ? ` ${item.scale}` : "";
      const abc = item.kind === "abc" ? " " + item.options.map((o) => `${o.key.toUpperCase()}: ${o.text}`).join(". ") : "";
      voice.speak(`${item.say}${abc}${cue}`, true);
    } else if (done) { voice.speak("That was the last question. Your map is complete.", false); }
  }, [voice.on, voice, view, intro, clarify, item, done, resumeTick, next?.compact]);
  useEffect(() => { voice.onResume(() => setResumeTick((n) => n + 1)); return () => voice.onResume(null); }, [voice]);
  useEffect(() => { if (!voice.on) spokenFor.current = ""; }, [voice.on]);

  const startVoice = () => { setVoiceNote(null); setComposer(false); voice.start(); if (view !== "interview") setView("interview"); };
  const holdStart = () => { holdTimer.current = window.setTimeout(() => { voice.stop(); setNote("Voice ended."); holdTimer.current = null; }, 600); };
  const holdEnd = () => { if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; setNote("Hold to end voice."); } };

  // ---------- derived ----------
  const lenses = progress?.lenses ?? [];
  const statusLine = useMemo(() => {
    if (!progress) return "";
    if (done) return "Every lens answered. Know Thyself.";
    const idx = progress.part_index || 1;
    return `Part ${idx} of ${progress.part_count || 5} · ${minutesLeft(progress)} min left`;
  }, [progress, done]);
  const shownTurns: ThreadTurn[] = pendingTurn ? [...turns, { role: "user", content: pendingTurn, mode: "chat", at: "", pending: true }] : turns;
  const voiceLabel = voice.state === "speaking" ? (intro ?? clarify ?? item?.say ?? "").slice(0, 40) + "…" : voice.state === "listening" ? (liveDraft || "Listening…") : voice.state === "paused" ? "Paused" : "Voice on";

  // ---------- render ----------
  if (view === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="w-[60vw] max-w-xs opacity-60"><SoulMap live={EMPTY_LIVE} /></div>
      </main>
    );
  }

  if (view === "home" || view === "reveal") {
    const started = (progress?.answered ?? 0) > 0;
    return (
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col md:grid md:grid-cols-[1fr_22rem] md:items-center md:gap-8 md:px-8">
        <section className={`gutter pt-4 ${view === "reveal" ? "reveal-map" : "fade-in"}`}>
          <div className="mx-auto aspect-square w-full max-w-[min(92vw,70vh)]">
            <SoulMap live={{ ...live, agentTalking: voice.state === "speaking" }} onRegion={() => setSheet("map")} />
          </div>
        </section>
        <section className="gutter safe-bottom flex flex-1 flex-col justify-end gap-3 pt-2 md:justify-center">
          {view === "reveal" ? (
            <>
              <h1 className="fade-in">Your map is complete{name ? `, ${name.split(" ")[0]}` : ""}.</h1>
              <p className="t-small muted">Every lens is drawn. The report reads it back to you.</p>
            </>
          ) : (
            <>
              <h1>{done ? "Your Soul Map" : started ? `Welcome back${name ? `, ${name.split(" ")[0]}` : ""}.` : `Hi${name ? ` ${name.split(" ")[0]}` : ""}.`}</h1>
              <p className="t-small muted" aria-live="polite">{statusLine}{!started && !done ? ". Short parts; stop any time, it remembers." : ""}</p>
            </>
          )}
          {err && <p className="t-small text-[var(--color-danger)]">{err}</p>}
          {done ? (
            <a className="btn btn-primary btn-block" href={h("/report")}>See my report <ArrowRight /></a>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={() => setView("interview")} disabled={!item}>
              {started ? "Continue" : "Begin"} <ArrowRight />
            </button>
          )}
          {note && <p className="t-caption muted" aria-live="polite">{note}</p>}
          <nav className="grid grid-cols-3 gap-1" aria-label="More">
            <a className="btn btn-ghost" href={h("/map")}>Full map</a>
            <button type="button" className="btn btn-ghost" onClick={() => setSheet("transcript")}>Transcript</button>
            <a className="btn btn-ghost" href={h("/evidence")}>Connections</a>
            {done ? <a className="btn btn-ghost" href={h("/soul-file")}>Soul file</a> : <span className="btn btn-ghost opacity-50" aria-disabled title="Unlocks when every lens is answered">Report</span>}
            <a className="btn btn-ghost" href={h("/onboarding?step=lenses")}>Settings</a>
            <a className="btn btn-ghost" href={h("/team")}>Team</a>
            <a className="btn btn-ghost" href={h("/energy")}>Energy Audit</a>
          </nav>
        </section>
        <Sheet open={sheet === "transcript"} onClose={() => setSheet(null)} title="Transcript" tall><Thread turns={shownTurns} name={name} /></Sheet>
        <Sheet open={sheet === "map"} onClose={() => setSheet(null)} title="Your map" tall>
          <div className="mx-auto aspect-square w-full max-w-sm"><SoulMap live={live} /></div>
          <div className="mt-4"><MapDetails live={live} /></div>
          <a className="btn btn-secondary btn-block mt-4" href={h("/map")}>Open the full map</a>
        </Sheet>
      </main>
    );
  }

  // ---------- interview ----------
  const lensLabel = item ? lensName(item.lens) : "";
  const control = (() => {
    if (!item) return null;
    const prev = item.previous;
    if (item.kind === "scale5" || item.kind === "scale6") {
      return <ScalePicker key={item.id} max={item.kind === "scale6" ? 6 : 5} labels={item.labels} value={typeof selected === "number" ? selected : null} previous={prev} disabled={busy} onPick={(v) => submit({ value: v, mode: "tap" })} />;
    }
    if (item.kind === "abc") return <OptionCards key={item.id} options={item.options} value={typeof selected === "string" ? selected : null} previous={prev} disabled={busy} onPick={(k) => submit({ value: k, mode: "tap" })} />;
    if (item.kind === "clock") return <ClockPicker key={item.id} previous={prev} disabled={busy} onPick={(t) => submit({ value: t, text: t, mode: "tap" })} onNotSure={() => submit({ text: "not sure", mode: "text" })} />;
    return null; // text: the composer below is primary
  })();
  const textPrimary = item?.kind === "text";
  const showComposer = textPrimary || composer || (!!clarify && !voice.on);

  return (
    <main className="grid h-dvh grid-rows-[auto_1fr_auto] md:grid-cols-[1fr_24rem]">
      {/* top bar */}
      <header className="gutter flex items-center justify-between gap-2 pt-[max(8px,env(safe-area-inset-top))] pb-1 md:col-span-2">
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn" onClick={() => { voice.stop(); setView("home"); }} aria-label="Back to home"><ArrowLeft /></button>
          <button type="button" className="icon-btn md:hidden" onClick={() => setSheet("map")} aria-label="Open your map">
            <span className="block h-8 w-8"><SoulMap live={live} compact /></span>
          </button>
        </div>
        <button type="button" className="flex items-center gap-2 rounded-[var(--radius-pill)] px-2 py-1" onClick={() => setSheet("progress")} aria-label="Progress by lens">
          <span className="t-caption muted">{done ? "complete" : `part ${progress?.part_index || 1} of ${progress?.part_count || 5}`}</span>
          <ProgressRing lenses={lenses} size={44} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setSheet("transcript")} aria-label="Transcript"><List /></button>
      </header>

      {/* question */}
      <section className="gutter flex min-h-0 flex-col justify-end overflow-y-auto pb-4 md:justify-center">
        {intro ? (
          <div className="card fade-in" role="region" aria-label="Section intro">
            <p className="t-label muted mb-2">{item ? lensName(item.lens) : "Welcome"}</p>
            <p className="text-[var(--text-body)] whitespace-pre-wrap">{intro}</p>
            {!voice.on && <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => setIntro(null)}>Let&apos;s go <ArrowRight /></button>}
          </div>
        ) : item ? (
          <div key={item.id} className="fade-in">
            <p className="t-label muted mb-3">{lensLabel}{item.of ? ` · ${item.index} of ${item.of}` : ""}{item.reasked ? " · asked once more" : ""}{item.previous !== undefined ? " · your earlier answer is marked" : ""}</p>
            <h1 className={item.say.length > 110 ? "text-[var(--text-h2)]" : "display"}>{item.say}</h1>
            {item.scale && item.index === 1 && !next?.compact && <p className="t-small muted mt-3">{item.scale}</p>}
            {clarify && <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] px-4 py-3 t-small" role="alert">{clarify}</div>}
          </div>
        ) : done ? (
          <div className="fade-in">
            <h1 className="display">That was the last one.</h1>
            <button type="button" className="btn btn-primary mt-6" onClick={() => setView("reveal")}>See my map <ArrowRight /></button>
          </div>
        ) : (
          <p className="muted">Nothing to ask right now.</p>
        )}
        {err && <p className="t-small mt-3 text-[var(--color-danger)]" role="alert">{err}</p>}
        {note && <p className="t-caption muted mt-3" aria-live="polite">{note}</p>}
      </section>

      {/* desktop map pane */}
      <aside className="hidden md:row-span-2 md:flex md:items-center md:justify-center md:border-l md:border-[var(--color-line)] md:p-6">
        <div className="aspect-square w-full max-w-[22rem]"><SoulMap live={{ ...live, agentTalking: voice.state === "speaking" }} onRegion={() => setSheet("map")} /></div>
      </aside>

      {/* thumb zone */}
      <footer className="gutter safe-bottom flex flex-col gap-3 border-t border-[var(--color-line)] pt-3 md:col-start-1">
        {!intro && item && control && !showComposer && <div className={busy ? "pointer-events-none opacity-70" : ""}>{control}</div>}
        {!intro && item && showComposer && (
          <div className="flex items-end gap-2">
            <textarea
              ref={fieldRef}
              value={voice.state === "listening" && liveDraft ? liveDraft : draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit({ text: draft, mode: "text" }); } }}
              placeholder={item.kind === "clock" ? "A time, like 7:30 or 11 pm" : item.kind === "text" ? "Say it in your own words" : "Type your answer, or a number"}
              rows={2}
              disabled={busy}
              className="field min-h-[3.25rem] flex-1 resize-none"
              aria-label="Your answer"
              autoFocus={!voice.on}
            />
            <button type="button" className="btn btn-primary" style={{ minHeight: 48, padding: "0 16px" }} onClick={() => submit({ text: draft, mode: "text" })} disabled={busy || !draft.trim()} aria-label="Send"><ArrowUp /></button>
          </div>
        )}
        {busy && pendingTurn && (
          <p className="t-caption muted flex items-center gap-2" role="status" aria-live="polite">
            <span className="dots inline-flex gap-0.5" aria-hidden><span>·</span><span>·</span><span>·</span></span> Reading that…
          </p>
        )}
        {voiceNote && <p className="t-caption muted" role="status">{voiceNote}</p>}

        {voice.on ? (
          <div className="flex min-h-[72px] items-center gap-3" aria-live="polite">
            <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden>
              <span className={`absolute inset-0 rounded-full border-2 ${voice.state === "listening" ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]" : voice.state === "speaking" ? "border-[var(--color-accent)] orb-talk" : voice.state === "paused" ? "border-dashed border-[var(--color-muted)]" : "border-[var(--color-line)]"}`} style={voice.state === "listening" ? { transform: `scale(${1 + voice.level * 0.35})`, transition: "transform 80ms linear" } : undefined} />
              {voice.state === "listening" ? <Mic /> : voice.state === "speaking" ? <Waveform /> : <Mic />}
            </span>
            <span className="t-small min-w-0 flex-1 truncate">{voiceLabel}</span>
            <button type="button" className="btn btn-ghost" onClick={() => { voice.stop(); setComposer(true); setTimeout(() => fieldRef.current?.focus(), 50); }}>Keep typing instead</button>
            <button type="button" className="icon-btn lg outlined" aria-label="Hold to end voice" onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => e.preventDefault()}><Stop /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="btn btn-ghost" onClick={skip} disabled={busy || !item || !!intro}><Skip /> Skip</button>
            <div className="flex gap-1">
              {!textPrimary && item && !intro && (
                <button type="button" className="icon-btn lg outlined" onClick={() => { setComposer((c) => !c); setTimeout(() => fieldRef.current?.focus(), 50); }} aria-label={composer ? "Use the pills" : "Type your answer instead"} aria-pressed={composer}><Keyboard /></button>
              )}
              {!unsupported && <button type="button" className="icon-btn lg outlined" onClick={startVoice} aria-label="Answer by voice" disabled={busy}><Mic /></button>}
            </div>
            <button type="button" className="btn btn-ghost" onClick={back} disabled={busy || !!intro}><ArrowLeft /> Back</button>
          </div>
        )}
      </footer>

      <Sheet open={sheet === "transcript"} onClose={() => setSheet(null)} title="Transcript" tall><Thread turns={shownTurns} busy={busy && !!pendingTurn} name={name} /></Sheet>
      <Sheet open={sheet === "map"} onClose={() => setSheet(null)} title="Your map" tall>
        <div className="mx-auto aspect-square w-full max-w-sm"><SoulMap live={live} /></div>
        <div className="mt-4"><MapDetails live={live} /></div>
        <a className="btn btn-secondary btn-block mt-4" href={h("/map")}>Open the full map</a>
      </Sheet>
      <Sheet open={sheet === "progress"} onClose={() => setSheet(null)} title="Progress">
        <ul className="flex flex-col gap-3 py-2">
          {lenses.map((l) => (
            <li key={l.lens} className="flex items-center gap-3">
              <span className="t-small w-32 shrink-0">{lensName(l.lens)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]"><span className="block h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${l.percent}%` }} /></span>
              <span className="t-caption muted w-24 text-right">{l.from === "birth" ? (l.complete ? "from birth" : "needs birth") : l.complete ? "done" : `${l.answered}/${l.total} · ${Math.round(((l.total - l.answered) * 20) / 60)} min`}</span>
            </li>
          ))}
        </ul>
        <p className="t-caption muted">About 20 seconds a question. Stop any time; it remembers where you were.</p>
      </Sheet>
    </main>
  );
}
