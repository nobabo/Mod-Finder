"""Download pinned public translation weights and prepare local CT2 copies.

Run from the repository root after installing the isolated dependencies described
in docs. This never changes the application's production runtime or credentials.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for setting in ["OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"]:
    os.environ.setdefault(setting, "1")
for dependency in [ROOT / "output/local-translation-python", ROOT / "output/local-translation-cuda"]:
    if dependency.exists():
        sys.path.insert(0, str(dependency))


def main():
    from huggingface_hub import snapshot_download

    models = [
        ("facebook/m2m100_418M", "55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636", "local-translation-m2m100-ct2"),
        ("Helsinki-NLP/opus-mt-tc-big-en-ko", "ae8606b7b29a495f31ce679cee2007f536a3a5ce", "local-translation-opus-ct2"),
    ]
    for model, revision, directory in models:
        snapshot = snapshot_download(model, revision=revision, allow_patterns=[
            "README.md", "config.json", "generation_config.json", "tokenizer_config.json",
            "special_tokens_map.json", "vocab.json", "source.spm", "target.spm",
            "sentencepiece.bpe.model", "model.safetensors" if "Helsinki" in model else "pytorch_model.bin",
        ])
        if "--download-only" in sys.argv:
            print(f"Downloaded {model}: {snapshot}", flush=True)
            continue
        import torch  # Load the isolated CUDA runtime before the CT2 extension.
        import transformers.utils.import_utils as transformer_imports
        transformer_imports._torchvision_available = False
        transformer_imports._librosa_available = False
        transformer_imports._torchaudio_available = False
        import ctranslate2

        destination = ROOT / "output" / directory
        if not (destination / "model.bin").is_file():
            converter = ctranslate2.converters.TransformersConverter(snapshot, load_as_float16=True)
            converter.convert(str(destination), quantization="int8_float16")
        print(f"Prepared {model}: {destination}", flush=True)


if __name__ == "__main__":
    main()
