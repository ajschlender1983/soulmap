# evidence

Local evidence pipeline for Soul Map. Imports a person's own turns from AI-chat and meeting
exports, scores them with the local Ollama model against a fixed codebook, and writes only
numbers and short scrubbed paraphrases to `out/`. Raw text lives in `cache/` (gitignored) and
can be deleted with `purge`.

```
uv run evidence import --source claude-ai   --file export.zip --person max
uv run evidence import --source chatgpt     --file export.zip --person max
uv run evidence import --source claude-code --file ../analysis/user_messages.jsonl --person max
uv run evidence import --source granola     --file notes/ --person me --speaker "Sam"
uv run evidence import --source granola     --file "~/Library/Application Support/Granola/cache-v3.json" --person max   # the app's own cache: only your microphone side is kept
uv run evidence import --source otter       --file call.txt --person me --speaker "Sam"
uv run evidence score   --person max [--max-windows 6] [--model qwen3:8b]
uv run evidence summary --person max
uv run evidence purge   --person max [--out]
```

The app's Connections page (`app/lib/connectors.ts`) runs these same imports on its own for Claude Code (`~/.claude/projects`), Granola's cache, a Claude.ai export zip in `~/Downloads`, and Otter transcripts dropped in `cache/<person>/otter-inbox/` by the `soul-otter-sync` Claude Code skill; `cl soul sync` (nightly via `com.soulmap.sync`) triggers it for every profile.

Output directory: `--out-dir` on `score`, `summary` and `purge` (or `EVIDENCE_OUT_DIR`); default `out/`. The app uses `out/<person>/`.
Model: `SOUL_LOCAL_MODEL` (default `qwen3:8b`), endpoint `OLLAMA_URL` (default localhost:11434).
Output schema per source: `{source, person, generated_at, windows, dimensions: {name: {mean, stdev, n}}, observations[], caveats[]}`;
`summary.json` adds per-dimension `per_source`, `spread`, and a flag (`agree` / `disagree` / `single_source`).
