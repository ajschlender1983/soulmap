import { readToolArgs, toolReply } from "@/lib/tool";
import { updateState, type Answer } from "@/lib/state";
import { normalizeSection } from "@/lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Args = { item_id: string; section: string; value: number | string; raw: string };

export async function POST(req: Request) {
  const { args, profileId } = await readToolArgs<Args>(req);
  if (!args.item_id || !args.section) return toolReply({ ok: false, error: "item_id and section required" });
  const s = await updateState((s) => {
    s.answers = s.answers.filter((a) => a.item_id !== args.item_id);
    const section: Answer["section"] = normalizeSection(args.section);
    s.answers.push({ item_id: args.item_id, section, value: args.value, raw: args.raw ?? "", at: new Date().toISOString() });
    if (s.interview?.reopened?.item_id === args.item_id) s.interview.reopened = null;
  }, profileId);
  const done = s.answers.filter((a) => a.section === normalizeSection(args.section)).length;
  return toolReply({ ok: true, recorded: args.item_id, answered_in_section: done });
}
