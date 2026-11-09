import { readToolArgs, toolReply } from "@/lib/tool";
import { updateState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { args, profileId } = await readToolArgs<{ note: string }>(req);
  if (!args.note) return toolReply({ ok: false });
  await updateState((s) => { s.notes.push(args.note); }, profileId);
  return toolReply({ ok: true });
}
