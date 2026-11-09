"""Importers. Each yields Turn(ts, text, source) for the person's own turns only.

Every importer takes a path and a person label; speaker-based formats (Granola, Otter)
also take the speaker name to match. Unknown formats raise ImportError with a clear message.
"""
from __future__ import annotations

import io
import json
import os
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Iterator


class ImportError_(Exception):
    """Raised when a file is not in the format the importer expects."""


@dataclass
class Turn:
    ts: str | None  # ISO-8601 or None
    text: str
    source: str
    speaker: str | None = None  # only for transcript sources; used to build the names list


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    return str(value)


def _load_json_from(path: str, wanted: str = "conversations.json"):
    """Return parsed JSON from a .json file or from `wanted` inside a zip (searched at any depth)."""
    if not os.path.exists(path):
        raise ImportError_(f"file not found: {path}")
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if n.endswith(wanted)]
            if not names:
                raise ImportError_(f"{os.path.basename(path)} has no {wanted} inside; is this the right export?")
            with zf.open(sorted(names, key=len)[0]) as fh:
                try:
                    return json.load(io.TextIOWrapper(fh, encoding="utf-8"))
                except json.JSONDecodeError as e:
                    raise ImportError_(f"{wanted} inside {os.path.basename(path)} is not valid JSON ({e.msg})") from None
    if path.endswith(".json"):
        with open(path, encoding="utf-8") as fh:
            try:
                return json.load(fh)
            except json.JSONDecodeError as e:
                raise ImportError_(f"{os.path.basename(path)} is not valid JSON ({e.msg}); upload the export zip or its conversations.json") from None
    raise ImportError_(f"expected a .zip export or a .json file, got {path}")


# (a) Claude.ai export ------------------------------------------------------------
def import_claude_ai(path: str, person: str, speaker: str | None = None) -> Iterator[Turn]:
    data = _load_json_from(path)
    if not isinstance(data, list) or (data and "chat_messages" not in data[0]):
        raise ImportError_("not a Claude.ai conversations.json (expected a list with chat_messages[])")
    for conv in data:
        for msg in conv.get("chat_messages") or []:
            if msg.get("sender") != "human":
                continue
            text = msg.get("text") or "".join(
                c.get("text", "") for c in msg.get("content") or [] if isinstance(c, dict)
            )
            if text.strip():
                yield Turn(_iso(msg.get("created_at")), text.strip(), "claude-ai")


# (b) ChatGPT export ---------------------------------------------------------------
def import_chatgpt(path: str, person: str, speaker: str | None = None) -> Iterator[Turn]:
    data = _load_json_from(path)
    if not isinstance(data, list) or (data and "mapping" not in data[0]):
        raise ImportError_("not a ChatGPT conversations.json (expected a list with a mapping tree)")
    for conv in data:
        nodes = []
        for node in (conv.get("mapping") or {}).values():
            msg = (node or {}).get("message") or {}
            if ((msg.get("author") or {}).get("role")) != "user":
                continue
            parts = (msg.get("content") or {}).get("parts") or []
            text = "\n".join(p for p in parts if isinstance(p, str)).strip()
            if text:
                nodes.append((msg.get("create_time") or 0, text))
        for ct, text in sorted(nodes, key=lambda x: x[0]):
            yield Turn(_iso(ct) if ct else None, text, "chatgpt")


# (c) Claude Code transcripts (same filters as analysis/extract_user_messages.py) --------
NOISE_PREFIXES = (
    "<command-", "<local-command", "<system-reminder", "<bash-input", "<bash-stdout", "<bash-stderr",
    "<user-prompt-submit-hook", "[Request interrupted", "<task-notification", "<ide_", "<artifact",
    "Caveat: The messages below", "This session is being continued from a previous conversation",
    "<scheduled-task", "<cross-session-message", "Base directory for this skill:",
    "Approach this as the design lead at a small studio",
)
TOOL_OUTPUT_HINT = re.compile(
    r"^\s*(\{\"|\[\{|Traceback \(most recent|\$ |Error: |warning: |npm ERR!|Co-Authored-By:|diff --git|@@ -\d+)"
)
WRAPPERS = re.compile(
    r"<system-reminder>.*?</system-reminder>|<command-[a-z-]+>.*?</command-[a-z-]+>|"
    r"<local-command-[a-z-]+>.*?</local-command-[a-z-]+>",
    re.S,
)


def _claude_code_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_result":
                return ""
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return ""


def _claude_code_clean(text: str) -> str:
    t = text.strip()
    if not t or t.startswith(NOISE_PREFIXES) or TOOL_OUTPUT_HINT.match(t):
        return ""
    t = WRAPPERS.sub("", t).strip()
    return t if len(t) >= 2 else ""


def _jsonl_files(path: str) -> list[str]:
    if os.path.isdir(path):
        out = []
        for root, _, files in os.walk(path):
            if f"{os.sep}subagents" in root:
                continue
            out += [os.path.join(root, f) for f in files if f.endswith(".jsonl")]
        return sorted(out)
    return [path]


def import_claude_code(path: str, person: str, speaker: str | None = None) -> Iterator[Turn]:
    """Accepts a raw session .jsonl, a directory of them, or a pre-extracted user_messages.jsonl."""
    files = _jsonl_files(path)
    if not files or not all(f.endswith(".jsonl") for f in files):
        raise ImportError_("claude-code needs a .jsonl transcript, a directory of them, or user_messages.jsonl")
    seen = set()
    for f in files:
        with open(f, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if "text" in rec and "type" not in rec:  # pre-extracted user_messages.jsonl
                    text, ts, key = rec["text"], rec.get("timestamp"), (rec.get("timestamp"), rec["text"][:80])
                else:
                    if rec.get("type") != "user" or rec.get("isSidechain"):
                        continue
                    origin = rec.get("origin") or {}
                    if origin and origin.get("kind") not in (None, "human"):
                        continue
                    text = _claude_code_clean(_claude_code_text((rec.get("message") or {}).get("content")))
                    ts, key = rec.get("timestamp"), rec.get("uuid") or (rec.get("timestamp"), text[:80])
                if not text or key in seen:
                    continue
                seen.add(key)
                yield Turn(ts, text, "claude-code")


# (d) Granola -------------------------------------------------------------------------
SPEAKER_LINE = re.compile(r"^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?\**([A-Z][\w .'-]{0,40}?)\**\s*:\s*(.+)$")


def _name_match(speaker: str, wanted: str) -> bool:
    s, w = speaker.strip().lower(), wanted.strip().lower()
    return s == w or s.split()[0] == w.split()[0]


def _walk_json_utterances(obj) -> Iterator[tuple[str, str, str | None]]:
    """Find dicts that look like {speaker, text} anywhere in a JSON tree."""
    if isinstance(obj, dict):
        spk = obj.get("speaker") or obj.get("speaker_name") or obj.get("name")
        txt = obj.get("text") or obj.get("content") or obj.get("transcript")
        if isinstance(spk, str) and isinstance(txt, str):
            yield spk, txt, _iso(obj.get("timestamp") or obj.get("start") or obj.get("created_at"))
            return
        for v in obj.values():
            yield from _walk_json_utterances(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk_json_utterances(v)


def _iter_files(path: str, exts: tuple[str, ...]) -> Iterator[tuple[str, str]]:
    """Yield (name, text) for each matching file in a file, directory, or zip."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as zf:
            for n in zf.namelist():
                if n.endswith(exts) and not n.startswith("__MACOSX"):
                    yield n, zf.read(n).decode("utf-8", errors="replace")
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in sorted(files):
                if f.endswith(exts):
                    with open(os.path.join(root, f), encoding="utf-8", errors="replace") as fh:
                        yield f, fh.read()
    elif path.endswith(exts):
        with open(path, encoding="utf-8", errors="replace") as fh:
            yield os.path.basename(path), fh.read()
    else:
        raise ImportError_(f"expected {' or '.join(exts)} (file, folder, or zip), got {path}")


def _granola_cache_state(tree) -> dict | None:
    """Granola's local cache (~/Library/Application Support/Granola/cache-v*.json) is double-encoded:
    {"cache": "<json string>"} whose parse holds {"state": {"documents": {...}, "transcripts": {...}}}.
    Returns the state dict when `tree` is that cache, else None."""
    if not isinstance(tree, dict):
        return None
    inner = tree.get("cache", tree)
    if isinstance(inner, str):
        try:
            inner = json.loads(inner)
        except json.JSONDecodeError:
            return None
    if not isinstance(inner, dict):
        return None
    state = inner.get("state") if isinstance(inner.get("state"), dict) else inner
    return state if isinstance(state.get("transcripts"), (dict, list)) else None


def _granola_cache_turns(state: dict, wanted: str) -> Iterator[Turn]:
    """The person's own utterances from the cache: segments whose `source` is the microphone (what
    they said, as opposed to `system`, what they heard), or whose speaker label matches. Other
    participants' names (from documents[].people) are yielded as empty turns so the scrubber knows them."""
    docs = state.get("documents") or {}
    if isinstance(docs, list):
        docs = {d.get("id"): d for d in docs if isinstance(d, dict)}
    for doc in docs.values():
        people = doc.get("people") if isinstance(doc, dict) else None
        for p in (people.values() if isinstance(people, dict) else people) if isinstance(people, (dict, list)) else []:
            name = p.get("name") if isinstance(p, dict) else p
            if isinstance(name, str) and name.strip() and not _name_match(name, wanted):
                yield Turn(None, "", "granola", name.strip())
    transcripts = state["transcripts"]
    groups = transcripts.items() if isinstance(transcripts, dict) else [(None, transcripts)]
    for _doc_id, segments in groups:
        if not isinstance(segments, list):
            continue
        for seg in segments:
            if not isinstance(seg, dict):
                continue
            txt = seg.get("text")
            if not isinstance(txt, str) or not txt.strip():
                continue
            src = str(seg.get("source") or "").lower()
            spk = seg.get("speaker") or seg.get("speaker_name")
            mine = src in ("microphone", "mic", "me", "self", "local") or (isinstance(spk, str) and _name_match(spk, wanted))
            if src and not mine and not isinstance(spk, str):
                continue  # system audio: someone else's words, never kept
            ts = _iso(seg.get("start_timestamp") or seg.get("timestamp") or seg.get("start"))
            yield Turn(ts, txt.strip() if mine else "", "granola", spk if isinstance(spk, str) else None)


def import_granola(path: str, person: str, speaker: str | None = None) -> Iterator[Turn]:
    wanted = speaker or person
    found_any = False
    for name, body in _iter_files(path, (".md", ".markdown", ".txt", ".json")):
        if name.endswith(".json"):
            if os.path.basename(name) == "supabase.json":
                continue  # Granola's auth token file, never evidence
            try:
                tree = json.loads(body)
            except json.JSONDecodeError:
                raise ImportError_(f"{name} is not valid JSON")
            state = _granola_cache_state(tree)
            if state is not None:
                for t in _granola_cache_turns(state, wanted):
                    found_any = True
                    yield t
                continue
            for spk, txt, ts in _walk_json_utterances(tree):
                found_any = True
                yield Turn(ts, txt.strip(), "granola", spk) if _name_match(spk, wanted) else Turn(ts, "", "granola", spk)
            continue
        for line in body.splitlines():
            m = SPEAKER_LINE.match(line)
            if not m:
                continue
            found_any = True
            spk, txt = m.group(1), m.group(2).strip()
            yield Turn(None, txt if _name_match(spk, wanted) else "", "granola", spk)
    if not found_any:
        raise ImportError_("no speaker-labelled lines found; Granola export should be transcript markdown, JSON, or the app's cache-v3.json")


# (e) Otter -----------------------------------------------------------------------------
OTTER_INLINE = re.compile(r"^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([A-Z][\w .'-]{0,40}?)\s*:\s*(.+)$")
OTTER_HEADER = re.compile(r"^\s*([A-Z][\w .'-]{0,40}?)\s{1,}\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*$")


def import_otter(path: str, person: str, speaker: str | None = None) -> Iterator[Turn]:
    wanted = speaker or person
    found_any = False
    for _, body in _iter_files(path, (".txt", ".srt", ".md")):
        current: tuple[str, str] | None = None  # (speaker, ts) for header-style blocks
        for line in body.splitlines():
            m = OTTER_INLINE.match(line)
            if m:
                found_any, current = True, None
                ts, spk, txt = m.groups()
                yield Turn(ts, txt.strip() if _name_match(spk, wanted) else "", "otter", spk)
                continue
            h = OTTER_HEADER.match(line)
            if h:
                found_any, current = True, (h.group(1), h.group(2))
                continue
            if current and line.strip():
                spk, ts = current
                yield Turn(ts, line.strip() if _name_match(spk, wanted) else "", "otter", spk)
    if not found_any:
        raise ImportError_("no '[h:mm:ss] Name: text' or 'Name  h:mm' lines found; is this an Otter transcript?")


IMPORTERS = {
    "claude-ai": import_claude_ai,
    "chatgpt": import_chatgpt,
    "claude-code": import_claude_code,
    "granola": import_granola,
    "otter": import_otter,
}


def run_import(source: str, path: str, person: str, speaker: str | None) -> tuple[list[Turn], set[str]]:
    """Return (person's turns, names seen in the data: other speakers and @mentions)."""
    if source not in IMPORTERS:
        raise ImportError_(f"unknown source {source!r}; choose from {', '.join(IMPORTERS)}")
    turns, names = [], set()
    for t in IMPORTERS[source](path, person, speaker):
        if t.speaker:
            names.add(t.speaker.strip())
        if t.text:
            names.update(m.group(1) for m in re.finditer(r"(?<![\w.])@([A-Za-z][\w.-]{1,30})", t.text))
            turns.append(t)
    return turns, names
