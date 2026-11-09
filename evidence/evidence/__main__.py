"""CLI: evidence import | score | summary | purge."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import statistics
import sys
from pathlib import Path
from dataclasses import asdict
from datetime import datetime, timezone

from . import CACHE_DIR, OUT_DIR, SOURCES
from .importers import ImportError_, Turn, run_import
from .scorer import DIMENSIONS, MODEL, score_source
from .scrub import name_tokens, scrub

AGREE_SPREAD = 15  # max-min of per-source means at or below this counts as agreement


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _person_dir(person: str):
    return CACHE_DIR / person.lower()


def _out_dir(a) -> Path:
    """`--out-dir`, then $EVIDENCE_OUT_DIR, then the package default out/. The app passes out/<person>/."""
    raw = getattr(a, "out_dir", None) or os.environ.get("EVIDENCE_OUT_DIR")
    return Path(raw).expanduser().resolve() if raw else OUT_DIR


def _load_names(person: str) -> set[str]:
    p = _person_dir(person) / "names.json"
    return set(json.loads(p.read_text())) if p.exists() else set()


def _save_names(person: str, names: set[str]) -> None:
    (_person_dir(person) / "names.json").write_text(json.dumps(sorted(names), indent=1))


def cmd_import(a) -> int:
    try:
        turns, names = run_import(a.source, a.file, a.person, a.speaker)
    except ImportError_ as e:
        print(f"import failed: {e}", file=sys.stderr)
        return 2
    if not turns:
        print(f"import: no turns for {a.person!r} found in {a.file}", file=sys.stderr)
        return 2
    d = _person_dir(a.person)
    d.mkdir(parents=True, exist_ok=True)
    with open(d / f"{a.source}.jsonl", "w", encoding="utf-8") as fh:
        for t in turns:
            fh.write(json.dumps(asdict(t), ensure_ascii=False) + "\n")
    all_names = _load_names(a.person) | names | {a.person, a.speaker or ""} - {""}
    _save_names(a.person, all_names)
    print(f"imported {len(turns)} turns from {a.source} -> {d / (a.source + '.jsonl')} ({len(names)} names noted)")
    return 0


def _cached_sources(person: str) -> dict[str, list[Turn]]:
    d = _person_dir(person)
    out = {}
    for p in sorted(d.glob("*.jsonl")) if d.exists() else []:
        with open(p, encoding="utf-8") as fh:
            out[p.stem] = [Turn(**json.loads(line)) for line in fh if line.strip()]
    return out


def cmd_score(a) -> int:
    cached = _cached_sources(a.person)
    if a.source:
        cached = {k: v for k, v in cached.items() if k == a.source}
    if not cached:
        print(f"nothing to score: run `evidence import` first (cache: {_person_dir(a.person)})", file=sys.stderr)
        return 2
    tokens = name_tokens(_load_names(a.person))
    out_dir = _out_dir(a)
    out_dir.mkdir(parents=True, exist_ok=True)
    for source, turns in cached.items():
        print(f"scoring {source}: {len(turns)} turns with {a.model}")
        res = score_source(source, turns, tokens, a.max_windows, a.model)
        doc = {
            "source": source,
            "person": a.person,
            "generated_at": _now(),
            "windows": res["windows"],
            "turns_scored": res["turns_scored"],
            "model": res["model"],
            "dimensions": res["dimensions"],
            "observations": [scrub(o, tokens) for o in res["observations"]],
            "caveats": [scrub(c, tokens) for c in res["caveats"]],
        }
        path = out_dir / f"{source}.json"
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
        print(f"  wrote {path}")
    return cmd_summary(a)


def cmd_summary(a) -> int:
    out_dir = _out_dir(a)
    docs = [json.loads(p.read_text()) for p in sorted(out_dir.glob("*.json")) if p.name != "summary.json"]
    docs = [d for d in docs if d.get("person") == a.person]
    if not docs:
        print("no scored sources in out/; run `evidence score` first", file=sys.stderr)
        return 2
    dims = {}
    for d in DIMENSIONS:
        per_source = {doc["source"]: doc["dimensions"][d]["mean"] for doc in docs
                      if doc["dimensions"].get(d, {}).get("mean") is not None}
        vals = list(per_source.values())
        if not vals:
            flag = "no_data"
        elif len(vals) == 1:
            flag = "single_source"
        else:
            flag = "agree" if max(vals) - min(vals) <= AGREE_SPREAD else "disagree"
        dims[d] = {
            "mean": round(statistics.fmean(vals), 1) if vals else None,
            "spread": round(max(vals) - min(vals), 1) if len(vals) > 1 else 0.0,
            "per_source": per_source,
            "flag": flag,
        }
    summary = {
        "person": a.person,
        "generated_at": _now(),
        "sources": {doc["source"]: {"windows": doc["windows"], "turns_scored": doc.get("turns_scored")} for doc in docs},
        "dimensions": dims,
        "observations": {doc["source"]: doc["observations"] for doc in docs},
        "caveats": sorted({c for doc in docs for c in doc["caveats"]}
                          | ({"only one source scored; agreement flags are not meaningful"} if len(docs) == 1 else set())),
    }
    path = out_dir / "summary.json"
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"wrote {path}")
    return 0


def cmd_purge(a) -> int:
    d = _person_dir(a.person)
    if d.exists():
        shutil.rmtree(d)
        print(f"removed {d}")
    else:
        print(f"nothing cached for {a.person}")
    if a.out:
        for p in _out_dir(a).glob("*.json"):
            try:
                if json.loads(p.read_text()).get("person") == a.person:
                    p.unlink()
                    print(f"removed {p}")
            except (json.JSONDecodeError, OSError):
                pass
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="evidence", description="Soul Map evidence: import, score locally, summarize")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("import", help="import a person's own turns into cache/")
    p.add_argument("--source", required=True, choices=SOURCES)
    p.add_argument("--file", required=True, help="export zip, json, jsonl, txt, or a folder of them")
    p.add_argument("--person", required=True)
    p.add_argument("--speaker", help="speaker label to match in transcripts (default: the person name)")
    p.set_defaults(fn=cmd_import)

    p = sub.add_parser("score", help="score cached sources with the local model and write out/")
    p.add_argument("--person", required=True)
    p.add_argument("--source", choices=SOURCES, help="score one source only")
    p.add_argument("--max-windows", type=int, help="cap windows per source (sampled evenly)")
    p.add_argument("--model", default=MODEL)
    p.add_argument("--out-dir", help="where to write <source>.json and summary.json (default: out/, or $EVIDENCE_OUT_DIR)")
    p.set_defaults(fn=cmd_score)

    p = sub.add_parser("summary", help="merge out/<source>.json into out/summary.json")
    p.add_argument("--person", required=True)
    p.add_argument("--out-dir", help="out directory to merge (default: out/, or $EVIDENCE_OUT_DIR)")
    p.set_defaults(fn=cmd_summary)

    p = sub.add_parser("purge", help="delete cached turns (and with --out, the scored files) for a person")
    p.add_argument("--person", required=True)
    p.add_argument("--out", action="store_true")
    p.add_argument("--out-dir", help="out directory to purge from with --out (default: out/, or $EVIDENCE_OUT_DIR)")
    p.set_defaults(fn=cmd_purge)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
