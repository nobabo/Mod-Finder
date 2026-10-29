"""Conservative English-source selection for offline Steam catalog expansion."""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for setting in ["OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"]:
    os.environ[setting] = "1"
sys.path.insert(0, str(ROOT / "output/local-translation-python"))

ENGLISH_WORDS = set("the this these those is are was were be been will would can could a an and or with without for from into your you its it also more less adds add added adding supports support supported work works mod mods game games pack version new small large performance features changes fixes fix items item building buildings road roads model models texture textures tree trees prop props all contains compatible compatibility original requires allows use using update updated remove change map maps server client player players enemies weapons armor character characters settings allows provides make makes saves load loaded install designed by to of in on as that but only has have not no release released".split())


def main():
    import langid

    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    texts = json.load(sys.stdin)
    if not isinstance(texts, list) or len(texts) > 20000 or any(not isinstance(text, str) or len(text) > 3600 for text in texts):
        raise ValueError("Invalid source language input")
    result = []
    for text in texts:
        content = re.sub(r"https?://\S+", " ", text)
        if any(char.isalpha() and "LATIN" not in unicodedata.name(char, "") for char in content):
            result.append({"english": False, "language": "non-latin"})
            continue
        known = ENGLISH_WORDS.intersection(re.findall(r"[a-z]+", content.lower()))
        if len(known) < 2:
            result.append({"english": False, "language": "insufficient-evidence"})
            continue
        language, _ = langid.classify(content)
        result.append({"english": language == "en", "language": language})
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
