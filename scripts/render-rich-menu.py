from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PRODUCT_DIR = ROOT / "public" / "assets" / "products"
OUTPUT_DIR = ROOT / "public" / "assets" / "rich-menu"
OUTPUT_PATH = OUTPUT_DIR / "joson-care-custom-v1.png"
WIDTH, HEIGHT = 2500, 1686
SPLIT_X, FEATURED_BOTTOM = 1030, 970
FONT_PATH = Path(r"C:\Windows\Fonts\NotoSansTC-VF.ttf")


def font(size: int):
    return ImageFont.truetype(str(FONT_PATH), size=size)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def fit_product(path: Path, size):
    source = Image.open(path).convert("RGB")
    fitted = ImageOps.contain(source, size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "white")
    canvas.paste(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    return canvas


def centered_text(draw, box, text, text_font, fill, spacing=10):
    left, top, right, bottom = box
    bounds = draw.multiline_textbbox((0, 0), text, font=text_font, spacing=spacing, align="center")
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    draw.multiline_text(((left + right - width) / 2, (top + bottom - height) / 2), text, font=text_font, fill=fill, spacing=spacing, align="center")


def draw_bed_icon(draw, origin, scale=1.0, color="#D6F2E9"):
    x, y = origin
    w = int(590 * scale)
    line = max(8, int(17 * scale))
    draw.rounded_rectangle((x, y + int(125 * scale), x + w, y + int(300 * scale)), radius=int(35 * scale), outline=color, width=line)
    draw.rounded_rectangle((x + int(35 * scale), y + int(55 * scale), x + int(225 * scale), y + int(150 * scale)), radius=int(30 * scale), outline=color, width=line)
    draw.line((x + int(20 * scale), y + int(300 * scale), x + int(20 * scale), y + int(385 * scale)), fill=color, width=line)
    draw.line((x + w - int(20 * scale), y + int(300 * scale), x + w - int(20 * scale), y + int(385 * scale)), fill=color, width=line)
    draw.ellipse((x + int(95 * scale), y + int(365 * scale), x + int(135 * scale), y + int(405 * scale)), outline=color, width=max(5, line // 2))
    draw.ellipse((x + w - int(135 * scale), y + int(365 * scale), x + w - int(95 * scale), y + int(405 * scale)), outline=color, width=max(5, line // 2))


def draw_tile_icon(draw, center, kind, color):
    cx, cy = center
    line = 13
    if kind == "catalog":
        for row in range(2):
            for col in range(2):
                x = cx - 72 + col * 82
                y = cy - 72 + row * 82
                draw.rounded_rectangle((x, y, x + 62, y + 62), radius=12, outline=color, width=line)
    elif kind == "compare":
        draw.line((cx - 86, cy - 38, cx + 66, cy - 38), fill=color, width=line)
        draw.polygon([(cx + 66, cy - 70), (cx + 105, cy - 38), (cx + 66, cy - 6)], fill=color)
        draw.line((cx + 86, cy + 45, cx - 66, cy + 45), fill=color, width=line)
        draw.polygon([(cx - 66, cy + 13), (cx - 105, cy + 45), (cx - 66, cy + 77)], fill=color)
    elif kind == "service":
        draw.ellipse((cx - 77, cy - 77, cx + 77, cy + 77), outline=color, width=line)
        draw.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), outline=color, width=line)
        for dx, dy in ((0, -108), (0, 108), (-108, 0), (108, 0)):
            draw.line((cx + dx * .68, cy + dy * .68, cx + dx, cy + dy), fill=color, width=line)
    elif kind == "contact":
        draw.rounded_rectangle((cx - 105, cy - 78, cx + 105, cy + 62), radius=35, outline=color, width=line)
        draw.polygon([(cx - 36, cy + 58), (cx - 72, cy + 108), (cx + 5, cy + 62)], fill=color)
        for dx in (-48, 0, 48):
            draw.ellipse((cx + dx - 9, cy - 15, cx + dx + 9, cy + 3), fill=color)


def render():
    image = Image.new("RGB", (WIDTH, HEIGHT), "#F3F7F5")
    draw = ImageDraw.Draw(image)

    # Asymmetric primary action area.
    for y in range(HEIGHT):
        ratio = y / max(HEIGHT - 1, 1)
        start = (13, 67, 57)
        end = (25, 113, 91)
        color = tuple(round(start[i] * (1 - ratio) + end[i] * ratio) for i in range(3))
        draw.line((0, y, SPLIT_X, y), fill=color)
    draw.ellipse((-480, 1040, 930, 2450), fill="#1F8068")
    draw.ellipse((-310, 1185, 655, 2150), outline="#67B49E", width=8)
    draw.text((84, 78), "JOSON CARE", font=font(51), fill="#A9D9CA")
    draw.text((84, 180), "智慧選床\n顧問", font=font(148), fill="white", spacing=12)
    draw.text((89, 535), "從生活需求開始\n快速找到合適方向", font=font(60), fill="#D7EEE7", spacing=17)
    draw.rounded_rectangle((82, 760, 615, 888), radius=64, fill="#F5C66A")
    draw.text((150, 790), "開始選床  →", font=font(56), fill="#174A3F")
    draw_bed_icon(draw, (112, 1080), scale=1.22)
    draw.text((83, 1583), "點選開始｜不需要先知道型號", font=font(35), fill="#C5E4DB")

    # Featured product story area.
    draw.rounded_rectangle((1062, 34, 2466, 936), radius=44, fill="#FFFDFC", outline="#DCE8E4", width=5)
    draw.text((1120, 84), "居家照護精選", font=font(74), fill="#183F36")
    draw.text((1123, 178), "四款熱門床型，一次快速比較", font=font(37), fill="#668078")
    products = [
        ("es-18uds.jpg", "ES-18UDS", "超低床"),
        ("en-3m.jpg", "EN-3M", "折疊收納"),
        ("es-05hds.jpg", "ES-05HDS", "四片護欄"),
        ("es-12df.jpg", "ES-12DF", "完整操作"),
    ]
    card_w, card_h = 630, 280
    positions = [(1120, 275), (1780, 275), (1120, 585), (1780, 585)]
    for (filename, model, feature), (x, y) in zip(products, positions):
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=30, fill="#F4F8F6", outline="#DFEAE6", width=3)
        product = fit_product(PRODUCT_DIR / filename, (330, 190))
        image.paste(product, (x + 18, y + 18), rounded_mask(product.size, 22))
        draw.text((x + 372, y + 55), model, font=font(37), fill="#174E41")
        draw.text((x + 372, y + 123), feature, font=font(32), fill="#6A7F79")
        draw.rounded_rectangle((x + 372, y + 185, x + 575, y + 236), radius=25, fill="#DDEDE8")
        centered_text(draw, (x + 372, y + 185, x + 575, y + 236), "查看推薦", font(25), "#1C6552")

    # Four smaller service entries, intentionally not a uniform six-grid.
    tiles = [
        (1030, 1413, "全系列\n產品", "85 款型錄", "catalog", "#E8F2EF", "#174F43"),
        (1413, 1775, "床型\n比較", "依功能篩選", "compare", "#EAF0F8", "#274E78"),
        (1775, 2138, "售後\n服務", "保固・操作・維修", "service", "#F8F1E6", "#805B28"),
        (2138, 2500, "專人\n諮詢", "留下需求", "contact", "#F4EDEF", "#7B4050"),
    ]
    for left, right, label, subtitle, kind, background, foreground in tiles:
        draw.rectangle((left, FEATURED_BOTTOM, right, HEIGHT), fill=background)
        draw.line((left, FEATURED_BOTTOM, left, HEIGHT), fill="#FFFFFF", width=7)
        draw_tile_icon(draw, ((left + right) // 2, 1135), kind, foreground)
        centered_text(draw, (left + 12, 1265, right - 12, 1485), label, font(59), foreground, spacing=0)
        centered_text(draw, (left + 12, 1490, right - 12, 1605), subtitle, font(25), foreground)
        draw.rounded_rectangle((left + 130, 1625, right - 130, 1638), radius=7, fill=foreground)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_PATH, format="PNG", optimize=True, compress_level=9)
    if OUTPUT_PATH.stat().st_size > 1_000_000:
        quantized = image.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        quantized.save(OUTPUT_PATH, format="PNG", optimize=True, compress_level=9)
    size = OUTPUT_PATH.stat().st_size
    if size > 1_000_000:
        raise RuntimeError(f"Rich Menu image is too large: {size} bytes")
    print(f"Rendered {OUTPUT_PATH} ({WIDTH}x{HEIGHT}, {size} bytes)")


if __name__ == "__main__":
    render()
