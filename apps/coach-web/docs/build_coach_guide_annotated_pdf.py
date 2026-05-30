from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Image as PdfImage
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parent
ASSET_DIR = ROOT / "assets"
OUTPUT = ROOT / "INFINI-Coach端使用说明.pdf"
FONT_PATH = "/System/Library/Fonts/Supplemental/Songti.ttc"


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


def rounded(draw, box, fill, outline=None, radius=28, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size=24, fill=(255, 255, 255), anchor=None):
    draw.text(xy, value, font=font(size), fill=fill, anchor=anchor)


def label(draw, number, title, desc, x, y, target):
    accent = (168, 72, 255)
    rounded(draw, (x, y, x + 385, y + 104), (255, 255, 255), (216, 190, 255), 22, 3)
    draw.ellipse((x + 16, y + 18, x + 56, y + 58), fill=accent)
    text(draw, (x + 36, y + 26), str(number), 22, (255, 255, 255), "ma")
    text(draw, (x + 70, y + 18), title, 24, (28, 23, 40))
    text(draw, (x + 70, y + 54), desc, 18, (92, 86, 104))
    start = (x + 16, y + 52) if target[0] < x else (x + 385, y + 52)
    draw.line((start[0], start[1], target[0], target[1]), fill=accent, width=5)
    draw.ellipse((target[0] - 8, target[1] - 8, target[0] + 8, target[1] + 8), fill=accent)


def base_canvas(name):
    ASSET_DIR.mkdir(exist_ok=True)
    img = Image.new("RGB", (1280, 900), (244, 242, 248))
    draw = ImageDraw.Draw(img)
    rounded(draw, (350, 30, 930, 870), (12, 12, 20), (34, 32, 48), 54, 4)
    rounded(draw, (380, 60, 900, 840), (18, 18, 30), (55, 48, 72), 40, 2)
    text(draw, (420, 98), "INFINI", 23, (184, 134, 255))
    text(draw, (420, 128), name, 26, (255, 255, 255))
    return img, draw


def draw_console_image():
    img, draw = base_canvas("Coach Web")
    rounded(draw, (660, 90, 780, 135), (255, 255, 255), radius=20)
    text(draw, (690, 102), "设置", 22, (26, 22, 35))
    rounded(draw, (790, 90, 860, 135), (255, 255, 255), radius=20)
    text(draw, (808, 102), "退出", 22, (26, 22, 35))
    rounded(draw, (410, 170, 870, 250), (28, 27, 42), (61, 55, 82), 28, 2)
    text(draw, (432, 194), "今日课程表", 28)
    rounded(draw, (410, 278, 870, 430), (255, 255, 255), (197, 123, 255), 30, 4)
    rounded(draw, (432, 305, 502, 375), (130, 42, 255), radius=24)
    text(draw, (452, 326), "SW", 24)
    text(draw, (524, 305), "Switch 燃脂课", 30, (24, 21, 34))
    text(draw, (524, 344), "19:00 - 19:45", 22, (100, 96, 112))
    for i, label_text in enumerate(["计划", "预览", "开始"]):
        x = 432 + i * 142
        fill = (250, 248, 255) if label_text != "开始" else (151, 34, 255)
        ink = (39, 32, 52) if label_text != "开始" else (255, 255, 255)
        rounded(draw, (x, 385, x + 122, 426), fill, (206, 186, 226), 18, 2)
        text(draw, (x + 61, 395), label_text, 22, ink, "ma")
    rounded(draw, (410, 460, 870, 755), (5, 5, 11), (56, 48, 70), 34, 2)
    text(draw, (575, 584), "动作预览视频", 32, (208, 198, 224))
    rounded(draw, (424, 586, 468, 630), (255, 255, 255), radius=22)
    text(draw, (442, 589), "‹", 38, (18, 14, 30))
    rounded(draw, (812, 586, 856, 630), (255, 255, 255), radius=22)
    text(draw, (827, 589), "›", 38, (18, 14, 30))
    text(draw, (420, 780), "左右切换动作 · 3 / 24", 22, (215, 204, 232))
    label(draw, 1, "设置", "进入屏幕管理等低频功能", 42, 88, (720, 112))
    label(draw, 2, "课程卡片", "点卡片只展开操作，不直接控制 TV", 42, 295, (640, 332))
    label(draw, 3, "预览/开始", "正式开课常用按钮都在卡片里", 42, 470, (620, 405))
    label(draw, 4, "动作预览", "本地看视频，箭头或滑动切换", 42, 650, (830, 608))
    path = ASSET_DIR / "coach-console-annotated.png"
    img.save(path)
    return path


def draw_running_image():
    img, draw = base_canvas("课程进行中")
    rounded(draw, (410, 190, 870, 350), (255, 255, 255), (197, 123, 255), 30, 4)
    text(draw, (436, 222), "Switch 燃脂课", 32, (24, 21, 34))
    rounded(draw, (705, 218, 842, 263), (231, 255, 242), (96, 210, 143), 22, 2)
    text(draw, (742, 229), "进行中", 22, (33, 131, 75))
    for i, label_text in enumerate(["计划", "暂停", "结束"]):
        x = 432 + i * 142
        fill = (250, 248, 255) if label_text != "暂停" else (151, 34, 255)
        ink = (39, 32, 52) if label_text != "暂停" else (255, 255, 255)
        outline = (255, 145, 145) if label_text == "结束" else (206, 186, 226)
        rounded(draw, (x, 292, x + 122, 336), fill, outline, 18, 2)
        text(draw, (x + 61, 303), label_text, 22, ink, "ma")
    label(draw, 1, "暂停", "临时中断课程，TV 保持同步状态", 42, 250, (635, 314))
    label(draw, 2, "结束", "课程结束后点击，TV 回到课表/待机", 42, 430, (760, 314))
    label(draw, 3, "计划", "把课程计划同步到 TV 查看", 42, 610, (493, 314))
    path = ASSET_DIR / "coach-running-actions-annotated.png"
    img.save(path)
    return path


def draw_settings_image():
    img, draw = base_canvas("设置面板")
    rounded(draw, (520, 138, 890, 575), (17, 17, 27), (86, 76, 108), 32, 3)
    text(draw, (550, 172), "设置", 22, (184, 134, 255))
    text(draw, (550, 205), "教练端管理", 30)
    rounded(draw, (832, 166, 868, 202), (42, 40, 56), radius=18)
    text(draw, (845, 168), "×", 28)
    text(draw, (550, 260), "现场操作", 19, (184, 134, 255))
    rounded(draw, (550, 290, 860, 365), (42, 28, 64), (187, 44, 255), 22, 3)
    text(draw, (610, 306), "课程控制", 25)
    text(draw, (610, 338), "预览、开始、暂停和结束课程", 18, (210, 200, 226))
    text(draw, (550, 405), "设备设置", 19, (184, 134, 255))
    rounded(draw, (550, 435, 860, 510), (29, 28, 42), (78, 70, 98), 22, 3)
    text(draw, (610, 451), "屏幕管理", 25)
    text(draw, (610, 483), "绑定屏幕、清缓存和更新 TV", 18, (210, 200, 226))
    label(draw, 1, "课程控制", "回到现场开课主界面", 50, 242, (705, 328))
    label(draw, 2, "屏幕管理", "设备维护入口，避免误触", 50, 500, (705, 474))
    label(draw, 3, "关闭", "点空白处或 × 关闭设置", 50, 660, (850, 184))
    path = ASSET_DIR / "coach-settings-annotated.png"
    img.save(path)
    return path


def draw_screens_image():
    img, draw = base_canvas("屏幕管理")
    rounded(draw, (410, 175, 870, 260), (32, 30, 44), (66, 58, 86), 26, 2)
    text(draw, (436, 198), "屏幕管理", 30)
    text(draw, (436, 232), "绑定设备、查看在线状态并执行版本更新", 19, (197, 188, 214))
    rounded(draw, (410, 292, 870, 445), (255, 255, 255), (228, 224, 236), 28, 2)
    text(draw, (438, 318), "屏幕 1", 30, (24, 21, 34))
    text(draw, (438, 356), "在线 · 版本 1.0.12", 22, (89, 82, 106))
    for i, label_text in enumerate(["清除缓存", "更新 TV", "解绑"]):
        x = 438 + i * 134
        rounded(draw, (x, 392, x + 116, 432), (250, 248, 255), (206, 186, 226), 18, 2)
        text(draw, (x + 58, 403), label_text, 19, (39, 32, 52), "ma")
    rounded(draw, (410, 485, 870, 620), (255, 255, 255), (228, 224, 236), 28, 2)
    text(draw, (438, 515), "绑定新屏幕", 28, (24, 21, 34))
    rounded(draw, (438, 558, 620, 606), (151, 34, 255), radius=18)
    text(draw, (485, 570), "打开扫码", 21, (255, 255, 255))
    label(draw, 1, "清除缓存", "资源异常时用，课程中不要点", 42, 280, (496, 412))
    label(draw, 2, "更新 TV", "屏幕空闲且在线时更新", 42, 450, (632, 412))
    label(draw, 3, "解绑", "换设备或绑错时使用", 42, 620, (764, 412))
    label(draw, 4, "绑定屏幕", "新 TV 按二维码/配对信息绑定", 42, 735, (530, 582))
    path = ASSET_DIR / "coach-screens-annotated.png"
    img.save(path)
    return path


def styles():
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="STSong-Light", fontSize=29, leading=36, textColor=colors.HexColor("#11111B"), spaceAfter=8),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="STSong-Light", fontSize=20, leading=26, textColor=colors.HexColor("#11111B"), spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="STSong-Light", fontSize=13, leading=18, textColor=colors.HexColor("#2F1554"), spaceBefore=8, spaceAfter=5),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="STSong-Light", fontSize=10.5, leading=16, textColor=colors.HexColor("#242433"), spaceAfter=7),
        "note": ParagraphStyle("note", parent=base["BodyText"], fontName="STSong-Light", fontSize=10.5, leading=16, textColor=colors.HexColor("#32185A"), backColor=colors.HexColor("#F7F2FF"), borderColor=colors.HexColor("#E3D2FF"), borderWidth=0.8, borderPadding=7, spaceBefore=6, spaceAfter=8),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName="STSong-Light", fontSize=9, leading=13, textColor=colors.HexColor("#686878")),
    }


def p(value, style):
    return Paragraph(value, style)


def pdf_img(path):
    return PdfImage(str(path), width=172 * mm, height=121 * mm)


def table(rows, style):
    data = [[p(cell, style["body"]) for cell in row] for row in rows]
    t = Table(data, colWidths=[34 * mm, 133 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2EDFF")),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#E1E1EC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("STSong-Light", 8.5)
    canvas.setFillColor(colors.HexColor("#8A8A9A"))
    canvas.drawString(doc.leftMargin, 10 * mm, "INFINI Coach 端使用说明 · 按钮标注版")
    canvas.drawRightString(A4[0] - doc.rightMargin, 10 * mm, str(doc.page))
    canvas.restoreState()


def build_pdf():
    style = styles()
    images = {
        "console": draw_console_image(),
        "running": draw_running_image(),
        "settings": draw_settings_image(),
        "screens": draw_screens_image(),
    }
    story = [
        Spacer(1, 22 * mm),
        p("Coach 端使用说明", style["title"]),
        p("按钮标注版 · 给现场教练看的操作图册", style["h1"]),
        p("这版说明用页面图片标出关键按钮。现场开课只需要优先使用“课程控制”，屏幕管理已经收进右上角“设置”，避免误触设备维护功能。", style["body"]),
        p("版本：2026-05-29", style["small"]),
        Spacer(1, 12 * mm),
        pdf_img(images["console"]),
        PageBreak(),
        p("1. 课程控制页按钮", style["h1"]),
        pdf_img(images["console"]),
        table([
            ["按钮", "作用"],
            ["设置", "打开设置面板。屏幕管理、课程控制入口都在这里。"],
            ["课程卡片", "只在 Coach 网页展开这节课的详情和按钮，不会直接控制 TV。"],
            ["计划", "把课程计划同步到 TV 查看。"],
            ["预览", "让 TV 进入 preview，正式开课前确认内容。"],
            ["开始", "发送开始课程指令，课程开始后按钮会变成暂停/结束。"],
        ], style),
        PageBreak(),
        p("2. 课程进行中按钮", style["h1"]),
        pdf_img(images["running"]),
        table([
            ["按钮", "作用"],
            ["暂停", "临时暂停课程，恢复时同一位置会显示“继续”。"],
            ["结束", "课程结束后点击。TV 会回到课表或待机状态。"],
            ["计划", "课程中如需查看计划，可以同步到 TV。"],
        ], style),
        p("注意：课程进行中不要随意切换其他课程开始。如果已有未结束课程，系统会弹出确认。", style["note"]),
        PageBreak(),
        p("3. 设置入口", style["h1"]),
        pdf_img(images["settings"]),
        table([
            ["入口", "作用"],
            ["课程控制", "回到现场开课主界面。"],
            ["屏幕管理", "进入设备维护区，用于绑定屏幕、清缓存、更新 TV。"],
            ["关闭", "点 × 或空白处关闭设置面板。"],
        ], style),
        PageBreak(),
        p("4. 屏幕管理按钮", style["h1"]),
        pdf_img(images["screens"]),
        table([
            ["按钮", "作用"],
            ["清除缓存", "视频资源异常时使用。课程进行中不要点。"],
            ["更新 TV", "屏幕在线且空闲时，把 TV App 更新到指定版本。"],
            ["解绑", "设备更换或绑定错屏幕时使用。解绑后 TV 回到待绑定状态。"],
            ["打开扫码", "绑定新屏幕时使用，按 TV 上的二维码或配对信息完成绑定。"],
        ], style),
        PageBreak(),
        p("5. 开课前检查", style["h1"]),
        table([
            ["检查项", "确认内容"],
            ["健身房", "右上角显示的健身房名称正确。"],
            ["课表", "今天课表里有即将开始的课程。"],
            ["预览", "点击课程卡片后，Coach 网页能看到动作预览。"],
            ["TV", "点击“预览”后，TV 显示对应课程内容。"],
            ["结束", "课程结束后点击“结束”，不要让旧课程一直处于进行中。"],
        ], style),
        p("现场课中优先停留在课程控制页。屏幕管理属于设备维护，只有需要绑定、清缓存、更新或解绑时才进入。", style["note"]),
    ]
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=16 * mm, bottomMargin=18 * mm)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build_pdf()
