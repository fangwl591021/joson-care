from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "rich-menu"
WIDTH, HEIGHT = 2500, 1686
FONT_REGULAR_PATH = Path(r"C:\Windows\Fonts\msjh.ttc")
FONT_BOLD_PATH = Path(r"C:\Windows\Fonts\msjhbd.ttc")


def font(size, bold=True):
    path = FONT_BOLD_PATH if bold else FONT_REGULAR_PATH
    return ImageFont.truetype(str(path), size=size, index=0)


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
    centered(draw, (18, 16, 1237, 226), "智慧服務", 84, "#684B54" if active == "main" else "#40544F")
    centered(draw, (1263, 16, 2482, 226), "照護知識", 84, "#526B87" if active == "knowledge" else "#40544F")


def draw_arrow(draw, x, y, color):
    draw.line((x - 42, y, x + 35, y), fill=color, width=12)
    draw.line((x + 10, y - 27, x + 38, y), fill=color, width=12)
    draw.line((x + 10, y + 27, x + 38, y), fill=color, width=12)


def render_main():
    image = fit_background(ASSET_DIR / "joson-care-main-v3-background.png")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    tabs(draw, "main")
    draw.text((52, 250), "智慧照護顧問", font=font(76), fill="#123D34", stroke_width=3, stroke_fill="#FFFDF6")

    draw.text((1015, 285), "全系列產品", font=font(92), fill="#123D34", stroke_width=3, stroke_fill="#FFFDF6")
    draw.text((1022, 405), "85 款快速瀏覽", font=font(52), fill="#284F45", stroke_width=2, stroke_fill="#FFFDF6")
    draw.rounded_rectangle((1020, 545, 1490, 685), radius=68, fill="#17624F")
    centered(draw, (1020, 545, 1490, 685), "查看產品", 49, "white")

    socials = [(1015, 780, 1475, "f", "Facebook", "#E7F0FF", "#2476D8"), (1490, 780, 1995, "▶", "YouTube", "#FFF0F0", "#C9362A"), (2010, 780, 2465, "in", "LinkedIn", "#EAF4FA", "#2371A5")]
    for left, top, right, mark, label, fill, color in socials:
        panel(draw, (left, top, right, 945), fill + "F2", color, 28, 4)
        draw.ellipse((left + 25, top + 34, left + 120, top + 129), fill=color)
        centered(draw, (left + 25, top + 34, left + 120, top + 129), mark, 34 if mark == "in" else 46, "white")
        centered(draw, (left + 120, top + 15, right - 12, 945), label, 46, "#173E36")

    cards = [
        (995, 975, 1360, "床型\n比較", "依需求篩選", "#E9F3EF", "#245E50"),
        (1368, 975, 1733, "產品使用\n／教學", "影片優先", "#E8F0F9", "#315E89"),
        (1741, 975, 2106, "售後\n服務", "保固・維修", "#F8F0E6", "#875B2F"),
        (2114, 975, 2479, "專人\n諮詢", "留下需求", "#F7EDEE", "#824858"),
    ]
    for left, top, right, title, sub, fill, color in cards:
        panel(draw, (left, top, right, 1642), fill + "F4", "#FFFFFF", 28, 4)
        centered(draw, (left + 18, top + 72, right - 18, top + 390), title, 62, color, 2)
        centered(draw, (left + 12, top + 410, right - 12, top + 555), sub, 40, color)
        draw.rounded_rectangle((left + 105, 1572, right - 105, 1588), radius=8, fill=color)
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    save(image, ASSET_DIR / "joson-care-main-v4.png")


def render_knowledge():
    image = fit_background(ASSET_DIR / "joson-care-knowledge-v3-background.png")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    tabs(draw, "knowledge")
    draw.text((52, 250), "照護知識專區", font=font(76), fill="#123D34", stroke_width=3, stroke_fill="#FFFDF6")

    cards = [
        (965, 245, 1450, 710, "防跌與\n居家安全", "動線・照明・床高", "#E9F3EF", "#265F51"),
        (1470, 245, 1955, 710, "中風／\n長期臥床", "移位・翻身・空間", "#E8F0F9", "#315E89"),
        (1980, 245, 2465, 710, "失智症\n居家照護", "熟悉環境・夜間動線", "#F8F0E6", "#875B2F"),
    ]
    for left, top, right, bottom, title, sub, fill, color in cards:
        centered(draw, (left + 20, top + 40, right - 20, top + 275), title, 58, color, 2)
        centered(draw, (left + 12, top + 290, right - 12, bottom - 25), sub, 40, color)
    draw.multiline_text((1020, 790), "照護床操作\n與保養", font=font(82), fill="#6F3F3F", spacing=0, stroke_width=3, stroke_fill="#FFFDF6")
    draw.text((1028, 1015), "日常檢查・異常報修", font=font(45), fill="#704747", stroke_width=2, stroke_fill="#FFFDF6")
    draw.text((1010, 1315), "長照輔具／醫療床補助", font=font(78), fill="#664E22", stroke_width=2, stroke_fill="#FFFDF6")
    draw.text((1018, 1430), "先評估，再購置或租賃", font=font(52), fill="#5D471C", stroke_width=2, stroke_fill="#FFFDF6")
    draw.rounded_rectangle((1970, 1430, 2375, 1560), radius=64, fill="#80652E")
    centered(draw, (1970, 1430, 2375, 1560), "了解補助", 42, "white")
    image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    save(image, ASSET_DIR / "joson-care-knowledge-v4.png")


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
