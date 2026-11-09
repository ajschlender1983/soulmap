import type { SoulState } from "./state";
import { recentTranscript } from "./state";
import { DEFAULT_PROFILE } from "./profile";

/** The same variables go to the voice agent and the chat agent so either one resumes the one conversation. */
export function dynamicVars(s: SoulState): Record<string, string> {
  const answered = s.answers.map((a) => a.item_id).join(",");
  return {
    profile_id: s.profile?.id ?? DEFAULT_PROFILE,
    user_name: s.profile?.name || "there",
    intention: s.profile?.intention ?? "",
    enabled_lenses: (s.profile?.enabled_lenses ?? []).join(","),
    already_answered: answered || "none",
    answered_count: String(s.answers.length),
    birth_known: s.chart ? "yes" : "no",
    recent_transcript: recentTranscript(s) || "(nothing yet; this is the start)",
  };
}
