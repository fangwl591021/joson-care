from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "rich-menu"
WIDTH, HEIGHT = 2500, 1686
FONT_PATH = Path(r"C:\Windows\Fonts\NotoSansTC-VF.ttf")


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_PATH), size=size, index=0)


def fit_background(path):
    return ImageOps.fit(Image.open(path).convert("RGB"), (WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def centered(draw, box, text, size, color="#173E36", spacing=6):
    left, top, right, bottom = box
    f = font(size)
    bounds = draw.multiline_textbbox((0, 0), text, font=f, spacing=spacing, align="center")
    x = (left + right - (bounds[2] - bounds[0])) / 2
    y = (top + bottom - (bounds[3] - bounds[1])) / 2
    draw.multiline_text((x, y), text, font=f, fill=color, spacing=spacing, align="center", stroke_width=1)


def panel(draw, box, fill="#FFFCF7E8", outline="#FFFFFF", radius=34, width=4):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def tabs(draw, active):
    panel(draw, (18, 16, 1237, 226), "#F2E5E9F5" if active == "main" else "#F9F6F0EC", "#B8788D", 46, 5)
    panel(draw, (1263, 16, 2482, 226), "#E5EEF9F5" if active == "knowledge" else "#F9F6F0EC", "#7395BA", 46, 5)
    centered(draw, (18, 16, 1237, 226), "智慧服務", 72, "#684B54" if active == "main" else "#5F6D68")
    centered(draw, (1263, 16, 2482, 226), "照護知識", 72, "#526B87" if active == "knowledge" else "#5F6D68")


def draw_arrow(draw, x, y, color):
    draw.line((x - 42, y, x + 35, y), fill=color, width=12)
    draw.line((x + 10, y - 27, x + 38, y), fill=color, width=12)
    draw.line((x + 10, y + 27, x + 38, y), fill=color, width=12)


def render_main():
    image = fit_background(ASSET_DIR / "joson-care-main-v3-background.png")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    tabs(draw, "main")
    panel(draw, (36, 270, 955, 1642), "#FFFDF7D9", "#FFFFFF", 38, 5)
    draw.text((88, 328), "JOSON CARE", font=font(38), fill="#2B6B5A")
    draw.multiline_text((84, 410), "智慧照護\n顧問", font=font(112), fill="#153F36", spacing=4, stroke_width=1)
    draw.multiline_text((88, 670), "從生活需求開始\n陪你找到安心選擇", font=font(44), fill="#395D54", spacing=14)
    draw.rounded_rectangle((85, 875, 610, 1005), radius=64, fill="#1D6755")
    draw.text((150, 906), "開始諮詢", font=font(52), fill="white")
    draw_arrow(draw, 545, 941, "white")

    panel(draw, (995, 270, 2465, 755), "#FFFCF4D8", "#FFFFFF", 36, 5)
    draw.text((1047, 314), "全系列產品", font=font(72), fill="#163F36")
    draw.text((1052, 407), "85 款產品快速瀏覽・不必等待原網站", font=font(34), fill="#587169")
    draw.rounded_rectangle((1050, 575, 1455, 682), radius=52, fill="#E4EFEA")
    centered(draw, (1050, 575, 1455, 682), "查看產品", 38, "#1A5A49")

    socials = [(1015, 780, 1475, "f", "Facebook", "#E7F0FF", "#2476D8"), (1490, 780, 1995, "▶", "YouTube", "#FFF0F0", "#C9362A"), (2010, 780, 2465, "in", "LinkedIn", "#EAF4FA", "#2371A5")]
    for left, top, right, mark, label, fill, color in socials:
        panel(draw, (left, top, right, 945), fill + "F2", color, 28, 4)
        draw.ellipse((left + 25, top + 34, left + 120, top + 129), fill=color)
        centered(draw, (left + 25, top + 34, left + 120, top + 129), mark, 34 if mark == "in" else 46, "white")
        centered(draw, (left + 120, top + 15, right - 12, 945), label, 37, "#173E36")

    cards = [
        (995, 975, 1360, "床型\n比較", "依需求篩選", "#E9F3EF", "#245E50"),
        (1368, 975, 1733, "產品使用\n／教學", "影片優先", "#E8F0F9", "#315E89"),
        (1741, 975, 2106, "售後\n服務", "保固・維修", "#F8F0E6", "#875B2F"),
        (2114, 975, 2479, "專人\n諮詢", "留下需求", "#F7EDEE", "#824858"),
    ]
    for left, top, right, title, sub, fill, color in cards:
        panel(draw, (left, top, right, 1642), fill + "F4", "#FFFFFF", 28, 4)
        centered(draw, (left + 18, top + 80, right - 18, top + 370), title, 53, color, 2)
        centered(draw, (left + 15, top + 400, right - 15, top + 520), sub, 28, color)
        draw.rounded_rectangle((left + 105, 1572, right - 105, 1588), radius=8, fill=color)
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    save(image, ASSET_DIR / "joson-care-main-v3.png")


def render_knowledge():
    image = fit_background(ASSET_DIR / "joson-care-knowledge-v3-background.png")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    tabs(draw, "knowledge")
    panel(draw, (38, 270, 930, 1642), "#FFFDF7D5", "#FFFFFF", 38, 5)
    draw.text((92, 326), "JOSON CARE GUIDE", font=font(35), fill="#477365")
    draw.multiline_text((86, 410), "照護知識\n專區", font=font(103), fill="#173E36", spacing=5, stroke_width=1)
    draw.multiline_text((90, 660), "從居家安全到床邊照護\n把重要資訊整理給你", font=font(40), fill="#405F57", spacing=14)
    draw.rounded_rectangle((88, 900, 610, 1027), radius=62, fill="#1D6755")
    draw.text((150, 930), "查看全部", font=font(49), fill="white")
    draw_arrow(draw, 545, 963, "white")

    cards = [
        (965, 270, 1705, 665, "防跌與\n居家安全", "動線・照明・床邊高度", "#E9F3EF", "#265F51"),
        (1725, 270, 2465, 665, "中風／\n長期臥床", "移位・翻身・照護空間", "#E8F0F9", "#315E89"),
        (965, 685, 1705, 1080, "失智症\n居家照護", "熟悉環境・夜間動線", "#F8F0E6", "#875B2F"),
        (1725, 685, 2465, 1080, "照護床操作\n與保養", "日常檢查・異常報修", "#F7EDEE", "#824858"),
    ]
    for left, top, right, bottom, title, sub, fill, color in cards:
        panel(draw, (left, top, right, bottom), fill + "F2", "#FFFFFF", 30, 4)
        centered(draw, (left + 32, top + 35, right - 32, top + 245), title, 54, color, 2)
        centered(draw, (left + 26, top + 255, right - 26, bottom - 24), sub, 29, color)
    panel(draw, (965, 1100, 2465, 1642), "#FFF8E8F2", "#D8B56D", 34, 5)
    draw.text((1030, 1160), "長照輔具／醫療床補助", font=font(67), fill="#695229")
    draw.text((1035, 1260), "申請流程・評估・特約單位", font=font(35), fill="#806B42")
    draw.text((1035, 1375), "先評估，再購置或租賃", font=font(45), fill="#60491E")
    draw.rounded_rectangle((1970, 1395, 2375, 1525), radius=64, fill="#80652E")
    centered(draw, (1970, 1395, 2375, 1525), "了解補助", 42, "white")
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    save(image, ASSET_DIR / "joson-care-knowledge-v3.png")


def save(image, path):
    image.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True, compress_level=9)
    size = path.stat().st_size
    if size > 1_000_000:
        image.quantize(colors=128, method=Image.Quantize.MEDIANCUT).save(path, optimize=True, compress_level=9)
        size = path.stat().st_size
    if size > 1_000_000:
        raise RuntimeError(f"Rich Menu image is too large: {path} {size} bytes")
    print(f"Rendered {path.name}: {WIDTH}x{HEIGHT}, {size} bytes")


if __name__ == "__main__":
    render_main()
    render_knowledge()
