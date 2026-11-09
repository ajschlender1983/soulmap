/**
 * The interview as the app uses it: engine functions + persistence + the one conversation thread.
 * Routes under /api/interview call these; tests call them directly with a scratch SOUL_DATA_DIR.
 */
import { readState, updateState, transcriptText, type SoulState, type Turn } from "./state";
import { nextItem, sectionIntro, markIntroShown, progress, isComplete, applyAnswer, skipItem, goBack, itemById, isClockText, type AskedItem, type Progress, type Parsed } from "./engine";
import { parseLocal } from "./parse-local";
import { DEFAULT_PROFILE } from "./profile";

export type NextPayload = { item: AskedItem | null; intro?: string; progress: Progress; done: boolean; status: SoulState["status"]; compact: boolean };
export type Command = "skip" | "back" | "faster" | "slower" | "pause";
export type AnswerPayload = {
  ok: boolean;
  parsed?: Parsed & { via: "parser" | "local_model" | "value"; confidence?: number };
  needs_clarification?: boolean;
  prompt?: string;
  error?: string;
  command?: Command; // the text was a command, not an answer
  paused?: boolean; // "stop" / "pause" / "done for now": the UI goes home
  next: NextPayload;
};

/**
 * Typed or spoken commands, checked before any parsing. Trimmed, lowercased, punctuation stripped.
 * "skip"/"next"/"pass" skip; "back"/"go back"/"previous" reopen; "faster"/"shorter"/"quicker"/"speed up" turn
 * scale cues off; "slower" turns them back on; "stop"/"pause"/"done for now" pause.
 */
export function commandOf(text: string | undefined | null): Command | null {
  const t = (text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (["skip", "next", "pass", "skip it"].includes(t)) return "skip";
  if (["back", "go back", "previous"].includes(t)) return "back";
  if (["faster", "shorter", "quicker", "speed up"].includes(t)) return "faster";
  if (["slower"].includes(t)) return "slower";
  if (["stop", "pause", "done for now"].includes(t)) return "pause";
  return null;
}

function pushTurn(s: SoulState, role: Turn["role"], content: string) {
  const text = content.trim();
  if (!text) return;
  s.turns.push({ role, content: text, mode: "chat", session_id: s.interview.session_id, at: new Date().toISOString() });
  s.transcript = transcriptText(s.turns, s.profile.name);
}

/** Say the intro (once per section) and the item (once per prompt), and mark status. Mutates `s`. */
function advance(s: SoulState): NextPayload {
  const intro = sectionIntro(s);
  if (intro) { Object.assign(s, markIntroShown(s, intro.keys)); pushTurn(s, "agent", intro.text); }
  const item = nextItem(s);
  if (item) {
    if (s.status === "idle" || s.status === "ended") s.status = "in_chat";
    s.started_at = s.started_at ?? new Date().toISOString();
    const last = s.interview.last_prompt;
    if (!(last && last.item_id === item.id && last.kind === "item")) {
      const sayScale = item.scale && item.index === 1 && !s.interview.compact ? ` ${item.scale}` : "";
      pushTurn(s, "agent", `${item.say}${sayScale}`);
      s.interview.last_prompt = { item_id: item.id, kind: "item" };
    }
  } else if (isComplete(s)) {
    if (s.status !== "reported") s.status = "complete";
    s.ended_at = s.ended_at ?? new Date().toISOString();
    s.interview.last_prompt = null;
  }
  return { item, intro: intro?.text, progress: progress(s), done: item === null && isComplete(s), status: s.status, compact: !!s.interview.compact };
}

export async function interviewNext(profileId = DEFAULT_PROFILE): Promise<NextPayload> {
  let out!: NextPayload;
  await updateState((s) => { out = advance(s); }, profileId);
  return out;
}

export async function interviewPeek(profileId = DEFAULT_PROFILE): Promise<NextPayload> {
  const s = await readState(profileId);
  return { item: nextItem(s), progress: progress(s), done: isComplete(s), status: s.status, compact: !!s.interview.compact };
}

/** Run a command the person typed or said instead of an answer. Recorded as a turn like the UI's "(skip)". */
export async function interviewCommand(profileId: string, command: Command, itemId?: string): Promise<AnswerPayload> {
  if (command === "skip") return { ok: true, command, next: await interviewSkip(profileId, itemId) };
  if (command === "back") { const r = await interviewBack(profileId); return { ok: true, command, next: r }; }
  let out!: AnswerPayload;
  await updateState((s) => {
    pushTurn(s, "user", `(${command})`);
    if (command === "faster" || command === "slower") {
      s.interview.compact = command === "faster";
      const next = advance(s);
      const line = command === "faster" ? "Got it, shorter from here." : "Got it, back to the full cues.";
      pushTurn(s, "agent", line);
      out = { ok: true, command, next: { ...next, intro: next.intro ? `${line}\n\n${next.intro}` : line } };
      return;
    }
    // pause: nothing changes in the plan; the UI shows the home screen and resumes from here later
    const next = advance(s);
    out = { ok: true, command, paused: true, next: { ...next, intro: undefined } };
  }, profileId);
  return out;
}

/**
 * Record the person's words for an item. Built-in parsers first; on a miss the local model; on a second miss
 * the agent asks for a number. `value` short-circuits parsing (a tapped pill).
 */
export async function interviewAnswer(profileId: string, itemId: string, text: string, value?: number | string | null): Promise<AnswerPayload> {
  const item = itemById(itemId);
  if (!item) { const next = await interviewNext(profileId); return { ok: false, error: `unknown item ${itemId}`, next }; }
  const words = (text ?? "").trim();
  // 0. a command typed or said in place of an answer
  if (value === undefined || value === null) { const cmd = commandOf(words); if (cmd) return interviewCommand(profileId, cmd, itemId); }
  // 1. built-in parsers (pure, synchronous)
  const first = await readState(profileId);
  // A tapped value or a short reply ("4", "mostly", "yeah pretty much") goes to the keyword parsers.
  // A longer sentence is a story answer: the keyword table would latch onto a stray "usually" or "always",
  // so those go to the local model first and only fall back to the parsers if the model is unavailable.
  const isStory = (value === undefined || value === null) && words.split(/\s+/).filter(Boolean).length > 6;
  let attempt = isStory ? ({ ok: false, needs_clarification: true, prompt: "", item: undefined as never, state: first } as ReturnType<typeof applyAnswer>) : applyAnswer(first, itemId, words, value);
  let via: "parser" | "local_model" | "value" = value !== undefined && value !== null ? "value" : "parser";
  let confidence: number | undefined;
  // 2. local model for story answers. A clock item never goes to the model on a bare number ("3"): the model
  //    would happily return 3 and it would be stored as 03:00; the person is asked for a real time instead.
  const clockBare = item.answer === "clock" && !isClockText(words);
  if (!attempt.ok && attempt.needs_clarification && words && !clockBare) {
    const local = await parseLocal(item, words, nextItem(first)?.id === itemId ? nextItem(first)?.options : null);
    if (local) { attempt = applyAnswer(first, itemId, words, local.value); via = "local_model"; confidence = local.confidence; }
    else if (isStory) attempt = applyAnswer(first, itemId, words, value); // model unavailable: keyword parsers as a last resort
  }
  // 3. persist, re-applying on the freshest state so a concurrent write is not lost
  let out!: AnswerPayload;
  await updateState((s) => {
    if (words) pushTurn(s, "user", words); else if (value !== undefined && value !== null) pushTurn(s, "user", String(value));
    if (!attempt.ok && !attempt.needs_clarification) { out = { ok: false, error: attempt.error, next: advance(s) }; return; }
    const fresh = attempt.ok ? applyAnswer(s, itemId, words, attempt.parsed.value) : applyAnswer(s, itemId, words);
    Object.assign(s, fresh.state);
    if (!fresh.ok) {
      const prompt = fresh.needs_clarification ? fresh.prompt : "Let's try that one again.";
      pushTurn(s, "agent", prompt);
      s.interview.last_prompt = { item_id: itemId, kind: "clarify" };
      out = { ok: false, needs_clarification: true, prompt, next: { item: nextItem(s), progress: progress(s), done: false, status: s.status, compact: !!s.interview.compact } };
      return;
    }
    out = { ok: true, parsed: { ...fresh.parsed, via, confidence }, next: advance(s) };
  }, profileId);
  return out;
}

export async function interviewSkip(profileId: string, itemId?: string): Promise<NextPayload> {
  let out!: NextPayload;
  await updateState((s) => {
    const id = itemId ?? nextItem(s)?.id;
    if (id) {
      Object.assign(s, skipItem(s, id));
      pushTurn(s, "user", "(skip)");
    }
    out = advance(s);
  }, profileId);
  return out;
}

export async function interviewBack(profileId: string): Promise<NextPayload & { reopened: boolean }> {
  let out!: NextPayload & { reopened: boolean };
  await updateState((s) => {
    const back = goBack(s);
    if (back) {
      Object.assign(s, back.state);
      s.interview.last_prompt = null; // re-say the reopened item
      pushTurn(s, "user", "(back)");
    }
    out = { ...advance(s), reopened: !!back };
  }, profileId);
  return out;
}
