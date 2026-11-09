# The Soul Map

**Know Thyself.**

A 40 minute interview on your Mac that maps how you work: Human Design and Gene Keys from your birth data, then Enneagram, attachment, Big Five, chronotype and values from your answers. Connect Otter, Granola or Claude Code and it also learns from how you actually talk and work. It writes two documents: a report for you, and a soul file your AI tools read so they work the way you do.

Website: https://soulmap.nextmissionsi.com

## Install

Open Terminal and paste:

```bash
curl -fsSL https://soulmap.nextmissionsi.com/install.sh | bash
```

It installs what your Mac is missing (Node, and uv for Python), then opens the Soul Map at http://localhost:3355/soul. No admin password. Allow about 5 minutes.

Needs: macOS, 8 GB of memory, about 2 GB of free disk (8 GB more if you choose the local model).

## Who does the thinking

Onboarding asks you to pick one. You can change it later in Settings.

- **Claude (recommended).** Claude by Anthropic reads your answers and your own lines from meetings, then writes your report. Uses your own Anthropic API key, about 30 cents a report. Get a key at https://console.anthropic.com/settings/keys.
- **Only this Mac.** A free model runs on your Mac through Ollama. Nothing you say leaves it. One download of about 5 GB; reports take a few minutes and read plainer.

## Use it

1. Fill in your name and birth date, time and city, and pick who does the thinking.
2. Answer the questions. Stop any time; it remembers.
3. Optional: open **Evidence** and connect Otter or Granola with one click. Every meeting is pulled in, and new ones sync once a day on their own.
4. Tap **Build my report**. When new meetings change the picture, the report and soul file are rewritten, at most once a week.
5. Open **Soul file** and tap **Add to Claude Code**, or copy it into claude.ai, ChatGPT or Grok.

## What is stored, and where

- Your answers, chart, reports and settings stay in this folder on your Mac (`data/` and `report/`, never committed).
- From meetings, only your own lines are kept. Other people's words are never stored or sent.
- The report holds patterns and scores, never quotes.

## Update or remove

- Update: run the install line again.
- Stop and remove the background service: `~/SoulMap/uninstall.sh`. Delete `~/SoulMap` to remove your data.

## Layout

- `app/` the app (Next.js). Runs on 127.0.0.1:3355, starts at login. `app/lib/ai.ts` picks Claude or the local model.
- `analysis/hdcalc/` Human Design and Gene Keys calculator (Python, Swiss Ephemeris, offline).
- `analysis/questions/` question banks, interview plan, scoring.
- `analysis/report-prompt.md` the report prompt.
- `evidence/` reads your own side of Claude Code sessions and meetings, scores it, and keeps only numbers and short paraphrases.
- `scripts/local-model.sh` installs Ollama and the local model when you choose it.
- `site/` the website.

## License

MIT. See `LICENSE`.
