"""Soul Map evidence pipeline. Raw text stays in cache/ (local, gitignored); out/ holds numbers and short paraphrases only."""
from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = PKG_ROOT / "cache"
OUT_DIR = PKG_ROOT / "out"
SOURCES = ("claude-ai", "chatgpt", "claude-code", "granola", "otter")
