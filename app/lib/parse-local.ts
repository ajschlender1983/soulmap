/**
 * Second-chance parsing with the chosen model (lib/ai.ts: Claude Haiku or the local model). Used only when
 * the keyword parsers in lib/questions/scoring.ts return null, i.e. for story answers.
 *
 *   SOUL_LOCAL_MODEL   "off" disables the fallback (the deterministic test run)
 */
import type { PlanItem } from "./engine";
import { coerceValue, clarificationPrompt } from "./engine";
import { complete } from "./ai";

export const LOCAL_CONFIDENCE_MIN = 0.6;
const TIMEOUT_MS = 20_000;

export type LocalParse = { value: number | string; confidence: number; reason?: string };

export function localModel(): string | null {
  const m = (process.env.SOUL_LOCAL_MODEL ?? "qwen3:8b").trim();
  return !m || /^(off|none|0|false)$/i.test(m) ? null : m;
}

function scaleDescription(item: PlanItem): string {
  switch (item.answer) {
    case "1-5": return "an integer 1-5 where 1 = not at all, 2 = a little, 3 = somewhat, 4 = mostly, 5 = completely true of them";
    case "1-6": return "an integer 1-6 where 1 = not like me at all, 2 = not like me, 3 = a little like me, 4 = somewhat like me, 5 = like me, 6 = very much like me";
    case "energy": return "an integer 1-5 where 1 = drains me, 3 = neutral, 5 = really energizes me";
    case "clock": return "a 24-hour clock time as a string \"HH:MM\" (e.g. \"06:30\", \"23:00\"); for a bedtime a bare 1-6 means after midnight";
    case "A/B/C": return "one of the letters \"a\", \"b\" or \"c\" naming the closest option";
  }
}

/**
 * Ask the model to map the person's words onto the item's scale. Resolves to null when the model is off,
 * unreachable, slow (20 s), or not confident enough; the caller then asks to clarify.
 */
export async function parseLocal(item: PlanItem, text: string, options?: { key: string; text: string }[] | null): Promise<LocalParse | null> {
  const model = localModel();
  const words = (text ?? "").trim();
  if (!model || !words) return null;
  const system = [
    "You turn a person's spoken answer to a personality-interview item into a value on the item's scale.",
    "Reply with JSON only: {\"value\": <value or null>, \"confidence\": <0 to 1>, \"reason\": \"<ten words>\"}.",
    "Judge the stance the words express toward the statement, not the topic. If the words do not express a stance (a question, 'skip', unrelated talk), use value null and confidence 0.",
    "Do not guess the middle of the scale when unsure; lower the confidence instead.",
  ].join(" ");
  const user = [
    `Item: "${item.say}"`,
    options?.length ? `Options: ${options.map((o) => `${o.key.toUpperCase()}: ${o.text}`).join(" | ")}` : null,
    `Scale: ${scaleDescription(item)}`,
    `Person's words: "${words}"`,
  ].filter(Boolean).join("\n");
  try {
    const raw = await complete({ system, user, maxTokens: 120, json: true, timeoutMs: TIMEOUT_MS });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const out = JSON.parse(json) as { value?: unknown; confidence?: unknown; reason?: unknown };
    const value = coerceValue(item, out.value);
    const confidence = typeof out.confidence === "number" ? Math.max(0, Math.min(1, out.confidence)) : 0;
    if (value === null || confidence < LOCAL_CONFIDENCE_MIN) return null;
    return { value, confidence, reason: typeof out.reason === "string" ? out.reason : undefined };
  } catch {
    return null; // timeout, model down, bad JSON: all mean "ask the person"
  }
}

/** The line to say when neither parser got a value. */
export function fallbackPrompt(item: PlanItem): string { return clarificationPrompt(item); }
