import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readState, updateState } from "@/lib/state";
import { DEFAULT_PROFILE, profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Soul API's correction entry (SPEC, correction loop). Any agent, the app's "Tell my Soul Map"
 * box, or a hook can POST here. A correction is stored on the person's profile AND, when the person
 * has a Recall library on this Mac, appended to `library/soul/corrections.jsonl` and surfaced at the
 * bottom of `library/soul/rules.md`, which every agent session loads. Corrections apply immediately.
 *
 * Body: { text, source?, rule? }   GET lists them   DELETE { at } undoes one.
 */
const TAG = "[correction ";
type Correction = { at: string; text: string; source?: string; rule?: string };

function parse(note: string): Correction | null {
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

export async function GET(req: Request) {
  const s = await readState(profileIdFrom(req));
  const corrections = s.notes.map(parse).filter((c): c is Correction => !!c).reverse();
  return NextResponse.json({ corrections, updated_at: corrections[0]?.at ?? null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; source?: string; rule?: string };
  const text = (body.text ?? "").trim().slice(0, 1000);
  if (!text) return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  const profileId = profileIdFrom(req);
  const c: Correction = { at: new Date().toISOString(), text, source: body.source ?? "app", rule: body.rule?.slice(0, 200) };
  await updateState((s) => { s.notes.push(`${TAG}${c.at}] ${JSON.stringify({ text: c.text, source: c.source, rule: c.rule })}`); }, profileId);
  const mirrored = await mirrorToLibrary(profileId, c).catch(() => false);
  return NextResponse.json({ ok: true, correction: c, mirrored_to_library: mirrored });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { at?: string };
  if (!body.at) return NextResponse.json({ ok: false, error: "at required" }, { status: 400 });
  await updateState((s) => { s.notes = s.notes.filter((n) => parse(n)?.at !== body.at); }, profileIdFrom(req));
  return NextResponse.json({ ok: true });
}
