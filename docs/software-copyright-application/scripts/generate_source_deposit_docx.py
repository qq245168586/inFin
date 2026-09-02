#!/usr/bin/env python3
"""
Generate an A4 Word draft for source-code deposit materials.

Review generated content before filing. The output is intended as a draft
that can be converted to PDF for online submission.
"""

from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

from generate_source_deposit import LINES_PER_PAGE, MAX_PAGES, SOFTWARE_NAME, collect_lines

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "software-copyright-application" / "artifacts" / "Infini团课训练场馆运营系统软件V1.0-源代码鉴别材料草案.docx"


def set_run_font(run, size=6.5, name="Courier New", east_asia="Heiti SC"):
    run.font.name = name
    run.font.size = Pt(size)
    run._element.rPr.rFonts.set(qn("w:eastAsia"), east_asia)


def configure_section(section):
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.2)
    section.bottom_margin = Cm(1.2)
    section.left_margin = Cm(1.2)
    section.right_margin = Cm(1.0)
    section.header_distance = Cm(0.6)
    section.footer_distance = Cm(0.6)


def set_header_footer(section, page):
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False

    header = section.header.paragraphs[0]
    header.text = f"{SOFTWARE_NAME}｜源代码鉴别材料"
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in header.runs:
        run.font.size = Pt(8)
        run.font.name = "Heiti SC"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Heiti SC")

    footer = section.footer.paragraphs[0]
    footer.text = f"第 {page} 页"
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in footer.runs:
        run.font.size = Pt(8)
        run.font.name = "Heiti SC"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Heiti SC")


def add_page(document, page, lines):
    section = document.sections[-1]
    configure_section(section)
    set_header_footer(section, page)

    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = title.add_run(f"页码：{page}")
    run.font.bold = True
    run.font.size = Pt(8)
    run.font.name = "Heiti SC"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Heiti SC")

    body = document.add_paragraph()
    body.paragraph_format.space_before = Pt(0)
    body.paragraph_format.space_after = Pt(0)
    body.paragraph_format.line_spacing = Pt(7.8)
    for idx, line in enumerate(lines):
        if idx:
            body.add_run("\n")
        run = body.add_run(line)
        set_run_font(run)


def main():
    selected = collect_lines()[: LINES_PER_PAGE * MAX_PAGES]
    pages = [selected[idx : idx + LINES_PER_PAGE] for idx in range(0, len(selected), LINES_PER_PAGE)]

    document = Document()
    configure_section(document.sections[0])

    for index, lines in enumerate(pages, 1):
        if index > 1:
            document.add_section(WD_SECTION.NEW_PAGE)
        add_page(document, index, [f"{line_no:04d} {line}" for line_no, line in enumerate(lines, (index - 1) * LINES_PER_PAGE + 1)])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    document.save(OUT)
    print(OUT)
    print(f"pages={len(pages)} lines={len(selected)}")


if __name__ == "__main__":
    main()
