import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { profileDir } from "./state";
import { complete } from "./ai";

/**
 * One-click connectors for meeting tools that publish an MCP server with OAuth (Otter, Granola).
 * Connect: the person taps Connect, signs in on the vendor's page, lands back on /evidence; the app
 * registers itself as an OAuth client (dynamic registration) and keeps the tokens on this Mac in
 * data/profiles/<id>/oauth/<cid>.json. Sync: the app calls the vendor's MCP tools, writes each new
 * meeting as "[h:mm:ss] Speaker: text" lines into evidence/cache/<id>/<cid>-inbox/, and the local
 * evidence CLI imports only the person's own lines from there.
 *
 * Otter rarely labels the account owner by name ("Speaker 2"), so each transcript goes through
 * resolveSpeaker: a name match first, then the chosen model (lib/ai.ts) picks
 * the label that is the person, or none. That label is rewritten to the profile name.
 */
export const REMOTE_IDS = ["otter", "granola"] as const;
export type RemoteId = (typeof REMOTE_IDS)[number];
export const isRemoteId = (s: unknown): s is RemoteId => typeof s === "string" && (REMOTE_IDS as readonly string[]).includes(s);

const SERVERS: Record<RemoteId, { url: string; scope?: string; name: string }> = {
  otter: { url: "https://mcp.otter.ai/mcp", scope: "profile:read conversations:read", name: "Otter" },
  granola: { url: "https://mcp.granola.ai/mcp", name: "Granola" },
};

const ROOT = path.resolve(process.cwd(), "..");
/** Granola's lister takes a limit; Otter pages through everything. */
const GRANOLA_LIMIT = 1000;

/**
 * Every meeting pulled so far, one file per meeting holding only the person's own lines (no one else's
 * words are kept). The folder grows with each sync and is imported whole, so the evidence always covers
 * every meeting, not just the newest ones. Meetings already here are not fetched again.
 */
export const remoteInbox = (id: string, cid: RemoteId) => path.join(ROOT, "evidence", "cache", id.toLowerCase(), `${cid}-meetings`);

type Stored = {
  redirect?: string;
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  verifier?: string;
  state?: string;
  account?: string;
  connected_at?: string;
};
const storeFile = (id: string, cid: RemoteId) => path.join(profileDir(id), "oauth", `${cid}.json`);
async function readStore(id: string, cid: RemoteId): Promise<Stored> {
  try { return JSON.parse(await fs.readFile(storeFile(id, cid), "utf8")) as Stored; } catch { return {}; }
}
async function writeStore(id: string, cid: RemoteId, s: Stored) {
  const f = storeFile(id, cid);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, JSON.stringify(s, null, 2), { mode: 0o600 });
}

class NeedsSignIn extends Error { constructor(public url: URL) { super("sign-in needed"); } }

/** File-backed OAuth client. `interactive` turns a needed sign-in into a NeedsSignIn carrying the URL. */
class Provider implements OAuthClientProvider {
  authUrl?: URL;
  constructor(private id: string, private cid: RemoteId, private s: Stored, private redirect: string | undefined, private interactive: boolean) {}
  get redirectUrl() { return this.redirect ?? this.s.redirect; }
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Soul Map",
      redirect_uris: [this.redirectUrl ?? "http://localhost:3355/soul/api/connectors/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      ...(SERVERS[this.cid].scope ? { scope: SERVERS[this.cid].scope } : {}),
    };
  }
  state() { return this.s.state ?? ""; }
  // A client registered for another address (phone vs localhost) is registered again.
  clientInformation() { return this.redirect && this.s.redirect !== this.redirect ? undefined : this.s.client; }
  async saveClientInformation(c: OAuthClientInformationMixed) { this.s.client = c; this.s.redirect = this.redirectUrl; await writeStore(this.id, this.cid, this.s); }
  tokens() { return this.s.tokens; }
  async saveTokens(t: OAuthTokens) { this.s.tokens = t; this.s.connected_at ??= new Date().toISOString(); await writeStore(this.id, this.cid, this.s); }
  redirectToAuthorization(u: URL) { this.authUrl = u; if (!this.interactive) throw new NeedsSignIn(u); }
  async saveCodeVerifier(v: string) { this.s.verifier = v; await writeStore(this.id, this.cid, this.s); }
  codeVerifier() { if (!this.s.verifier) throw new Error("no sign-in in progress"); return this.s.verifier; }
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all" || scope === "client") delete this.s.client;
    if (scope === "all" || scope === "tokens") delete this.s.tokens;
    if (scope === "all" || scope === "verifier") delete this.s.verifier;
    await writeStore(this.id, this.cid, this.s);
  }
}

/** The address the person's browser used (phone through Recall's door, or localhost), so the vendor sends them back there. */
export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  // tailscale serve ends TLS before Recall, which then reports http; the browser was on https.
  const proto = local ? "http" : /\.ts\.net(:|$)/.test(host) ? "https" : h.get("x-forwarded-proto") ?? "https";
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

/** The vendor sign-in URL for this person. `redirect` is this app's callback as the browser sees it. */
export async function startConnect(id: string, cid: RemoteId, redirect: string): Promise<URL> {
  const s = await readStore(id, cid);
  s.state = `${id}.${cid}.${randomBytes(16).toString("hex")}`;
  delete s.tokens;
  await writeStore(id, cid, s);
  const p = new Provider(id, cid, s, redirect, true);
  const r = await auth(p, { serverUrl: SERVERS[cid].url, scope: SERVERS[cid].scope });
  if (r === "AUTHORIZED") throw new Error("already connected");
  if (!p.authUrl) throw new Error("the sign-in page did not come back");
  return p.authUrl;
}

/** Finish the sign-in from the callback's ?state&code. Returns who connected. */
export async function finishConnect(state: string, code: string): Promise<{ id: string; cid: RemoteId }> {
  const [id, cid] = state.split(".");
  if (!id || !isRemoteId(cid)) throw new Error("unknown sign-in");
  const s = await readStore(id, cid);
  if (!s.state || s.state !== state) throw new Error("this sign-in link is stale; tap Connect again");
  const p = new Provider(id, cid, s, undefined, false);
  await auth(p, { serverUrl: SERVERS[cid].url, authorizationCode: code, scope: SERVERS[cid].scope });
  delete s.state; delete s.verifier;
  await writeStore(id, cid, s);
  try { s.account = await accountName(id, cid); await writeStore(id, cid, s); } catch { /* the name is a nicety */ }
  return { id, cid };
}

export async function remoteStatus(id: string, cid: RemoteId): Promise<{ connected: boolean; account?: string; connected_at?: string }> {
  const s = await readStore(id, cid);
  return { connected: !!s.tokens, account: s.account, connected_at: s.connected_at };
}

export async function disconnect(id: string, cid: RemoteId) {
  await fs.rm(storeFile(id, cid), { force: true });
}

async function withClient<T>(id: string, cid: RemoteId, fn: (c: Client) => Promise<T>): Promise<T> {
  const s = await readStore(id, cid);
  if (!s.tokens) throw new Error(`${SERVERS[cid].name} is not connected; tap Connect`);
  const transport = new StreamableHTTPClientTransport(new URL(SERVERS[cid].url), { authProvider: new Provider(id, cid, s, undefined, false) });
  const client = new Client({ name: "soul-map", version: "1.0.0" });
  try {
    await client.connect(transport);
    return await fn(client);
  } catch (e) {
    if (e instanceof NeedsSignIn || /unauthori[sz]ed|invalid_token|401/i.test(String(e))) throw new Error(`${SERVERS[cid].name} sign-in expired; tap Connect again`);
    throw e;
  } finally { await client.close().catch(() => {}); }
}

/** The text of a tool result, parsed as JSON when it is JSON. */
async function call(c: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  const r = await c.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  const parts = (r.content as { type: string; text?: string }[] | undefined) ?? [];
  const text = parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n");
  if (r.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
  return unwrap(text);
}

/** Otter wraps its JSON in another MCP-style {content:[{type:"text",text}]} envelope; peel until it is data. */
function unwrap(text: string): unknown {
  let v: unknown = text;
  for (let i = 0; i < 4 && typeof v === "string"; i++) {
    try { v = JSON.parse(v); } catch { return v; }
    const env = v as { content?: { type?: string; text?: string }[]; result?: { content?: { type?: string; text?: string }[] } };
    const parts = env?.content ?? env?.result?.content;
    if (Array.isArray(parts) && parts.every((p) => p?.type === "text")) v = parts.map((p) => p.text ?? "").join("\n");
  }
  return v;
}

async function accountName(id: string, cid: RemoteId): Promise<string | undefined> {
  if (cid !== "otter") return undefined;
  return withClient(id, cid, async (c) => {
    const u = (await call(c, "otter_get_user_info", {})) as { name?: string; user?: { name?: string } } | string;
    if (typeof u === "string") return u.match(/name["']?\s*[:=]\s*["']?([^"',\n]+)/i)?.[1]?.trim();
    return u.name ?? u.user?.name;
  });
}

// ---- speaker resolution ------------------------------------------------------------------

type Line = { ts: string; speaker: string; text: string };
const LINE = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:\n]{1,60}?)\s*:\s*(.*)$/;

function parseLines(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split("\n")) {
    const m = LINE.exec(raw);
    if (m) out.push({ ts: m[1], speaker: m[2].replace(/\(s\)$/i, "").trim(), text: m[3] });
    else if (out.length && raw.trim()) out[out.length - 1].text += " " + raw.trim();
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();
function nameMatches(label: string, aliases: string[]): boolean {
  const l = norm(label);
  if (!l || /^(speaker|unknown)\b/.test(l)) return false;
  return aliases.some((a) => { const n = norm(a); return !!n && (l === n || l.split(" ")[0] === n.split(" ")[0]); });
}

/** Which label in this meeting is the person. Name match first, then the chosen model; null when unclear. */
async function resolveSpeaker(lines: Line[], aliases: string[], context: string): Promise<string | null> {
  const labels = [...new Set(lines.map((l) => l.speaker))];
  const named = labels.find((l) => nameMatches(l, aliases));
  if (named) return named;
  const anon = labels.filter((l) => /^(speaker|unknown)/i.test(l));
  if (!anon.length) return null;
  // Who is the person? Anyone who says their name to someone ("Hey Sam") is not them, unless introducing themselves ("this is Sam").
  // Among the rest, whoever answers right after their name is said gets a vote.
  const firsts = [...new Set(aliases.map((a) => norm(a).split(" ")[0]).filter((a) => a.length > 2))];
  const says = (t: string) => firsts.some((f) => new RegExp(`\\b${f}\\b`, "i").test(t));
  const selfIntro = (t: string) => firsts.some((f) => new RegExp(`\\b(this is|i'?m|i am|my name is|it'?s)\\s+${f}\\b`, "i").test(t));
  const addressers = new Set(lines.filter((l) => says(l.text) && !selfIntro(l.text)).map((l) => l.speaker));
  const cands = anon.filter((l) => !addressers.has(l));
  if (!cands.length) return null;
  const score = new Map<string, number>(cands.map((l) => [l, 0]));
  for (let i = 0; i < lines.length; i++) {
    if (selfIntro(lines[i].text) && score.has(lines[i].speaker)) score.set(lines[i].speaker, score.get(lines[i].speaker)! + 3);
    if (!says(lines[i].text) || selfIntro(lines[i].text)) continue;
    const next = lines.slice(i + 1).find((l) => l.speaker !== lines[i].speaker);
    if (next && score.has(next.speaker)) score.set(next.speaker, score.get(next.speaker)! + 2);
  }
  const ranked = [...score].sort((x, y) => y[1] - x[1]);
  if (ranked[0][1] >= 2 && ranked[0][1] - (ranked[1]?.[1] ?? 0) >= 2) return ranked[0][0];
  // A recording with one voice on the person's own account is them.
  if (labels.length === 1) return labels[0];
  const sample = lines.slice(0, 90).map((l) => `[${l.speaker}] ${l.text.slice(0, 180)}`).join("\n");
  const prompt = `A meeting transcript from ${aliases[0]}'s own recording account. Speaker labels: ${labels.join(", ")}.
${context}
Which ONE of these labels is ${aliases.join(" / ")} speaking: ${cands.join(", ")}?
Clues: someone greets them by name and that label answers; they introduce themselves; the summary names them with a label; in a recording with a single voice, that voice is the account owner.
If no label is clearly them, answer NONE. Reply with the label only.

${sample}`;
  try {
    const ans = await complete({ user: prompt, maxTokens: 40, timeoutMs: 180_000 });
    // Longest label first so "Speaker 1" never matches inside "Speaker 12".
    return [...cands].sort((a, b) => b.length - a.length).find((l) => ans.toLowerCase().includes(l.toLowerCase())) ?? null;
  } catch { return null; }
}

/** Only the person's own lines are written: the archive keeps no one else's words. */
function writeTranscript(lines: Line[], who: string, as: string): string {
  return lines.filter((l) => l.speaker === who).map((l) => `[${l.ts}] ${as}: ${l.text}`).join("\n") + "\n";
}

// ---- pulls -------------------------------------------------------------------------------

export type PullResult = { meetings: number; kept: number; files: number; notes: string[]; picks?: string[]; total?: number };
const ymd = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

/**
 * Fetch every meeting not yet in the archive (the first sync takes the whole account; later ones look back
 * two days before the last sync), the person's label rewritten to `as`.
 */
export async function pullMeetings(id: string, cid: RemoteId, since: string | undefined, as: string, aliases: string[]): Promise<PullResult> {
  const inbox = remoteInbox(id, cid);
  await fs.mkdir(inbox, { recursive: true });
  // The old per-sync inbox held whole transcripts; it is no longer used.
  await fs.rm(path.join(path.dirname(inbox), `${cid}-inbox`), { recursive: true, force: true }).catch(() => {});
  const have = new Set(await fs.readdir(inbox).catch(() => [] as string[]));
  // An empty archive (first sync, or one made before the archive existed) takes the whole account.
  const from = since && have.size ? new Date(new Date(since).getTime() - 2 * 864e5) : null;
  const s = await readStore(id, cid);
  const names = [...new Set([as, ...aliases, ...(s.account ? [s.account] : [])])];
  const res = await (cid === "otter" ? pullOtter(id, inbox, from, as, names, have) : pullGranola(id, inbox, from, as, names, have));
  res.total = (await fs.readdir(inbox).catch(() => [] as string[])).filter((f) => f.endsWith(".txt")).length;
  return res;
}

const fileFor = (mid: string, date = "") => `${date ? `${date}-` : ""}${mid.replace(/[^\w-]/g, "_")}.txt`;
const seen = (have: Set<string>, mid: string) => { const tail = fileFor(mid); return [...have].some((f) => f === tail || f.endsWith(`-${tail}`)); };

async function pullOtter(id: string, inbox: string, from: Date | null, as: string, names: string[], have: Set<string>): Promise<PullResult> {
  return withClient(id, "otter", async (c) => {
    type Hit = { id: string; title?: string; start_time?: string; duration?: string; short_summary?: string };
    const hits: Hit[] = [];
    let cursor: string | undefined;
    do {
      const r = (await call(c, "otter_search", { ...(from ? { created_after: ymd(from) } : {}), page_size: 25, include_shared_meetings: true, ...(cursor ? { cursor } : {}) })) as { results?: Hit[]; next_cursor?: string };
      hits.push(...(r.results ?? []));
      cursor = r.next_cursor;
    } while (cursor);
    const res: PullResult = { meetings: hits.length, kept: 0, files: 0, notes: [] };
    for (const h of hits) {
      if (!h.duration || /^0s$/.test(h.duration) || seen(have, h.id)) continue;
      const m = (await call(c, "otter_fetch", { id: h.id }).catch(() => null)) as { text?: string; title?: string } | null;
      if (!m) { res.notes.push(`${h.title ?? h.id}: Otter did not return the transcript`); continue; }
      const lines = parseLines(m.text ?? "");
      if (!lines.length) continue;
      const who = await resolveSpeaker(lines, names, `Title: ${h.title ?? ""}\nSummary: ${(h.short_summary ?? "").slice(0, 600)}`);
      if (!who) { res.notes.push(`${h.title ?? h.id}: could not tell which speaker is ${as}`); continue; }
      const date = (h.start_time ?? "").slice(0, 10).replace(/\//g, "-") || "undated";
      await fs.writeFile(path.join(inbox, fileFor(h.id, date)), writeTranscript(lines, who, as));
      (res.picks ??= []).push(`${date} ${h.title ?? h.id}: ${who}`);
      res.files++;
      res.kept += lines.filter((l) => l.speaker === who).length;
    }
    return res;
  });
}

/**
 * Granola's MCP tool names are discovered at run time: a meeting lister and a transcript getter.
 * Shapes vary by version, so ids and transcript text are read loosely.
 */
async function pullGranola(id: string, inbox: string, from: Date | null, as: string, names: string[], have: Set<string>): Promise<PullResult> {
  return withClient(id, "granola", async (c) => {
    const tools = (await c.listTools()).tools.map((t) => t.name);
    const lister = tools.find((t) => /list_meetings|list_documents|search_meetings/i.test(t));
    const getter = tools.find((t) => /transcript/i.test(t));
    if (!lister || !getter) throw new Error(`Granola tools not recognised (${tools.join(", ")})`);
    const listed = await call(c, lister, { ...(from ? { since: from.toISOString(), start_date: from.toISOString().slice(0, 10) } : {}), limit: GRANOLA_LIMIT });
    const ids = new Map<string, string>();
    const walk = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        const mid = r.id ?? r.meeting_id ?? r.document_id;
        if (typeof mid === "string" && (r.title !== undefined || r.created_at !== undefined || r.date !== undefined)) ids.set(mid, String(r.title ?? ""));
        else Object.values(r).forEach(walk);
      }
    };
    walk(listed);
    if (typeof listed === "string") for (const m of listed.matchAll(/\b(?:id|meeting_id)["']?\s*[:=]\s*["']?([\w-]{8,})/g)) ids.set(m[1], "");
    const res: PullResult = { meetings: ids.size, kept: 0, files: 0, notes: [] };
    for (const [mid, title] of ids) {
      if (seen(have, mid)) continue;
      const t = await call(c, getter, { meeting_id: mid, id: mid }).catch(() => null);
      if (t === null) continue;
      const lines: Line[] = [];
      const collect = (o: unknown) => {
        if (Array.isArray(o)) o.forEach(collect);
        else if (o && typeof o === "object") {
          const r = o as Record<string, unknown>;
          const spk = r.speaker ?? r.source ?? r.speaker_name;
          const txt = r.text ?? r.content;
          if (typeof spk === "string" && typeof txt === "string") lines.push({ ts: "0:00:00", speaker: spk === "microphone" ? as : spk === "system" ? "Others" : spk, text: txt });
          else Object.values(r).forEach(collect);
        }
      };
      if (typeof t === "string") lines.push(...parseLines(t), ...t.split("\n").flatMap((l) => { const m = /^\s*\**([A-Z][\w .'-]{0,40}?)\**\s*:\s*(.+)$/.exec(l); return m && !LINE.test(l) ? [{ ts: "0:00:00", speaker: m[1], text: m[2] }] : []; }));
      else collect(t);
      if (!lines.length) continue;
      const who = lines.some((l) => l.speaker === as) ? as : await resolveSpeaker(lines, names, `Title: ${title}`);
      if (!who) { res.notes.push(`${title || mid}: could not tell which speaker is ${as}`); continue; }
      await fs.writeFile(path.join(inbox, fileFor(mid)), writeTranscript(lines, who, as));
      res.files++;
      res.kept += lines.filter((l) => l.speaker === who).length;
    }
    return res;
  });
}
