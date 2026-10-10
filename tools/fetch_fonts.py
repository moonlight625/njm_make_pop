#!/usr/bin/env python3
"""Google Fonts (OFL) から日本語手書き系フォントを取得し、woff2 化して vendor/fonts/ に置く。

使い方:
    .venv/bin/python tools/fetch_fonts.py           # 全フォント
    .venv/bin/python tools/fetch_fonts.py yomogi    # id 指定

依存: fonttools, brotli (pip install fonttools brotli)
出力: vendor/fonts/<id>.woff2, vendor/fonts/<id>-OFL.txt
注意: vendor/fonts/fonts.json(一覧マニフェスト)は上書きしない。新フォントは手で1行足す。
"""
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

RAW = "https://raw.githubusercontent.com/google/fonts/main/ofl"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "vendor" / "fonts"

# id: (google/fonts の ofl/ 配下ディレクトリ, TTF ファイル名)
FONTS = {
    "yomogi": ("yomogi", "Yomogi-Regular.ttf"),
    "zen-kurenaido": ("zenkurenaido", "ZenKurenaido-Regular.ttf"),
    "klee-one": ("kleeone", "KleeOne-Regular.ttf"),
    "klee-one-semibold": ("kleeone", "KleeOne-SemiBold.ttf"),
    "yusei-magic": ("yuseimagic", "YuseiMagic-Regular.ttf"),
    "hachi-maru-pop": ("hachimarupop", "HachiMaruPop-Regular.ttf"),
    "yuji-syuku": ("yujisyuku", "YujiSyuku-Regular.ttf"),
}

# 残す文字範囲: ASCII / Latin-1(¥含む) / 記号 / かな / CJK / 全角英数
UNICODES = ",".join([
    "U+0020-007E", "U+00A0-00FF", "U+2000-206F", "U+20A0-20CF",
    "U+2100-214F", "U+2190-21FF", "U+2460-24FF", "U+25A0-25FF",
    "U+2600-26FF", "U+3000-30FF", "U+31F0-31FF", "U+3200-33FF",
    "U+4E00-9FFF", "U+F900-FAFF", "U+FF00-FFEF",
])


def fetch(url: str, dest: Path) -> None:
    print(f"  GET {url}")
    with urllib.request.urlopen(url) as r, open(dest, "wb") as f:
        f.write(r.read())


def build(font_id: str, tmp: Path) -> None:
    d, ttf = FONTS[font_id]
    src = tmp / ttf
    fetch(f"{RAW}/{d}/{ttf}", src)
    fetch(f"{RAW}/{d}/OFL.txt", OUT / f"{font_id}-OFL.txt")
    out = OUT / f"{font_id}.woff2"
    subprocess.run([
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--unicodes={UNICODES}",
        "--flavor=woff2",
        "--layout-features=*",
        "--no-hinting",
        f"--output-file={out}",
    ], check=True)
    print(f"  -> {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


def main() -> None:
    ids = sys.argv[1:] or list(FONTS)
    unknown = [i for i in ids if i not in FONTS]
    if unknown:
        sys.exit(f"unknown font id: {unknown}  (known: {list(FONTS)})")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        for i in ids:
            print(f"[{i}]")
            build(i, Path(t))


if __name__ == "__main__":
    main()
