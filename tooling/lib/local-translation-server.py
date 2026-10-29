"""Loopback-only offline translation service for catalog preparation.

Dependencies and downloaded models stay outside the shipped application. The
M2M100 model is MIT licensed; OPUS-MT is CC-BY-4.0 (see model cards).
"""
import argparse
import json
import os
import re
import sys
import threading
import time
from collections import defaultdict
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_REVISIONS = {
    "facebook/m2m100_418M": "55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636",
    "Helsinki-NLP/opus-mt-tc-big-en-ko": "ae8606b7b29a495f31ce679cee2007f536a3a5ce",
}
for setting in ["OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"]:
    os.environ.setdefault(setting, "1")
for dependency in [ROOT / "output/local-translation-python", ROOT / "output/local-translation-cuda"]:
    if dependency.exists():
        sys.path.insert(0, str(dependency))


class Translator:
    def __init__(self, model_name, device, beams, engine, english_opus):
        import torch
        # This text-only process must not import the host's optional XPU vision
        # or audio extensions into its isolated CUDA runtime.
        import transformers.utils.import_utils as transformer_imports
        transformer_imports._torchvision_available = False
        transformer_imports._librosa_available = False
        transformer_imports._torchaudio_available = False
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        import langid

        self.torch = torch
        self.langid = langid
        self.name = model_name
        self.engine = engine
        self.multilingual = "m2m100" in model_name
        self.device = "cuda" if device == "auto" and torch.cuda.is_available() else ("cpu" if device == "auto" else device)
        if self.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but unavailable")
        self.beams = beams
        self.english_tokenizer = None
        self.english_model = None
        self.english_engine = None
        self.last_timings = {}
        self.lock = threading.Lock()
        torch.set_num_threads(min(8, torch.get_num_threads()))
        print(json.dumps({"event": "loading", "model": self.name, "device": self.device, "torch": torch.__version__}), flush=True)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, revision=MODEL_REVISIONS.get(model_name), local_files_only=True)
        if engine == "ct2":
            import ctranslate2
            self.model = ctranslate2.Translator(
                str(ROOT / "output/local-translation-m2m100-ct2"), device=self.device,
                compute_type="int8_float16" if self.device == "cuda" else "int8", inter_threads=1, intra_threads=8,
            )
        else:
            self.model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name, revision=MODEL_REVISIONS.get(model_name), local_files_only=True, torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            ).to(self.device).eval()
        self.supported = set(getattr(self.tokenizer, "lang_code_to_id", {}))
        if self.supported:
            langid.set_languages(sorted(self.supported.intersection(langid.langid.LanguageIdentifier.from_modelstring(langid.langid.model).nb_classes)))
        if english_opus:
            from transformers import MarianTokenizer, MarianMTModel
            opus_name = "Helsinki-NLP/opus-mt-tc-big-en-ko"
            self.english_tokenizer = MarianTokenizer.from_pretrained(opus_name, revision=MODEL_REVISIONS[opus_name], local_files_only=True)
            if self.english_tokenizer.spm_source.get_piece_size() != 32000 or self.english_tokenizer.pad_token_id != 32000 or self.english_tokenizer.eos_token_id != 2:
                raise RuntimeError("Unexpected OPUS source vocabulary")
            opus_ct2 = ROOT / "output/local-translation-opus-ct2"
            if engine == "ct2" and opus_ct2.exists():
                self.english_engine = "ct2"
                self.english_model = ctranslate2.Translator(str(opus_ct2), device=self.device,
                    compute_type="int8_float16" if self.device == "cuda" else "int8", inter_threads=1, intra_threads=8)
            else:
                self.english_engine = "torch"
                self.english_model = MarianMTModel.from_pretrained(
                    opus_name, revision=MODEL_REVISIONS[opus_name], local_files_only=True, torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                ).to(self.device).eval()
            self.name = f"{opus_name} + {model_name}"

    @lru_cache(maxsize=1024)
    def language(self, text):
        # Script evidence helps avoid classifying short mod names as languages.
        if len(re.findall(r"[\u3040-\u30ff]", text)) >= 2:
            return "ja"
        if len(re.findall(r"[\u4e00-\u9fff]", text)) >= 3:
            return "zh"
        if len(re.findall(r"[가-힣]", text)) >= max(3, len(re.findall(r"[a-zA-Z]", text)) / 2):
            return "ko"
        if len(set(re.findall(r"\b(?:the|this|with|your|adds|improves|requires|which|these|that|from|weapons)\b", text.lower()))) >= 2:
            return "en"
        language, _ = self.langid.classify(text)
        return language if language in self.supported else "en"

    def split(self, text):
        # Never truncate the source. Long descriptions are split into complete
        # token spans and reassembled in order. Keep short descriptions whole
        # so sentences share their context and do not multiply inference work.
        ids = self.tokenizer.encode(text, add_special_tokens=False)
        if len(ids) <= 300:
            return [text]
        return [self.tokenizer.decode(ids[start:start + 300], skip_special_tokens=True) for start in range(0, len(ids), 300)]

    def translate(self, texts):
        with self.lock:
            started = time.monotonic()
            groups = defaultdict(list)
            assembled = [[] for _ in texts]
            for position, text in enumerate(texts):
                language = self.language(text) if self.multilingual else "en"
                if language == "ko":
                    assembled[position].append((0, text))
                    continue
                if self.multilingual:
                    self.tokenizer.src_lang = language
                for part, segment in enumerate(self.split(text)):
                    groups[language].append((position, part, segment))
            prepared = time.monotonic()
            for language, segments in groups.items():
                if self.multilingual:
                    self.tokenizer.src_lang = language
                if language == "en" and self.english_model is not None:
                    if self.english_engine == "ct2":
                        # CT2's source vocabulary strings come from vocab.json,
                        # so map the correct source IDs through those strings.
                        source = [self.english_tokenizer.convert_ids_to_tokens(self.english_tokenizer.spm_source.encode(row[2]) + [2]) for row in segments]
                        results = self.english_model.translate_batch(source, beam_size=4,
                            max_decoding_length=512, max_batch_size=32, batch_type="examples")
                        for (position, part, _), result in zip(segments, results):
                            translated = self.english_tokenizer.decode(self.english_tokenizer.convert_tokens_to_ids(result.hypotheses[0]), skip_special_tokens=True)
                            assembled[position].append((part, translated.strip()))
                        continue
                    for offset in range(0, len(segments), 8):
                        batch = segments[offset:offset + 8]
                        # This OPUS export's vocab.json is the target vocabulary.
                        # Source pieces must retain their original source.spm IDs;
                        # mapping them through the Korean vocab creates UNKs and
                        # silently produces unrelated translations.
                        ids = [self.english_tokenizer.spm_source.encode(row[2]) + [2] for row in batch]
                        longest = max(map(len, ids))
                        padded = [row + [32000] * (longest - len(row)) for row in ids]
                        masks = [[1] * len(row) + [0] * (longest - len(row)) for row in ids]
                        with self.torch.inference_mode():
                            tokens = self.english_model.generate(
                                input_ids=self.torch.tensor(padded, device=self.device),
                                attention_mask=self.torch.tensor(masks, device=self.device),
                                num_beams=4, max_new_tokens=512,
                            )
                        for (position, part, _), translated in zip(batch, self.english_tokenizer.batch_decode(tokens, skip_special_tokens=True)):
                            assembled[position].append((part, translated.strip()))
                    continue
                if self.engine == "ct2":
                    source = [self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(row[2])) for row in segments]
                    prefix = [[self.tokenizer.lang_code_to_token["ko"]] for _ in segments]
                    results = self.model.translate_batch(source, target_prefix=prefix, beam_size=self.beams,
                        max_decoding_length=512, max_batch_size=16, batch_type="examples")
                    for (position, part, _), result in zip(segments, results):
                        translated = self.tokenizer.decode(self.tokenizer.convert_tokens_to_ids(result.hypotheses[0][1:]), skip_special_tokens=True)
                        assembled[position].append((part, translated.strip()))
                    continue
                for offset in range(0, len(segments), 8):
                    batch = segments[offset:offset + 8]
                    inputs = self.tokenizer([row[2] for row in batch], return_tensors="pt", padding=True, truncation=False).to(self.device)
                    options = {"num_beams": self.beams, "max_new_tokens": 512}
                    if self.multilingual:
                        options["forced_bos_token_id"] = self.tokenizer.get_lang_id("ko")
                    with self.torch.inference_mode():
                        tokens = self.model.generate(**inputs, **options)
                    for (position, part, _), translated in zip(batch, self.tokenizer.batch_decode(tokens, skip_special_tokens=True)):
                        assembled[position].append((part, translated.strip()))
            self.last_timings = {"prepareSeconds": round(prepared - started, 4), "inferenceSeconds": round(time.monotonic() - prepared, 4)}
            return [" ".join(value for _, value in sorted(parts)) for parts in assembled]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="facebook/m2m100_418M")
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    parser.add_argument("--port", type=int, default=8768)
    parser.add_argument("--beams", type=int, choices=[1, 2, 4], default=2)
    parser.add_argument("--engine", choices=["torch", "ct2"], default="torch")
    parser.add_argument("--english-opus", action="store_true")
    parser.add_argument("--benchmark", action="store_true")
    args = parser.parse_args()
    started = time.monotonic()
    translator = Translator(args.model, args.device, args.beams, args.engine, args.english_opus)
    print(json.dumps({"event": "ready", "model": translator.name, "device": translator.device, "loadSeconds": round(time.monotonic() - started, 2)}), flush=True)
    if args.benchmark:
        samples = ["Adds new weapons and armor to the game.", "Improves performance and fixes bugs.", "添加新的武器和盔甲。", "新しい武器と防具を追加します。"]
        started = time.monotonic()
        translated = translator.translate(samples)
        print(json.dumps({"translations": translated, "seconds": round(time.monotonic() - started, 2), "device": translator.device}), flush=True)
        return

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, code, value):
            body = json.dumps(value, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != "/health":
                self.send_json(404, {"error": "not_found"})
                return
            self.send_json(200, {"model": translator.name, "device": translator.device})

        def do_POST(self):
            if self.path != "/translate":
                self.send_json(404, {"error": "not_found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 1 or length > 128 * 1024:
                    raise ValueError("Invalid request length")
                data = json.loads(self.rfile.read(length))
                texts = data.get("texts")
                if not isinstance(texts, list) or not 1 <= len(texts) <= 32 or any(not isinstance(text, str) or not text.strip() or len(text) > 3600 for text in texts):
                    raise ValueError("Invalid texts")
                translations = translator.translate(texts)
                self.send_json(200, {"translations": translations, "model": translator.name, "timings": translator.last_timings})
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"error": "invalid_request"})
            except Exception as error:
                print(json.dumps({"event": "translation_error", "type": type(error).__name__}), flush=True)
                self.send_json(500, {"error": "translation_failed"})

        def log_message(self, *_):
            pass

    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
