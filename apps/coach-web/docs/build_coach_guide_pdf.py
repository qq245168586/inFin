from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = "INFINI-Coach端使用说明.pdf"


class Pill(Flowable):
    def __init__(self, text, width=38 * mm, height=8 * mm):
        super().__init__()
        self.text = text
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(colors.HexColor("#F2E8FF"))
        self.canv.roundRect(0, 0, self.width, self.height, 4 * mm, fill=1, stroke=0)
        self.canv.setFillColor(colors.HexColor("#7A1DFF"))
        self.canv.setFont("STSong-Light", 8.5)
        self.canv.drawCentredString(self.width / 2, 2.25 * mm, self.text)


class CoverCard(Flowable):
    def __init__(self, width=170 * mm, height=28 * mm):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(colors.HexColor("#171724"))
        self.canv.roundRect(0, 0, self.width, self.height, 6 * mm, fill=1, stroke=0)
        self.canv.setFillColor(colors.white)
        self.canv.setFont("STSong-Light", 13)
        self.canv.drawString(7 * mm, 17 * mm, "核心原则")
        self.canv.setFillColor(colors.HexColor("#D9CCE8"))
        self.canv.setFont("STSong-Light", 10)
        self.canv.drawString(7 * mm, 9 * mm, "现场课中优先使用“课程控制”。屏幕绑定、缓存清理和 TV 更新都收在右上角“设置”里。")


def make_styles():
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleCn",
            parent=base["Title"],
            fontName="STSong-Light",
            fontSize=30,
            leading=36,
            textColor=colors.HexColor("#11111B"),
            alignment=TA_LEFT,
            spaceAfter=10,
        ),
        "subtitle": ParagraphStyle(
            "SubtitleCn",
            parent=base["Normal"],
            fontName="STSong-Light",
            fontSize=12.5,
            leading=20,
            textColor=colors.HexColor("#5B5B6D"),
            spaceAfter=20,
        ),
        "h1": ParagraphStyle(
            "Heading1Cn",
            parent=base["Heading1"],
            fontName="STSong-Light",
            fontSize=19,
            leading=24,
            textColor=colors.HexColor("#11111B"),
            spaceBefore=4,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "Heading2Cn",
            parent=base["Heading2"],
            fontName="STSong-Light",
            fontSize=13,
            leading=18,
            textColor=colors.HexColor("#24113D"),
            spaceBefore=12,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "BodyCn",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=10.5,
            leading=16,
            textColor=colors.HexColor("#242433"),
            spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "SmallCn",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#666678"),
        ),
        "note": ParagraphStyle(
            "NoteCn",
            parent=base["BodyText"],
            fontName="STSong-Light",
            fontSize=10,
            leading=15,
            textColor=colors.HexColor("#32185A"),
            backColor=colors.HexColor("#F7F2FF"),
            borderColor=colors.HexColor("#E3D2FF"),
            borderWidth=0.8,
            borderPadding=8,
            borderRadius=6,
            spaceBefore=8,
            spaceAfter=10,
        ),
    }


def p(text, style):
    return Paragraph(text, style)


def bullets(items, styles):
    return ListFlowable(
        [ListItem(p(item, styles["body"]), leftIndent=6) for item in items],
        bulletType="bullet",
        leftIndent=16,
        bulletFontName="STSong-Light",
        bulletFontSize=9,
    )


def numbers(items, styles):
    return ListFlowable(
        [ListItem(p(item, styles["body"]), leftIndent=6) for item in items],
        bulletType="1",
        leftIndent=18,
        bulletFontName="STSong-Light",
        bulletFontSize=9,
    )


def data_table(headers, rows, col_widths, styles):
    table_data = [[p(item, styles["body"]) for item in headers]]
    table_data.extend([[p(cell, styles["body"]) for cell in row] for row in rows])
    table = Table(table_data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2EDFF")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#261044")),
        ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEADING", (0, 0), (-1, -1), 13),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#E1E1EC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def section_title(text, styles):
    return KeepTogether([p(text, styles["h1"])])


def build_story():
    styles = make_styles()
    story = [
        Spacer(1, 18 * mm),
        Pill("INFINI COACH"),
        Spacer(1, 14 * mm),
        p("Coach 端使用说明", styles["title"]),
        p("面向现场教练的日常操作手册，覆盖登录、课程预览、开始/暂停/结束课程，以及通过设置入口进行屏幕管理。", styles["subtitle"]),
        Spacer(1, 12 * mm),
        CoverCard(),
        Spacer(1, 110 * mm),
        p("版本：2026-05-29 · 适用对象：INFINI Coach Web 现场教练", styles["small"]),
        PageBreak(),
        section_title("1. 登录与主界面", styles),
        numbers([
            "打开 Coach Web 地址，输入教练账号和密码后登录。",
            "登录后右上角会显示当前账号所属健身房名称。开课前请确认名称正确，避免操作到错误场馆。",
            "登录后默认进入“课程控制”。这里是现场教练开课时的主要工作区。",
        ], styles),
        p("如果系统提示登录过期，会自动回到登录页。重新登录后再继续操作。", styles["note"]),
        section_title("2. 课程控制", styles),
        p("课程控制页面展示当天课表。点击一节课程只会展开该课程的操作按钮和预览画面，不会直接影响 TV 播放。", styles["body"]),
        data_table(
            ["操作", "说明"],
            [
                ["点课程卡片", "在 Coach 网页中查看该课程，不会直接发送 TV 指令。"],
                ["预览", "让 TV 进入该课程的 preview 状态，用于正式开课前确认内容。"],
                ["开始", "发送开始课程指令。课程开始后按钮会切换为暂停和结束。"],
                ["暂停 / 继续 / 结束", "课程进行中使用。结束会让 TV 回到课表或待机状态。"],
            ],
            [42 * mm, 125 * mm],
            styles,
        ),
        p("推荐操作流程", styles["h2"]),
        numbers([
            "选择当天要上的课程。",
            "点击“预览”，确认 TV 显示内容正确。",
            "准备开课时点击“开始”。",
            "课程中需要临时停下时点击“暂停”，恢复时点击“继续”。",
            "课程结束后点击“结束”。",
        ], styles),
        p("不要在课程中随意切换到其他课程并点击“开始”。如果当前已有未结束课程，系统会要求确认是否切换。", styles["note"]),
        PageBreak(),
        section_title("3. 预览视频区域", styles),
        p("选中课程后，下方会显示正式组动作预览视频。视频只用于 Coach 网页本地查看，不代表 TV 已经开始上课。", styles["body"]),
        data_table(
            ["操作", "说明"],
            [
                ["左右箭头", "切换当前课程正式组中的动作视频。"],
                ["手机滑动", "在视频区域左右滑动，也可以切换动作。"],
                ["序号显示", "例如“3 / 24”，表示当前正在查看第 3 个动作，共 24 个动作。"],
            ],
            [48 * mm, 119 * mm],
            styles,
        ),
        p("视频下面不再显示小点导航，动作数量多时也不会挤占页面空间。", styles["note"]),
        section_title("4. 设置与屏幕管理", styles),
        p("屏幕管理已经归类到右上角“设置”按钮中。现场教练日常开课一般不需要进入这里，只有绑定屏幕、清缓存或更新 TV 时才使用。", styles["body"]),
        p("进入屏幕管理", styles["h2"]),
        numbers([
            "点击右上角带设置图标的“设置”按钮。",
            "在设置面板中选择“屏幕管理”。",
            "完成设备操作后，再从设置面板切回“课程控制”。",
        ], styles),
        data_table(
            ["功能", "使用场景"],
            [
                ["绑定屏幕", "TV 新安装或重新配对时使用。按 TV 上显示的二维码或配对信息完成绑定。"],
                ["清除缓存", "课程视频缓存异常、TV 播放资源不一致时使用。建议确认 TV 空闲后再执行。"],
                ["更新 TV", "需要把 TV App 更新到指定版本时使用。请确保屏幕在线且没有正在上课。"],
                ["解绑", "设备更换或绑定错屏幕时使用。解绑后 TV 会回到待绑定状态。"],
            ],
            [42 * mm, 125 * mm],
            styles,
        ),
        p("屏幕管理属于设备维护操作。课程进行中尽量不要清缓存、更新 TV 或解绑设备。", styles["note"]),
        PageBreak(),
        section_title("5. 开课前检查清单", styles),
        bullets([
            "确认右上角健身房名称正确。",
            "确认今天课表中有即将开始的课程。",
            "点击课程卡片后，Coach 网页能看到预览视频。",
            "点击“预览”后，TV 显示对应课程内容。",
            "开课前确认所有屏幕在线，且没有错误的未结束课程。",
        ], styles),
        p("常见情况", styles["h2"]),
        data_table(
            ["现象", "处理方式"],
            [
                ["Coach 显示登录过期", "重新登录。系统会自动回到登录页。"],
                ["TV 没有进入预览", "确认已点击课程卡片里的“预览”，并检查屏幕在线状态。"],
                ["课程结束后状态没更新", "先点击刷新；如果仍异常，确认 TV 是否在线并反馈给管理员。"],
                ["视频预览为空", "可能该课程动作没有配置视频资源，请联系课程编辑或管理员检查课程内容。"],
            ],
            [52 * mm, 115 * mm],
            styles,
        ),
        Spacer(1, 8 * mm),
        p("本文档为 Coach 端现场使用说明，不包含管理员后台配置流程。", styles["small"]),
    ]
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("STSong-Light", 8.5)
    canvas.setFillColor(colors.HexColor("#8A8A9A"))
    canvas.drawString(doc.leftMargin, 10 * mm, "INFINI Coach 端使用说明")
    canvas.drawRightString(A4[0] - doc.rightMargin, 10 * mm, str(doc.page))
    canvas.restoreState()


def main():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="INFINI Coach端使用说明",
    )
    doc.build(build_story(), onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    main()
