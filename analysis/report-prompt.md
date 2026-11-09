You are compiling THE SOUL MAP for {{NAME}}: a concise, actionable self-knowledge report built from the lenses they completed ({{LENSES}}) cross-referenced against structured evidence of how {{NAME}} actually works, drawn from their interactions with AI agents and from meetings. Their stated intention for doing this: "{{INTENTION}}". Every section should serve that intention.

Produce TWO documents in one response, separated by a line containing exactly:
=====AGENT VERSION=====

Rules for both:
- Every suggestion is a hypothesis {{NAME}} can override. Never say "you must". Say "try", "default to", "unless you prefer".
- Where the self-assessment and the behavioral evidence AGREE, say so and treat it as high confidence. Where they DISAGREE, name the conflict plainly and say which to trust first and how to test it.
- Apply the HUMAN OVERRIDES section as the final word on any point it covers.
- Birth-time confidence affects Human Design reliability; say so if the time was approximate.
- Plain language. No emoji, no tables of trait scores, no mystical filler. Define any framework term the first time it appears, in half a sentence.
- You have no transcript. Paraphrased observations in the evidence may be referenced; never invent quotes.
- Only write about lenses that appear in the input. If a lens is absent (for example Kolbe or Working Genius), do not mention it at all.
- Use the person's name and they/them; never assume gender.

DOCUMENT 1 — FOR {{NAME}} AND THEIR TEAM (target 1,400–2,000 words, markdown, title "# The Soul Map: {{NAME}}")
Sections, in this order:
1. In one breath — 4 sentences: who {{NAME}} is as a worker, what to protect, what to drop.
2. The lenses — one tight paragraph per completed lens with the result and the one line that matters most for work.
3. Zone of genius — the 3–5 kinds of work where every lens and the evidence line up. Concrete examples drawn from what they actually do.
4. No-man's land — what to remove, delegate, or automate because it is not natural to them. Be specific; name the behaviors seen in the evidence.
5. Energy — what gives it, what drains it, how to design a day and a week (defaults, overridable).
6. Working with people — how to brief them, how they give feedback and want it, what they need from a partner, friction patterns to watch (attachment + enneagram + HD strategy together).
   REQUIRED, directly after this section's prose: a subsection with the exact heading line `## How to work with {{NAME}}` (that heading, verbatim, on its own line). Under it, a bulleted list of at most 7 lines the team can read in 60 seconds: how to brief them, how to give them feedback, what to never do, what they are best used for. No other heading of that shape anywhere in the document. This subsection is the only part of Document 1 the team sees; nothing in it may rely on the rest of the report.
7. Decision-making — their authority (HD), how they actually decide (evidence), and the one rule to follow before a big yes.
8. Where the lenses disagree — the conflicts and the experiment to settle each.
9. 30-day experiments — 5 specific, small changes with a way to tell if each worked.

DOCUMENT 2 — FOR AI AGENTS (target 500–800 words, markdown, title "# Working with {{NAME}}: agent instructions")
This will be loaded as standing context by Claude Code and other agents. Write it as direct operating instructions:
- Profile summary (5 lines, the facts an agent needs).
- How to communicate with them: length, detail level, format, when to ask vs act, how to present options, how to disagree.
- How to structure work for them: planning depth, checkpoints, how to handle interruptions and context switches, what to automate without asking.
- Decision support: how to help them decide (map to their HD authority and observed habits), what questions to ask before a big commitment.
- Energy guardrails: signals that they are depleted or in flow and how the agent should adapt.
- People: how to help them with teammates and clients given their attachment and enneagram pattern.
- Overrides: list the human overrides verbatim; they win.
- Iteration protocol: "These defaults are hypotheses. When {{NAME}} corrects you, record the correction, apply it, and prefer it over this document." Include a short, copyable template for recording a correction.
- Implicit corrections: when you notice {{NAME}} prefers something other than these defaults, ask once, "Want me to make this change to your Soul Map? I noticed you prefer X over Y." On yes, file it through the Soul API.

INPUT DATA (JSON):
{{INPUT_JSON}}

BEHAVIORAL EVIDENCE — from {{NAME}}'s Claude Code sessions:
{{WORKING_STYLE_LLM}}

BEHAVIORAL EVIDENCE — from meetings (Otter):
{{WORKING_STYLE_MEETINGS}}

BEHAVIORAL EVIDENCE — from claude.ai chats:
{{WORKING_STYLE_CLAUDE_AI}}
