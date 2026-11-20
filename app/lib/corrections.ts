/**
 * Filing a correction: stored on the person's profile and, when they have a Recall library on this Mac,
 * appended to `library/soul/corrections.jsonl` and the Corrections list in `library/soul/rules.md`, which
 * every agent session loads. Used by the Soul API (/api/soul/correct) and by approved Energy Audit adjustments.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { updateState } from "./state";
import { DEFAULT_PROFILE } from "./profile";

export const TAG = "[correction ";
export type Correction = { at: string; text: string; source?: string; rule?: string };

export function parseCorrection(note: string): Correction | null {
  if (!note.startsWith(TAG)) return null;
  const end = note.indexOf("] ");
  if (end < 0) return null;
  const rest = note.slice(end + 2);
  try { const j = JSON.parse(rest) as Omit<Correction, "at">; return { ...j, at: note.slice(TAG.length, end) }; } catch { return { at: note.slice(TAG.length, end), text: rest }; }
}

/** Where this person's Recall library lives, if Recall is installed on this Mac. */
async function libraryDir(profileId: string): Promise<string | null> {
  const root = process.env.RECALL_DIR ?? path.resolve(process.cwd(), "..", "..", "context-library");
  const candidates = profileId === DEFAULT_PROFILE ? [path.join(root, "library")] : [path.join(root, "libraries", profileId)];
  for (const c of candidates) { try { await fs.access(c); return c; } catch { /* next */ } }
  return null;
}

async function mirrorToLibrary(profileId: string, c: Correction) {
  const dir = await libraryDir(profileId);
  if (!dir) return false;
  const soul = path.join(dir, "soul");
  await fs.mkdir(soul, { recursive: true });
  await fs.appendFile(path.join(soul, "corrections.jsonl"), JSON.stringify({ at: c.at, source: c.source ?? "app", verbatim: c.text, rule: c.rule ?? "" }) + "\n");
  const rulesPath = path.join(soul, "rules.md");
  try {
    const txt = await fs.readFile(rulesPath, "utf8");
    const marker = "## Corrections";
    const i = txt.indexOf(marker);
    const line = `- ${c.at.slice(0, 10)}: "${c.text.slice(0, 160)}"${c.rule ? ` → ${c.rule}` : ""}\n`;
    if (i >= 0) { const j = txt.indexOf("\n", i) + 1; await fs.writeFile(rulesPath, txt.slice(0, j) + line + txt.slice(j)); }
    else await fs.appendFile(rulesPath, `\n## Corrections (newest first; apply immediately)\n${line}`);
  } catch { /* no rules file yet: the corrections log alone is enough until the first soul file is written */ }
  return true;
}

export async function fileCorrection(profileId: string, input: { text: string; source?: string; rule?: string }) {
  const c: Correction = { at: new Date().toISOString(), text: input.text.trim().slice(0, 1000), source: input.source ?? "app", rule: input.rule?.slice(0, 200) };
  await updateState((s) => { s.notes.push(`${TAG}${c.at}] ${JSON.stringify({ text: c.text, source: c.source, rule: c.rule })}`); }, profileId);
  const mirrored = await mirrorToLibrary(profileId, c).catch(() => false);
  return { correction: c, mirrored };
}
