import { readToolArgs, toolReply } from "@/lib/tool";
import { updateState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The agent calls this once every section is done; it unlocks "Build my report". */
export async function POST(req: Request) {
  const { profileId } = await readToolArgs(req);
  const s = await updateState((s) => { s.status = "complete"; }, profileId);
  return toolReply({ ok: true, answers: s.answers.length, message: "Interview marked complete. You can now build the report from the app." });
}
