#!/usr/bin/env python3
"""
Generate a draft source-code deposit document for software copyright filing.

This script intentionally creates a draft Markdown file, not a final filing PDF.
Review and redact sensitive data before converting to Word/PDF.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE = ROOT / "docs" / "software-copyright-application"
MANIFEST = PACKAGE / "source-file-recommendation.txt"
OUT = PACKAGE / "artifacts" / "source-code-deposit-draft.md"
SOFTWARE_NAME = "Infini 团课训练场馆运营系统软件 V1.0"
LINES_PER_PAGE = 50
MAX_PAGES = 60


def iter_manifest_paths():
    for raw in MANIFEST.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        yield ROOT / line


def is_probably_sensitive(line: str) -> bool:
    lowered = line.lower()
    markers = (
        "password",
        "secret",
        "token",
        "apikey",
        "api_key",
        "access_key",
        "private_key",
        "mqtt_password",
    )
    return any(marker in lowered for marker in markers)


def collect_lines():
    result = []
    for path in iter_manifest_paths():
        if not path.exists():
            continue
        rel = path.relative_to(ROOT)
        result.append(f"// ===== FILE: {rel} =====")
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception as exc:
            result.append(f"// [read failed: {exc}]")
            continue
        for line in lines:
            if is_probably_sensitive(line):
                result.append("// [REDACTED: possible sensitive configuration]")
            else:
                result.append(line)
    return result


def main():
    lines = collect_lines()
    max_lines = LINES_PER_PAGE * MAX_PAGES
    selected = lines[:max_lines]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as fh:
        fh.write(f"# {SOFTWARE_NAME} 源代码鉴别材料草案\n\n")
        fh.write("> 注意：本文件为本地生成草案。正式提交前请人工复核、脱敏，并转换为 A4 Word/PDF。\n\n")
        page = 1
        for idx, line in enumerate(selected, 1):
            if (idx - 1) % LINES_PER_PAGE == 0:
                fh.write(f"\n\n---\n\n")
                fh.write(f"页眉：{SOFTWARE_NAME}    页码：{page}\n\n")
                page += 1
            fh.write(f"{idx:04d} {line}\n")
    print(OUT)
    print(f"lines={len(selected)} pages={(len(selected) + LINES_PER_PAGE - 1) // LINES_PER_PAGE}")


if __name__ == "__main__":
    main()
