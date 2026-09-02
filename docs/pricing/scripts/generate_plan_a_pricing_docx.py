#!/usr/bin/env python3
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENTATION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "pricing" / "artifacts" / "方案A-单店阶梯订阅授权报价方案.docx"

CONTENT_WIDTH_DXA = 9360
TABLE_INDENT_DXA = 120

BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
NAVY = RGBColor(11, 37, 69)
GRAY = RGBColor(86, 96, 110)
BLACK = RGBColor(24, 28, 34)
WHITE = RGBColor(255, 255, 255)
LIGHT_BLUE = "E8EEF5"
LIGHT_GRAY = "F2F4F7"
CALLOUT = "F4F6F9"
PALE_GOLD = "FFF6D8"


def set_run_font(run, size=None, color=None, bold=None, italic=None, name="Calibri", east_asia="Heiti SC"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run._element.rPr.rFonts.set(qn("w:eastAsia"), east_asia)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def set_paragraph_spacing(paragraph, before=0, after=6, line=1.25):
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = line


def add_para(doc, text="", size=11, color=BLACK, bold=False, italic=False, align=None, before=0, after=6, line=1.25):
    paragraph = doc.add_paragraph()
    set_paragraph_spacing(paragraph, before=before, after=after, line=line)
    if align is not None:
        paragraph.alignment = align
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=bold, italic=italic)
    return paragraph


def add_heading(doc, text, level=1):
    style = f"Heading {level}"
    paragraph = doc.add_paragraph(style=style)
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run(text)
    if level == 1:
        set_run_font(run, size=16, color=BLUE, bold=True)
        set_paragraph_spacing(paragraph, before=14, after=8, line=1.25)
    elif level == 2:
        set_run_font(run, size=13, color=BLUE, bold=True)
        set_paragraph_spacing(paragraph, before=11, after=6, line=1.25)
    else:
        set_run_font(run, size=12, color=DARK_BLUE, bold=True)
        set_paragraph_spacing(paragraph, before=8, after=4, line=1.25)
    return paragraph


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for key, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{key}"))
        if node is None:
            node = OxmlElement(f"w:{key}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="C8D0DA", size="6"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        node = borders.find(qn(tag))
        if node is None:
            node = OxmlElement(tag)
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), size)
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def set_row_cant_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = tr_pr.find(qn("w:cantSplit"))
    if cant_split is None:
        cant_split = OxmlElement("w:cantSplit")
        tr_pr.append(cant_split)


def set_row_repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = tr_pr.find(qn("w:tblHeader"))
    if tbl_header is None:
        tbl_header = OxmlElement("w:tblHeader")
        tr_pr.append(tbl_header)
    tbl_header.set(qn("w:val"), "true")


def set_table_geometry(table, widths):
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl_pr = table._tbl.tblPr

    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.first_child_found_in("w:tblInd")
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(TABLE_INDENT_DXA))
    tbl_ind.set(qn("w:type"), "dxa")

    tbl_layout = tbl_pr.first_child_found_in("w:tblLayout")
    if tbl_layout is None:
        tbl_layout = OxmlElement("w:tblLayout")
        tbl_pr.append(tbl_layout)
    tbl_layout.set(qn("w:type"), "fixed")

    for row in table.rows:
        set_row_cant_split(row)
        for idx, cell in enumerate(row.cells):
            cell.width = widths[idx]
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.first_child_found_in("w:tcW")
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(widths[idx]))
            tc_w.set(qn("w:type"), "dxa")


def set_cell_text(cell, text, size=10.2, color=BLACK, bold=False, align=None, fill=None):
    cell.text = ""
    paragraph = cell.paragraphs[0]
    set_paragraph_spacing(paragraph, before=0, after=0, line=1.18)
    if align is not None:
        paragraph.alignment = align
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=bold)
    if fill:
        set_cell_shading(cell, fill)


def make_table(doc, headers, rows, widths, header_fill=LIGHT_BLUE, body_size=9.6, price_cols=None):
    table = doc.add_table(rows=1, cols=len(headers))
    set_table_geometry(table, widths)
    set_table_borders(table)
    header = table.rows[0]
    set_row_repeat_header(header)
    for idx, text in enumerate(headers):
        set_cell_text(header.cells[idx], text, size=10.3, bold=True, color=NAVY, fill=header_fill, align=WD_ALIGN_PARAGRAPH.CENTER)

    for row_data in rows:
        row = table.add_row()
        for idx, text in enumerate(row_data):
            align = WD_ALIGN_PARAGRAPH.CENTER if idx == 0 or (price_cols and idx in price_cols) else WD_ALIGN_PARAGRAPH.LEFT
            bold = bool(price_cols and idx in price_cols)
            color = DARK_BLUE if bold else BLACK
            set_cell_text(row.cells[idx], text, size=body_size, color=color, bold=bold, align=align)
    set_table_geometry(table, widths)
    add_para(doc, "", after=2)
    return table


def add_rule_table(doc, rules, fill=CALLOUT):
    table = doc.add_table(rows=0, cols=2)
    widths = [650, 8710]
    set_table_geometry(table, widths)
    set_table_borders(table, color="D6DCE5")
    for number, text in rules:
        row = table.add_row()
        set_cell_text(row.cells[0], str(number), size=10.2, bold=True, color=DARK_BLUE, align=WD_ALIGN_PARAGRAPH.CENTER, fill=fill)
        set_cell_text(row.cells[1], text, size=10.2, color=BLACK, fill=fill)
    set_table_geometry(table, widths)
    add_para(doc, "", after=2)
    return table


def add_callout(doc, label, text, fill=PALE_GOLD):
    table = doc.add_table(rows=1, cols=1)
    set_table_geometry(table, [CONTENT_WIDTH_DXA])
    set_table_borders(table, color="E2C96C")
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    set_cell_margins(cell, top=140, bottom=140, start=180, end=180)
    paragraph = cell.paragraphs[0]
    set_paragraph_spacing(paragraph, before=0, after=0, line=1.25)
    run = paragraph.add_run(label)
    set_run_font(run, size=10.6, color=RGBColor(122, 90, 0), bold=True)
    run = paragraph.add_run(text)
    set_run_font(run, size=10.6, color=BLACK)
    add_para(doc, "", after=2)
    return table


def add_metadata_rows(doc):
    rows = [
        ("方案类型", "单店阶梯订阅授权"),
        ("适用对象", "单店新店、创业型工作室、首次合作孵化客户"),
        ("定价节奏", "首年基础孵化；次年标准回归，并按需开放会员签课、收银交易等增值模块"),
    ]
    table = doc.add_table(rows=0, cols=2)
    set_table_geometry(table, [1700, 7660])
    set_table_borders(table, color="D6DCE5")
    for label, value in rows:
        row = table.add_row()
        set_cell_text(row.cells[0], label, size=10.2, color=NAVY, bold=True, fill=LIGHT_GRAY, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_text(row.cells[1], value, size=10.2, color=BLACK)
    set_table_geometry(table, [1700, 7660])
    add_para(doc, "", after=4)


def configure_document(doc):
    section = doc.sections[0]
    section.orientation = WD_ORIENTATION.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.header_distance = Cm(0.9)
    section.footer_distance = Cm(0.9)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Heiti SC")
    normal.font.size = Pt(11)
    normal.font.color.rgb = BLACK

    for style_name, size, color in (
        ("Heading 1", 16, BLUE),
        ("Heading 2", 13, BLUE),
        ("Heading 3", 12, DARK_BLUE),
    ):
        style = styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Heiti SC")
        style.font.size = Pt(size)
        style.font.color.rgb = color
        style.font.bold = True

    header = section.header.paragraphs[0]
    header.text = ""
    header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = header.add_run("方案 A｜单店阶梯订阅授权报价方案")
    set_run_font(run, size=8.8, color=GRAY)

    footer = section.footer.paragraphs[0]
    footer.text = ""
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("Infini 团课训练场馆运营系统｜商业授权报价方案")
    set_run_font(run, size=8.8, color=GRAY)


def build_doc():
    doc = Document()
    configure_document(doc)

    add_para(doc, "商业授权报价方案", size=10.5, color=GRAY, bold=True, after=2)
    title = add_para(doc, "方案 A：单店阶梯订阅授权", size=24, color=NAVY, bold=True, after=5, line=1.1)
    title.paragraph_format.keep_with_next = True
    add_para(doc, "首年基础孵化 · 次年功能升级", size=13.5, color=GRAY, bold=True, after=14)
    add_metadata_rows(doc)

    add_heading(doc, "一、基础交付版 · 年度阶梯价", 1)
    add_para(doc, "第一年仅提供本版本，聚焦跑通「课程生产 + 教练控课 + TV 多屏播放」核心闭环。", after=8)
    make_table(
        doc,
        ["版本", "核心功能范围", "第 1 年孵化价", "第 2 年起标准价"],
        [[
            "基础交付版",
            "动作库管理、视频上传、课程编辑器、训练模板、课程包、周排课、教练控课端、TV 多屏同步播放、设备绑定与心跳运维、APK 版本更新、基础技术支持",
            "¥ 3,600 / 月 / 店\n年均 4.32 万元",
            "¥ 4,500 / 月 / 店\n年均 5.4 万元",
        ]],
        [1500, 4500, 1680, 1680],
        body_size=9.3,
        price_cols={2, 3},
    )

    add_heading(doc, "规则说明", 2)
    add_rule_table(
        doc,
        [
            (1, "首年孵化价仅限首家门店享受；第二家及后续新增门店无孵化期，开通即按标准价计费。"),
            (2, "孵化期为系统正式商用上线之日起 12 个月，期满次月自动执行标准价格，无需另行协商。"),
            (3, "第 1 年内暂不开放会员管理、签课签到、收银支付等增值模块，优先保障核心交付链路稳定运行。"),
        ],
    )

    add_heading(doc, "二、第 2 年起可选增值模块", 1)
    add_para(doc, "所有增值模块自第 2 个合作年度起开放申请，可单店开通、可叠加，升级当月按剩余天数折算差价。", after=8)
    make_table(
        doc,
        ["增值模块", "包含功能", "月度加价（单店）", "开通后月费总价"],
        [
            [
                "会员签课模块",
                "会员档案管理、标签分组、到店记录、前台动态二维码签课、课程预约与核销、签到统计看板、教练授课记录统计",
                "+ ¥ 500 / 月",
                "¥ 5,000 / 月",
            ],
            [
                "收银交易模块\n（需先开通会员签课模块）",
                "卡项配置（月卡/季卡/年卡/次卡）、商品售卖（补剂/装备/周边）、微信/支付宝在线支付、订单收支流水、退款核销、卡项余额抵扣、财务统计报表",
                "+ ¥ 800 / 月",
                "¥ 5,800 / 月",
            ],
            [
                "会员 + 收银\n全量开通",
                "上述两个模块全部功能",
                "+ ¥ 1,300 / 月",
                "¥ 5,800 / 月",
            ],
        ],
        [2050, 4260, 1500, 1550],
        body_size=9.1,
        price_cols={2, 3},
    )

    add_heading(doc, "三、连锁门店补充规则", 1)
    add_rule_table(
        doc,
        [
            (1, "第 2 家及以后门店不享受首年孵化价，自开通之日起按对应版本标准价计费。"),
            (2, "当授权门店总数 ≥ 3 家时，加收 ¥ 2,000 / 月总部管理费，包含：多门店统一管理后台、课程包跨店一键同步、总部运营数据看板、多级账号与权限体系。"),
            (3, "增值模块可单店开通，也可全门店统一开通，按实际开通的门店数量计费。"),
        ],
    )

    add_heading(doc, "四、标准合同条款示例", 1)
    add_para(doc, "以下条款可作为正式授权合同或补充协议的商务条款基础，签署前应结合最终合作主体、付款周期、服务边界和知识产权归属进一步审阅。", after=8)
    add_rule_table(
        doc,
        [
            (1, "本系统合作首年仅开放「基础交付版」功能，首家门店享受孵化期价格 ¥3,600/月/店，孵化期为系统正式商用上线之日起 12 个月。"),
            (2, "孵化期满次月起，基础交付版执行标准价格 ¥4,500/月/店；同时乙方开放会员签课、收银交易等增值模块，甲方可按需书面申请开通，费用按对应模块标准叠加计费。"),
            (3, "第二家及后续新增门店不适用首店孵化价，自开通之日起按对应版本标准价计费。"),
            (4, "收银模块涉及的微信支付、支付宝等第三方支付通道手续费由甲方承担，乙方协助对接官方标准费率。"),
            (5, "甲方授权门店数量达到 3 家及以上时，须同时开通总部管理模块并支付总部管理费。"),
        ],
        fill="F8FAFC",
    )

    add_heading(doc, "五、价格合理性说明", 1)
    make_table(
        doc,
        ["说明维度", "论证口径"],
        [
            [
                "对标市场",
                "普通健身 CRM（仅会员 + 约课 + 收银）单店约 600–1200 元/月，但不具备结构化课程脚本、TV 多屏同步控课、离线缓存播放等核心交付能力；本系统核心壁垒在团课现场标准化交付，增值模块仅作为配套能力加价，溢价幅度合理。",
            ],
            [
                "占营收比",
                "以单店月营收 15 万测算，基础版（次年）占比 3%，含全功能占比约 3.9%，处于健身场馆数字化工具投入的正常行业区间。",
            ],
            [
                "节奏匹配",
                "第一年聚焦核心功能跑通、建立信任；第二年功能升级后自然调价，客户抵触感弱，也符合产品迭代与门店成长的双重规律。",
            ],
        ],
        [1550, 7810],
        header_fill=LIGHT_GRAY,
        body_size=9.5,
    )

    add_heading(doc, "六、报价有效期与说明", 1)
    add_rule_table(
        doc,
        [
            (1, "本报价单出具日期为 2026 年 7 月 26 日；报价有效期自出具日次日起 15 个自然日内有效，即至 2026 年 8 月 10 日 24:00 止。"),
            (2, "有效期届满前，如甲方未签署正式合同或支付首期费用，本报价自动失效；乙方有权根据产品版本、服务范围、交付排期及第三方成本重新报价。"),
            (3, "本报价单由乙方负责说明；最终服务内容、功能范围、付款方式、交付安排、知识产权归属和维护边界，以双方签署的正式合同、补充协议或书面确认为准。"),
        ],
        fill="F8FAFC",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build_doc()
