import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { aiConfig, checkKey, localStatus, saveAiSettings } from "@/lib/ai";
import { dataDir } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOSTED = process.env.NEXT_PUBLIC_HOSTED === "1";
const ROOT = path.resolve(process.cwd(), "..");
const LOG = () => path.join(dataDir(), "local-model.log");

/** The last line scripts/local-model.sh wrote: "STEP ...", "DONE <model>" or "FAIL ...", plus pull progress. */
async function install(): Promise<{ state: "idle" | "running" | "done" | "failed"; step?: string; percent?: number }> {
  const log = await fs.readFile(LOG(), "utf8").catch(() => "");
  if (!log) return { state: "idle" };
  const lines = log.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const marks = lines.filter((l) => /^(STEP|DONE|FAIL) /.test(l));
  const last = marks.at(-1) ?? "";
  if (last.startsWith("DONE")) return { state: "done" };
  if (last.startsWith("FAIL")) return { state: "failed", step: last.slice(5) };
  const pct = [...log.matchAll(/(\d{1,3})%/g)].at(-1)?.[1];
  const stale = Date.now() - (await fs.stat(LOG())).mtimeMs > 10 * 60_000;
  return stale ? { state: "failed", step: "The download stopped. Try again." } : { state: "running", step: last.slice(5), percent: pct ? Number(pct) : undefined };
}

/** GET: which engine is chosen, whether a key is set (never the key), and the local model's state. */
export async function GET() {
  const cfg = await aiConfig();
  const local = HOSTED ? { running: false, installed: false } : await localStatus(cfg.localModel);
  return NextResponse.json({ hosted: HOSTED, engine: cfg.engine, chosen: cfg.chosen, has_key: !!cfg.key, local_model: cfg.localModel, local, install: HOSTED ? { state: "idle" } : await install() }, { headers: { "cache-control": "no-store" } });
}

/** POST {engine: "claude", key?} checks and saves the key; POST {engine: "local"} starts the local model install. */
export async function POST(req: Request) {
  if (HOSTED) return NextResponse.json({ error: "The hosted version always uses Claude." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { engine?: unknown; key?: unknown };
  if (b.engine === "claude") {
    const key = typeof b.key === "string" ? b.key.trim() : "";
    if (key) {
      const bad = await checkKey(key);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      await saveAiSettings({ engine: "claude", anthropic_key: key });
    } else {
      if (!(await aiConfig()).key) return NextResponse.json({ error: "Paste your Anthropic API key." }, { status: 400 });
      await saveAiSettings({ engine: "claude" });
    }
    return NextResponse.json({ ok: true, engine: "claude" });
  }
  if (b.engine === "local") {
    await saveAiSettings({ engine: "local" });
    const cfg = await aiConfig();
    if ((await localStatus(cfg.localModel)).installed) return NextResponse.json({ ok: true, engine: "local", installed: true });
    const cur = await install();
    if (cur.state !== "running") {
      await fs.mkdir(dataDir(), { recursive: true });
      const out = await fs.open(LOG(), "w");
      const child = spawn("/bin/bash", [path.join(ROOT, "scripts", "local-model.sh")], { detached: true, stdio: ["ignore", out.fd, out.fd] });
      child.unref();
      await out.close();
      // The script picks the model from memory size; remember what it settles on.
      child.on("exit", async () => {
        const m = /DONE (\S+)/.exec(await fs.readFile(LOG(), "utf8").catch(() => ""))?.[1];
        if (m) await saveAiSettings({ local_model: m });
      });
    }
    return NextResponse.json({ ok: true, engine: "local", installed: false });
  }
  return NextResponse.json({ error: "engine must be claude or local" }, { status: 400 });
}
