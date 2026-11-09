"""Scrubber: runs on every string before it is written to out/.

Removes emails, phone numbers, and capitalized tokens that match a names list built from the
data (other speakers in transcripts, @mentions, the person's own name). The names list itself
lives in cache/ and never reaches out/.
"""
from __future__ import annotations

import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
MENTION = re.compile(r"@[\w.-]+")
QUOTE = re.compile(r"[\"“”']([^\"“”']{2,})[\"“”']")
MAX_OBS = 140
MAX_QUOTE_WORDS = 8


def name_tokens(names: set[str]) -> set[str]:
    """Capitalized word tokens (>=3 chars) from every name, e.g. {'Sam', 'Alex', 'Rivera'}."""
    toks = set()
    for n in names:
        for tok in re.split(r"[\s._-]+", n.strip("@")):
            if len(tok) >= 3 and tok[0].isupper():
                toks.add(tok)
    return toks


def scrub(text: str, tokens: set[str]) -> str:
    t = EMAIL.sub("[email]", text)
    t = PHONE.sub("[phone]", t)
    t = MENTION.sub("[name]", t)
    if tokens:
        pat = re.compile(r"\b(" + "|".join(re.escape(x) for x in sorted(tokens, key=len, reverse=True)) + r")\b")
        t = pat.sub("[name]", t)  # case-sensitive on purpose: only capitalized name tokens
    return re.sub(r"\s{2,}", " ", t).strip()


def clean_observation(obs, tokens: set[str]) -> str | None:
    """Return a scrubbed, length-capped paraphrase, or None if it should be dropped."""
    if not isinstance(obs, str) or len(obs.split()) < 3:
        return None
    for m in QUOTE.finditer(obs):
        if len(m.group(1).split()) > MAX_QUOTE_WORDS:
            return None  # quotes longer than 8 words are raw text; drop the whole observation
    s = scrub(obs, tokens)
    return s if len(s) <= MAX_OBS else s[: MAX_OBS - 1].rstrip(" ,;") + "…"
