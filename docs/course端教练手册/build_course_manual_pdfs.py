from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from build_course_manuals import RU, ZH


OUT_DIR = Path(__file__).resolve().parent
FONT_PATH = "/Library/Fonts/Arial Unicode.ttf"
FONT_NAME = "ArialUnicode"


def register_font() -> None:
    if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))


def make_styles(lang: str) -> dict[str, ParagraphStyle]:
    register_font()
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ManualTitle",
            parent=base["Title"],
            fontName=FONT_NAME,
            fontSize=23,
            leading=28,
            textColor=colors.HexColor("#0B2545"),
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "ManualSubtitle",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#546A7B"),
            spaceAfter=4,
        ),
        "meta": ParagraphStyle(
            "ManualMeta",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "ManualHeading1",
            parent=base["Heading1"],
            fontName=FONT_NAME,
            fontSize=15.5,
            leading=20,
            textColor=colors.HexColor("#0B4F7A"),
            spaceBefore=13,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "ManualBody",
            parent=base["BodyText"],
            fontName=FONT_NAME,
            fontSize=9.4 if lang == "ru" else 9.7,
            leading=13.2,
            textColor=colors.HexColor("#172033"),
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "ManualSmall",
            parent=base["BodyText"],
            fontName=FONT_NAME,
            fontSize=8.2,
            leading=11.2,
            textColor=colors.HexColor("#172033"),
        ),
        "table_header": ParagraphStyle(
            "ManualTableHeader",
            parent=base["BodyText"],
            fontName=FONT_NAME,
            fontSize=8.2,
            leading=10.5,
            textColor=colors.HexColor("#17324D"),
        ),
        "table_cell": ParagraphStyle(
            "ManualTableCell",
            parent=base["BodyText"],
            fontName=FONT_NAME,
            fontSize=7.8 if lang == "ru" else 8.0,
            leading=10.5,
            textColor=colors.HexColor("#172033"),
        ),
        "note": ParagraphStyle(
            "ManualNote",
            parent=base["BodyText"],
            fontName=FONT_NAME,
            fontSize=8.6,
            leading=12,
            textColor=colors.HexColor("#594100"),
            spaceAfter=0,
        ),
    }


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def manual_table(table_data: dict, styles: dict[str, ParagraphStyle]) -> Table:
    headers = table_data["headers"]
    rows = table_data["rows"]
    col_count = len(headers)
    col_widths = [1.42 * inch, 2.05 * inch, 2.87 * inch] if col_count == 3 else [6.34 * inch / col_count] * col_count
    data = [[p(f"<b>{header}</b>", styles["table_header"]) for header in headers]]
    for row in rows:
        data.append([p(f"<b>{cell}</b>" if idx == 0 else cell, styles["table_cell"]) for idx, cell in enumerate(row)])
    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F1F8")),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F6F8FA")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D7DEE8")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def note_box(text: str, styles: dict[str, ParagraphStyle], label: str) -> Table:
    table = Table([[p(f"<b>{label}</b> {text}", styles["note"])]], colWidths=[6.34 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8E6")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E8D7A1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def list_block(items: list[str], styles: dict[str, ParagraphStyle]) -> ListFlowable:
    flow_items = [ListItem(p(item, styles["body"]), leftIndent=8) for item in items]
    return ListFlowable(
        flow_items,
        bulletType="1",
        start="1",
        leftIndent=18,
        bulletFontName=FONT_NAME,
        bulletFontSize=8.8,
        bulletDedent=12,
        spaceAfter=6,
    )


def footer(canvas, doc, title: str) -> None:
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setFont(FONT_NAME, 7.4)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(0.82 * inch, 0.45 * inch, title)
    canvas.drawRightString(7.68 * inch, 0.45 * inch, str(doc.page))
    canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
    canvas.setLineWidth(0.4)
    canvas.line(0.82 * inch, 0.62 * inch, 7.68 * inch, 0.62 * inch)
    canvas.restoreState()


def build_pdf(data: dict, filename: str, lang: str) -> Path:
    styles = make_styles(lang)
    path = OUT_DIR / filename
    doc = BaseDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=0.82 * inch,
        rightMargin=0.82 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.78 * inch,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=lambda c, d: footer(c, d, data["title"]))])

    story = [
        p(data["title"], styles["title"]),
        p(data["subtitle"], styles["subtitle"]),
        p(data["meta"], styles["meta"]),
    ]
    for para in data["intro"]:
        story.append(p(para, styles["body"]))
    story.extend(
        [
            note_box(
                "建议把本手册和动作命名规则发给所有参与编课的人，避免同一动作出现多个名字或多个分类。"
                if lang == "zh"
                else "Рекомендуется передать это руководство всем, кто готовит курсы, чтобы избежать разных названий одного упражнения и лишних категорий.",
                styles,
                "提示：" if lang == "zh" else "Совет:",
            ),
            Spacer(1, 5),
        ]
    )

    for section in data["sections"]:
        block = [p(section["h"], styles["h1"])]
        for para in section.get("body", []):
            block.append(p(para, styles["body"]))
        story.append(KeepTogether(block))
        if "steps" in section:
            story.append(list_block(section["steps"], styles))
        if "table" in section:
            story.append(manual_table(section["table"], styles))
            story.append(Spacer(1, 5))
        if "note" in section:
            story.append(note_box(section["note"], styles, "注意：" if lang == "zh" else "Важно:"))
            story.append(Spacer(1, 5))

    doc.build(story)
    return path


def main() -> None:
    print(build_pdf(ZH, "INFINI课程端教练操作手册_中文.pdf", "zh"))
    print(build_pdf(RU, "Руководство_тренера_INFINI_редактор_курсов.pdf", "ru"))


if __name__ == "__main__":
    main()
