from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "assets" / "characters" / "featured"

CHARACTERS = {
    "kuroba-hayato": {
        "hair": "#17191F",
        "accent": "#F17819",
        "eyes": "#D98A35",
        "jersey": "#15181E",
        "secondary": "#F4F4F2",
        "number": 10,
    },
    "seto-soma": {
        "hair": "#101A30",
        "accent": "#3C79A8",
        "eyes": "#79C7E8",
        "jersey": "#16618D",
        "secondary": "#F4F8FB",
        "number": 7,
    },
    "higami-ren": {
        "hair": "#681E2C",
        "accent": "#C44A57",
        "eyes": "#A63D32",
        "jersey": "#A72F3E",
        "secondary": "#FFF1EC",
        "number": 1,
    },
    "shiroma-minato": {
        "hair": "#DDE8F0",
        "accent": "#8FC5DE",
        "eyes": "#65B5DB",
        "jersey": "#E8F3F7",
        "secondary": "#2D6687",
        "number": 13,
    },
}

SKIN = "#F1C3A2"
SKIN_SHADOW = "#D8997C"
INK = "#17212B"


def polygon(draw: ImageDraw.ImageDraw, points, fill, outline=INK, width=5):
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def draw_hair(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, config):
    spikes = [
        (-94, 15), (-82, -42), (-52, -30), (-34, -82), (-7, -45),
        (16, -92), (35, -43), (72, -74), (70, -22), (99, -31),
        (86, 24), (56, 8), (42, 55), (15, 28), (-12, 58),
        (-38, 25), (-68, 48),
    ]
    pts = [(cx + int(x * scale), cy + int(y * scale)) for x, y in spikes]
    polygon(draw, pts, config["hair"], width=max(2, int(5 * scale)))
    accent = [
        (cx - int(55 * scale), cy - int(25 * scale)),
        (cx - int(10 * scale), cy - int(58 * scale)),
        (cx + int(22 * scale), cy - int(42 * scale)),
        (cx - int(2 * scale), cy - int(12 * scale)),
    ]
    draw.polygon(accent, fill=config["accent"])


def draw_face(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, config, expression: str):
    box = [
        cx - int(72 * scale), cy - int(74 * scale),
        cx + int(72 * scale), cy + int(88 * scale),
    ]
    draw.ellipse(box, fill=SKIN, outline=INK, width=max(2, int(5 * scale)))
    draw.pieslice(box, start=300, end=60, fill=SKIN_SHADOW)
    eye_y = cy + int(2 * scale)
    eye_dx = int(34 * scale)
    eye_w = int(18 * scale)
    eye_h = int((6 if expression == "focused" else 12) * scale)
    for direction in (-1, 1):
        ex = cx + direction * eye_dx
        draw.ellipse(
            [ex - eye_w, eye_y - eye_h, ex + eye_w, eye_y + eye_h],
            fill="#FFFFFF",
            outline=INK,
            width=max(2, int(3 * scale)),
        )
        draw.ellipse(
            [ex - int(7 * scale), eye_y - int(8 * scale), ex + int(7 * scale), eye_y + int(8 * scale)],
            fill=config["eyes"],
        )
        draw.ellipse(
            [ex - int(2 * scale), eye_y - int(4 * scale), ex + int(3 * scale), eye_y + int(4 * scale)],
            fill=INK,
        )
    brow_y = cy - int(26 * scale)
    if expression in {"focused", "frustrated"}:
        draw.line([cx - int(55 * scale), brow_y + int(10 * scale), cx - int(18 * scale), brow_y], fill=INK, width=max(2, int(6 * scale)))
        draw.line([cx + int(18 * scale), brow_y, cx + int(55 * scale), brow_y + int(10 * scale)], fill=INK, width=max(2, int(6 * scale)))
    else:
        draw.line([cx - int(55 * scale), brow_y, cx - int(18 * scale), brow_y - int(4 * scale)], fill=INK, width=max(2, int(5 * scale)))
        draw.line([cx + int(18 * scale), brow_y - int(4 * scale), cx + int(55 * scale), brow_y], fill=INK, width=max(2, int(5 * scale)))
    mouth_y = cy + int(55 * scale)
    if expression == "happy":
        draw.arc([cx - int(28 * scale), mouth_y - int(14 * scale), cx + int(28 * scale), mouth_y + int(18 * scale)], 10, 170, fill="#8D463E", width=max(2, int(5 * scale)))
    elif expression == "frustrated":
        draw.line([cx - int(25 * scale), mouth_y + int(8 * scale), cx + int(25 * scale), mouth_y - int(4 * scale)], fill="#8D463E", width=max(2, int(5 * scale)))
    else:
        draw.line([cx - int(24 * scale), mouth_y, cx + int(24 * scale), mouth_y], fill="#8D463E", width=max(2, int(4 * scale)))
    draw_hair(draw, cx, cy - int(58 * scale), scale, config)


def draw_body(draw: ImageDraw.ImageDraw, cx: int, top: int, scale: float, config, chibi: bool = False):
    shoulder = int((120 if chibi else 145) * scale)
    torso_h = int((170 if chibi else 270) * scale)
    neck_w = int(30 * scale)
    draw.rectangle([cx - neck_w, top - int(20 * scale), cx + neck_w, top + int(45 * scale)], fill=SKIN, outline=INK, width=max(2, int(4 * scale)))
    polygon(
        draw,
        [
            (cx - shoulder, top + int(20 * scale)),
            (cx - int(92 * scale), top + torso_h),
            (cx + int(92 * scale), top + torso_h),
            (cx + shoulder, top + int(20 * scale)),
        ],
        config["jersey"],
        width=max(2, int(6 * scale)),
    )
    draw.polygon(
        [
            (cx, top + int(25 * scale)),
            (cx + shoulder, top + int(20 * scale)),
            (cx + int(92 * scale), top + torso_h),
            (cx, top + torso_h),
        ],
        fill=config["accent"],
    )
    draw.ellipse(
        [cx - int(32 * scale), top + int(82 * scale), cx + int(32 * scale), top + int(146 * scale)],
        fill=config["secondary"],
        outline=INK,
        width=max(2, int(3 * scale)),
    )
    number = str(config["number"])
    draw.text((cx, top + int(112 * scale)), number, anchor="mm", fill=INK, stroke_width=max(1, int(2 * scale)), stroke_fill=config["secondary"])


def create_full(config):
    image = Image.new("RGBA", (512, 768), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_body(draw, 256, 330, 1.0, config)
    draw_face(draw, 256, 235, 1.0, config, "neutral")
    polygon(draw, [(120, 385), (55, 635), (125, 660), (210, 420)], config["jersey"], width=6)
    polygon(draw, [(392, 385), (457, 635), (387, 660), (302, 420)], config["accent"], width=6)
    draw.ellipse([40, 615, 125, 700], fill=SKIN, outline=INK, width=5)
    draw.ellipse([387, 615, 472, 700], fill=SKIN, outline=INK, width=5)
    return image


def create_bust(config, expression="neutral"):
    image = Image.new("RGBA", (512, 682), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_body(draw, 256, 330, 1.0, config)
    draw_face(draw, 256, 235, 1.0, config, expression)
    return image


def create_chibi(config):
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_body(draw, 256, 285, 0.78, config, chibi=True)
    draw_face(draw, 256, 195, 1.18, config, "happy")
    return image


def create_expression(config, expression):
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_face(draw, 256, 255, 1.42, config, expression)
    return image


def save(image: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=88, method=6, exact=True)


def main():
    for character_id, config in CHARACTERS.items():
        directory = OUTPUT / character_id
        save(create_bust(config), directory / "bust-neutral.webp")
        save(create_full(config), directory / "full-neutral.webp")
        save(create_chibi(config), directory / "chibi-neutral.webp")
        for expression in ["neutral", "focused", "happy", "frustrated"]:
            save(
                create_expression(config, expression),
                directory / f"expression-{expression}.webp",
            )


if __name__ == "__main__":
    main()
