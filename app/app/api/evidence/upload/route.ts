import { NextResponse } from "next/server";
import { isSource, startJob } from "@/lib/evidence";
import { profileIdFrom } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024;

/** multipart: file, source (claude-ai | chatgpt | claude-code | granola | otter), speaker? */
export async function POST(req: Request) {
  const id = profileIdFrom(req);
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "expected a multipart form with a file" }, { status: 400 }); }
  const source = form.get("source");
  const file = form.get("file");
  if (!isSource(source)) return NextResponse.json({ error: "unknown source" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file is over 500 MB" }, { status: 413 });
  const speaker = typeof form.get("speaker") === "string" ? String(form.get("speaker")).trim() || undefined : undefined;
  try {
    const job = await startJob(id, source, file.name, new Uint8Array(await file.arrayBuffer()), speaker);
    return NextResponse.json({ ok: true, job });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 500 }); }
}
