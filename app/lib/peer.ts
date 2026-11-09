import { randomBytes } from "node:crypto";
import { readState, type PeerResponse, type SoulState } from "./state";

/**
 * Peer input (PEER-INPUT.md): ten 1–5 items and two open questions a teammate answers
 * through a shareable link. Answers land on the owner's state anonymously.
 */
/** Third person, with `{name}` for the owner's first name: "Sam changes direction…". `withName()` fills it in. */
export const PEER_ITEMS: { n: number; text: string }[] = [
  { n: 1, text: "When {name} hands me something, I have enough context to act without asking a follow-up." },
  { n: 2, text: "{name} changes direction after a decision has been made." },
  { n: 3, text: "{name} gets to the point quickly." },
  { n: 4, text: "When I disagree with {name}, I feel safe saying so." },
  { n: 5, text: "{name} notices when I'm stretched or off, without me saying it." },
  { n: 6, text: "{name} follows through on the small things {name} promised." },
  { n: 7, text: "{name} makes things more complicated than they need to be." },
  { n: 8, text: "{name}'s energy lifts the room." },
  { n: 9, text: "{name} wants detail and evidence before deciding." },
  { n: 10, text: "{name} says the hard thing directly rather than softening it." },
];
/** Open questions, also with `{name}`. */
export const PEER_OPEN = {
  a: "What's the one thing that makes working with {name} easier than with most people?",
  b: "What's the one thing that makes working with {name} harder?",
};
export function withName(text: string, name: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0] || "they";
  return text.replace(/\{name\}/g, first);
}
/** The items and open questions with the owner's first name filled in. */
export function peerItemsFor(name: string): { items: { n: number; text: string }[]; open: { a: string; b: string } } {
  return { items: PEER_ITEMS.map((i) => ({ n: i.n, text: withName(i.text, name) })), open: { a: withName(PEER_OPEN.a, name), b: withName(PEER_OPEN.b, name) } };
}
/** Items where a high score is the less helpful direction; averaged as 6 - x. */
export const REVERSE_KEYED = new Set([2, 7]);
export const OPEN_MAX = 300;

const TOKEN_RE = /^[a-f0-9]{24}$/;
export function newToken(): string { return randomBytes(12).toString("hex"); }
export function isToken(t: string | undefined | null): t is string { return !!t && TOKEN_RE.test(t); }

/** Which profile owns a token, or null. Walks every profile; the team is small. */
export async function ownerOfToken(token: string, profiles: string[]): Promise<{ id: string; state: SoulState } | null> {
  if (!isToken(token)) return null;
  for (const id of profiles) {
    const s = await readState(id);
    if ((s.peer_links ?? []).some((l) => l.token === token)) return { id, state: s };
  }
  return null;
}

/** Validate a submitted body into a stored response; null when any item is missing or out of range. */
export function parseResponse(body: unknown): PeerResponse | null {
  const b = (body ?? {}) as { answers?: Record<string, unknown>; a?: unknown; b?: unknown };
  const answers: Record<string, number> = {};
  for (const { n } of PEER_ITEMS) {
    const v = Number(b.answers?.[String(n)]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return null;
    answers[String(n)] = v;
  }
  const clean = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, OPEN_MAX) : "");
  return { at: new Date().toISOString(), answers, a: clean(b.a), b: clean(b.b) };
}

export type PeerSummary = { n: number; averages: Record<string, number | null>; open_a: string[]; open_b: string[] };

/** Per-item averages (items 2 and 7 reverse-keyed), rater count, and the open answers. */
export function summarize(responses: PeerResponse[] | undefined): PeerSummary {
  const rs = responses ?? [];
  const averages: Record<string, number | null> = {};
  for (const { n } of PEER_ITEMS) {
    const vals = rs.map((r) => r.answers[String(n)]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5).map((v) => (REVERSE_KEYED.has(n) ? 6 - v : v));
    averages[String(n)] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  }
  return {
    n: rs.length,
    averages,
    open_a: rs.map((r) => r.a.slice(0, OPEN_MAX)).filter(Boolean),
    open_b: rs.map((r) => r.b.slice(0, OPEN_MAX)).filter(Boolean),
  };
}
