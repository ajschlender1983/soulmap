"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phone-native voice, no vendor: `speechSynthesis` reads the question, `SpeechRecognition`
 * (webkitSpeechRecognition on iOS Safari 14.5+) captures the answer. The two never overlap:
 * recognition starts only after the utterance ends, and is stopped before anything is spoken.
 */

export type VoiceState = "off" | "idle" | "speaking" | "listening" | "paused";
export type VoiceSupport = { synthesis: boolean; recognition: boolean };

type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type SRCtor = new () => SR;

function recognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function detectVoiceSupport(): VoiceSupport {
  if (typeof window === "undefined") return { synthesis: false, recognition: false };
  return { synthesis: "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined", recognition: !!recognitionCtor() };
}

/** Why the mic is hidden, in one line, or null when it works. */
export function voiceUnsupportedReason(s: VoiceSupport): string | null {
  if (s.recognition && s.synthesis) return null;
  if (!s.recognition && !s.synthesis) return "This browser has no speech recognition or read-aloud. On iPhone use Safari 14.5 or newer; on a Mac use Safari or Chrome.";
  if (!s.recognition) return "This browser cannot turn speech into text (Firefox and some in-app browsers). Open this page in Safari or Chrome to answer by voice.";
  return "This browser cannot read aloud, so voice mode is typing-only here.";
}

type Options = {
  onFinal: (text: string) => void; // a captured answer
  onInterim?: (text: string) => void;
  onError?: (message: string, fatal: boolean) => void;
  lang?: string;
};

export function useVoice({ onFinal, onInterim, onError, lang = "en-US" }: Options) {
  const [support, setSupport] = useState<VoiceSupport>({ synthesis: false, recognition: false });
  const [state, setState] = useState<VoiceState>("off");
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(0); // 0..1 rough mic amplitude
  const rec = useRef<SR | null>(null);
  const onRef = useRef(false);
  const pausedRef = useRef(false);
  const speakingRef = useRef(false);
  const interim = useRef("");
  const silentRestarts = useRef(0);
  const cbs = useRef({ onFinal, onInterim, onError });
  cbs.current = { onFinal, onInterim, onError };
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const resumeRef = useRef<null | (() => void)>(null);

  useEffect(() => { setSupport(detectVoiceSupport()); }, []);

  const stopMeter = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    a.stream.getTracks().forEach((t) => t.stop());
    a.ctx.close().catch(() => {});
    audio.current = null;
    setLevel(0);
  }, []);

  /** A live amplitude ring for the listening state; best effort, never required. */
  const startMeter = useCallback(async () => {
    if (audio.current || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        if (audio.current) audio.current.raf = requestAnimationFrame(tick);
      };
      audio.current = { ctx, stream, raf: requestAnimationFrame(tick) };
    } catch { /* no meter; recognition still works */ }
  }, []);

  const stopListening = useCallback(() => {
    const r = rec.current;
    rec.current = null;
    if (r) { r.onend = null; r.onresult = null; r.onerror = null; try { r.abort(); } catch { /* already stopped */ } }
    stopMeter();
    setState((s) => (s === "listening" ? (onRef.current ? "idle" : "off") : s));
  }, [stopMeter]);

  const listen = useCallback(() => {
    if (!onRef.current || pausedRef.current || speakingRef.current) return;
    const Ctor = recognitionCtor();
    if (!Ctor) { cbs.current.onError?.("Speech recognition is not available here.", true); return; }
    stopListening();
    const r = new Ctor();
    r.lang = lang;
    r.continuous = false; // iOS ends on a pause anyway; one utterance per answer keeps it predictable
    r.interimResults = true;
    r.maxAlternatives = 1;
    interim.current = "";
    r.onstart = () => { setState("listening"); startMeter(); };
    r.onresult = (e) => {
      let finalText = "";
      let draft = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += txt; else draft += txt;
      }
      if (draft) { interim.current = draft; cbs.current.onInterim?.(draft); }
      if (finalText.trim()) {
        interim.current = "";
        silentRestarts.current = 0;
        stopListening();
        cbs.current.onFinal(finalText.trim());
      }
    };
    r.onerror = (e) => {
      const code = e.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        onRef.current = false; setOn(false); setState("off"); stopListening();
        cbs.current.onError?.("Microphone permission was not given. Allow the microphone for this site in Settings and tap the mic again.", true);
        return;
      }
      if (code === "aborted") return; // our own stop
      if (code === "no-speech" || code === "audio-capture" || code === "network") {
        // let onend decide whether to retry
        return;
      }
      cbs.current.onError?.(`Voice hiccup (${code}). Tap the mic to try again.`, false);
    };
    r.onend = () => {
      if (rec.current !== r) return; // superseded
      rec.current = null;
      stopMeter();
      const draft = interim.current.trim();
      if (draft) { interim.current = ""; silentRestarts.current = 0; setState("idle"); cbs.current.onFinal(draft); return; }
      if (!onRef.current || pausedRef.current) { setState(onRef.current ? "paused" : "off"); return; }
      if (silentRestarts.current < 2) { silentRestarts.current += 1; try { listenRef.current(); } catch { setState("idle"); } return; }
      silentRestarts.current = 0;
      setState("idle");
      cbs.current.onError?.("I did not hear anything. Tap the mic when you are ready.", false);
    };
    rec.current = r;
    try { r.start(); } catch { setState("idle"); }
  }, [lang, startMeter, stopListening, stopMeter]);
  const listenRef = useRef(listen);
  listenRef.current = listen;

  const stopSpeaking = useCallback(() => {
    speakingRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  /** Read text aloud, then (when `thenListen`) open the mic. Never listens while speaking. */
  const speak = useCallback((text: string, thenListen = true, onDone?: () => void) => {
    if (!onRef.current) return;
    stopListening();
    stopSpeaking();
    if (!support.synthesis || !text.trim()) { onDone?.(); if (thenListen) listen(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find((v) => v.lang === lang && /Samantha|Ava|Allison|Karen|Daniel|Google US English/i.test(v.name)) ?? voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (pick) u.voice = pick;
    speakingRef.current = true;
    setState("speaking");
    const done = () => {
      if (!speakingRef.current) return;
      speakingRef.current = false;
      if (!onRef.current) { setState("off"); return; }
      if (pausedRef.current) { setState("paused"); return; }
      onDone?.();
      if (thenListen) listen(); else setState("idle");
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    // Safari sometimes drops onend; guard with a generous timeout based on length
    const ms = Math.min(60_000, 1500 + text.length * 70);
    window.setTimeout(() => { if (speakingRef.current && !window.speechSynthesis.speaking) done(); }, ms);
  }, [lang, listen, stopListening, stopSpeaking, support.synthesis]);

  const start = useCallback(() => {
    if (!support.recognition) { cbs.current.onError?.(voiceUnsupportedReason(support) ?? "Voice is not available.", true); return; }
    onRef.current = true; pausedRef.current = false; silentRestarts.current = 0;
    setOn(true); setState("idle");
    // iOS needs a user-gesture-born utterance before later ones work; a silent prime does it
    if (support.synthesis) { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ } }
  }, [support]);

  const stop = useCallback(() => {
    onRef.current = false; pausedRef.current = false;
    stopSpeaking(); stopListening();
    setOn(false); setState("off");
  }, [stopListening, stopSpeaking]);

  /** Screen lock / app switch: stop everything cleanly; on return, the caller re-speaks the current item. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (!onRef.current) return;
        pausedRef.current = true;
        stopSpeaking(); stopListening();
        setState("paused");
      } else if (onRef.current && pausedRef.current) {
        pausedRef.current = false;
        setState("idle");
        resumeRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onVis); };
  }, [stopListening, stopSpeaking]);

  useEffect(() => () => { onRef.current = false; stopSpeaking(); stopListening(); }, [stopListening, stopSpeaking]);

  const onResume = useCallback((fn: (() => void) | null) => { resumeRef.current = fn; }, []);

  return { support, on, state, level, start, stop, speak, listen, stopListening, stopSpeaking, onResume };
}
