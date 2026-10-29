"""Prepare resumable Korean title candidates with the existing isolated models.

This is an offline development step. Models and checkpoints are never shipped.
Importing requires source-bound review/overrides in import-catalog-titles.mjs.
"""
import argparse
import importlib.util
import json
import os
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "output/title-translation"


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def source_text(title):
    # Package identifiers are commonly underscored/CamelCase, unlike prose.
    text = re.sub(r"_+", " ", title)
    text = re.sub(r"(?<=[a-z])(?=[A-Z][a-z])", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def language(text):
    # General language detection is unreliable on short names and acronyms.
    if re.search(r"[\u3040-\u30ff]", text):
        return "ja"
    if re.search(r"[\u4e00-\u9fff]", text):
        return "zh"
    if re.search(r"[\u0400-\u04ff]", text):
        return "ru"
    return "en"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--batch", type=int, default=96)
    parser.add_argument("--prepare-tokenizers", action="store_true")
    parser.add_argument("--route", choices=["opus", "m2m"], default="opus")
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(DEST / "hf-cache"))
    titles = dict.fromkeys(row[0] for path in sorted((ROOT / "src/shared/locales/mod-summaries").glob("*.json"))
                           for row in json.loads(path.read_text(encoding="utf-8")))
    path = DEST / ("checkpoint.json" if args.route == "opus" else "m2m-checkpoint.json")
    saved = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    missing = [title for title in titles if title not in saved]
    if args.limit:
        missing = missing[:args.limit]
    spec = importlib.util.spec_from_file_location("local_translation", ROOT / "tooling/lib/local-translation-server.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if args.prepare_tokenizers:
        from huggingface_hub import snapshot_download
        for model, revision in module.MODEL_REVISIONS.items():
            snapshot_download(model, revision=revision, allow_patterns=["config.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.json", "source.spm", "target.spm", "sentencepiece.bpe.model"])
    translator = module.Translator("facebook/m2m100_418M", "cuda", 2, "ct2", True)
    started = time.monotonic()
    print(json.dumps({"event": "ready", "remaining": len(missing), "existing": len(saved)}), flush=True)
    for offset in range(0, len(missing), args.batch):
        batch = missing[offset:offset + args.batch]
        groups = {}
        for title in batch:
            normalized = source_text(title)
            if re.search(r"[가-힣]", title) and not re.search(r"[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]", title):
                saved[title] = {"title": title, "method": "original-korean"}
            elif not re.search(r"[A-Za-z\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]", title):
                saved[title] = {"title": title, "method": "original-symbols"}
            else:
                groups.setdefault(language(normalized), []).append((title, normalized))
        for lang, items in groups.items():
            opus = lang == "en" and args.route == "opus"
            tokenizer = translator.english_tokenizer if opus else translator.tokenizer
            model = translator.english_model if opus else translator.model
            if opus:
                source = [tokenizer.convert_ids_to_tokens(tokenizer.spm_source.encode(text) + [2]) for _, text in items]
                options = {}
            else:
                tokenizer.src_lang = lang
                source = [tokenizer.convert_ids_to_tokens(tokenizer.encode(text)) for _, text in items]
                options = {"target_prefix": [[tokenizer.lang_code_to_token["ko"]] for _ in items]}
            results = model.translate_batch(source, beam_size=2, max_decoding_length=160,
                                            max_batch_size=48, batch_type="examples", **options)
            for (title, _), result in zip(items, results):
                tokens = result.hypotheses[0] if opus else result.hypotheses[0][1:]
                translated = tokenizer.decode(tokenizer.convert_tokens_to_ids(tokens), skip_special_tokens=True).strip()
                saved[title] = {"title": translated or title, "method": ("opus-mt" if opus else f"m2m100-{lang}") if translated else "needs-review-empty"}
        atomic_json(path, saved)
        print(json.dumps({"event": "progress", "done": len(saved), "total": len(titles),
                          "seconds": round(time.monotonic() - started, 1), "last": [(t, saved[t]["title"]) for t in batch[-3:]]}, ensure_ascii=False), flush=True)
    print(json.dumps({"event": "complete", "done": len(saved), "seconds": round(time.monotonic() - started, 1)}), flush=True)


if __name__ == "__main__":
    main()
