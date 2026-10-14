"""Compress fetched TTF subsets without changing their glyphs or font metadata."""
import hashlib
import io
import json
import re
from pathlib import Path
from fontTools.ttLib import TTFont

directory = Path(__file__).resolve().parents[2] / "src/web/public/fonts"
manifest_path = directory / "sources.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
css_path = directory / "fonts.css"
css = css_path.read_text(encoding="utf-8")
for entry in manifest["fonts"]:
    if not entry["file"].endswith(".ttf"):
        continue
    if not re.fullmatch(r"[a-f0-9]{20}\.ttf", entry["file"]):
        raise ValueError("Invalid generated font filename")
    original = directory / entry["file"]
    source = original.read_bytes()
    if hashlib.sha256(source).hexdigest() != entry["sha256"]:
        raise ValueError("Font checksum mismatch")
    with TTFont(io.BytesIO(source), recalcTimestamp=False) as font:
        font.flavor = "woff2"
        output = io.BytesIO()
        font.save(output)
    compressed = output.getvalue()
    digest = hashlib.sha256(compressed).hexdigest()
    filename = digest[:20] + ".woff2"
    (directory / filename).write_bytes(compressed)
    css = css.replace("/fonts/" + entry["file"], "/fonts/" + filename)
    entry.update(file=filename, originalSha256=entry["sha256"], sha256=digest, bytes=len(compressed))
    original.unlink()
css = css.replace("format('truetype')", "format('woff2')")
css_path.write_text(css, encoding="utf-8")
manifest["fonts"].sort(key=lambda entry: entry["file"])
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"Font subsets: {sum(entry['bytes'] for entry in manifest['fonts']) / 1024 / 1024:.1f} MiB")
