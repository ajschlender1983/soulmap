/**
 * Keeps each person's results current without anyone tapping Sync:
 *   - once a day, every enabled connector syncs (new Otter/Granola meetings, new Claude Code sessions);
 *   - when the evidence has changed since the last report, the report and soul file are rewritten,
 *     at most once a week (each Claude-written report costs about 30 cents);
 *   - once a week, the Energy Audit is written (lib/energy.ts, under a cent on Haiku).
 * The loop checks hourly; what ran when is kept in data/autosync.json.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { aiConfig } from "./ai";
import { syncConnectors } from "./connectors";
import { hasActiveJob } from "./evidence";
import { generateReport, reportDir } from "./report";
import { auditDue, writeAudit } from "./energy";
import { dataDir, readState } from "./state";

const HOUR = 3600_000;
const SYNC_EVERY = 24 * HOUR;
const REPORT_EVERY = 7 * 24 * HOUR;
const ROOT = path.resolve(process.cwd(), "..");
type Log = Record<string, { synced_at?: string; reported_at?: string }>;

const logFile = () => path.join(dataDir(), "autosync.json");
async function readLog(): Promise<Log> { try { return JSON.parse(await fs.readFile(logFile(), "utf8")) as Log; } catch { return {}; } }
async function mark(id: string, k: "synced_at" | "reported_at") {
  const log = await readLog();
  log[id] = { ...log[id], [k]: new Date().toISOString() };
  await fs.writeFile(logFile(), JSON.stringify(log, null, 2));
}
const age = (iso?: string) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);
const mtime = (p: string) => fs.stat(p).then((s) => s.mtimeMs, () => 0);

async function tick() {
  if (!(await aiConfig()).engine) return; // nothing chosen to score or write with yet
  const ids = await fs.readdir(path.join(dataDir(), "profiles")).catch(() => [] as string[]);
  const log = await readLog();
  for (const id of ids) {
    const s = await readState(id).catch(() => null);
    if (!s?.profile?.consent_at) continue;
    if (await hasActiveJob(id)) continue;
    // The weekly Energy Audit: written once a week; its adjustments wait for the person's yes.
    if (await auditDue(id).catch(() => false)) {
      await writeAudit(id).then(
        () => console.log(`[autosync] ${id}: energy audit written`),
        (e) => console.error(`[autosync] ${id}: energy audit failed:`, e instanceof Error ? e.message : e),
      );
    }
    if (age(log[id]?.synced_at) >= SYNC_EVERY) {
      await mark(id, "synced_at");
      await syncConnectors(id, undefined, (await aiConfig()).engine === "claude" ? 60 : 4).catch((e) => console.error(`[autosync] ${id}: sync failed:`, e instanceof Error ? e.message : e));
      continue; // the sync runs in the background; the report check waits for the next tick
    }
    // New evidence since the last report: rewrite it, so the results and the soul file include it.
    if (s.status !== "reported" || age(log[id]?.reported_at) < REPORT_EVERY) continue;
    const evidence = await mtime(path.join(ROOT, "evidence", "out", id, "summary.json"));
    if (!evidence || evidence <= (await mtime(path.join(reportDir(id), "SOUL-MAP-agent.md")))) continue;
    await mark(id, "reported_at");
    await generateReport(id).then(
      () => console.log(`[autosync] ${id}: report rewritten with new evidence`),
      (e) => console.error(`[autosync] ${id}: report failed:`, e instanceof Error ? e.message : e),
    );
  }
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  const run = () => { tick().catch((e) => console.error("[autosync]", e)); };
  setTimeout(run, 60_000); // let the server settle first
  setInterval(run, HOUR).unref();
}
