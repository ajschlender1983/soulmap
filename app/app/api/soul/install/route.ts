import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_PROFILE, profileIdFrom } from "@/lib/profile";
import { readReports } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click "Add to Claude Code" for the person who owns this Mac. Writes their soul file to
 * ~/.claude/soul.md and adds one import line to ~/.claude/CLAUDE.md, so every Claude Code session
 * on this Mac loads it. Only the owner's profile may do this: a teammate reaching the app over the
 * network must not write into the owner's Claude settings.
 */
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SOUL = path.join(CLAUDE_DIR, "soul.md");
const MEMORY = path.join(CLAUDE_DIR, "CLAUDE.md");
const IMPORT = "@~/.claude/soul.md";
const RECALL = path.resolve(process.cwd(), "..", "..", "context-library", "library");

async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }

export async function GET(req: Request) {
  const owner = profileIdFrom(req) === DEFAULT_PROFILE;
  const memory = await fs.readFile(MEMORY, "utf8").catch(() => "");
  return NextResponse.json({ owner, recall: await exists(RECALL), claude_code: owner && memory.split("\n").some((l) => l.trim() === IMPORT) });
}

export async function POST(req: Request) {
  const id = profileIdFrom(req);
  if (id !== DEFAULT_PROFILE) return NextResponse.json({ error: "only the person who owns this Mac can add it to Claude Code here; use Download instead" }, { status: 403 });
  const { agent } = await readReports(id);
  if (!agent.trim()) return NextResponse.json({ error: "no soul file yet; build the report first" }, { status: 409 });
  await fs.mkdir(CLAUDE_DIR, { recursive: true });
  await fs.writeFile(SOUL, agent.trim() + "\n");
  const memory = await fs.readFile(MEMORY, "utf8").catch(() => "");
  if (!memory.split("\n").some((l) => l.trim() === IMPORT)) {
    await fs.writeFile(MEMORY, (memory ? memory.replace(/\n*$/, "\n\n") : "") + "# Soul Map: how to work with me\n" + IMPORT + "\n");
  }
  return NextResponse.json({ ok: true, path: SOUL });
}
