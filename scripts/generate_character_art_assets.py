from __future__ import annotations

from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts/art-source/character-setting-sheet.webp"
FEATURED_ROOT = ROOT / "src/assets/characters/featured"
ATLAS_PATH = ROOT / "src/assets/player-parts/v1/all-parts-atlas.webp"

FULL_BOXES = {
    "kuroba-hayato": (185, 70, 375, 890),
    "seto-soma": (500, 70, 745, 900),
    "higami-ren": (825, 70, 1095, 900),
    "shiroma-minato": (1190, 165, 1491, 910),
}
CHIBI_BOXES = {
    "kuroba-hayato": (10, 430, 150, 670),
    "seto-soma": (385, 430, 525, 670),
    "higami-ren": (745, 430, 885, 670),
    "shiroma-minato": (1115, 430, 1260, 670),
}
EXPRESSION_BOXES = {
    ("kuroba-hayato", "neutral"): (20, 690, 160, 755),
    ("kuroba-hayato", "focused"): (20, 758, 160, 825),
    ("kuroba-hayato", "happy"): (20, 828, 160, 900),
    ("seto-soma", "neutral"): (395, 690, 535, 755),
    ("seto-soma", "focused"): (395, 758, 535, 825),
    ("seto-soma", "happy"): (395, 828, 535, 900),
    ("higami-ren", "neutral"): (760, 690, 900, 755),
    ("higami-ren", "focused"): (760, 758, 900, 825),
    ("higami-ren", "happy"): (760, 828, 900, 900),
    ("shiroma-minato", "neutral"): (1120, 690, 1260, 755),
    ("shiroma-minato", "focused"): (1120, 758, 1260, 825),
    ("shiroma-minato", "happy"): (1120, 828, 1260, 900),
}

TILE_W, TILE_H = 256, 384
ATLAS_W, ATLAS_H = 2048, 6528
ATLAS_COLUMNS = 8


def remove_white_background(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3]
    height, width = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    candidate = (hsv[:, :, 2] > 215) & (hsv[:, :, 1] < 48)
    background = np.zeros((height, width), np.uint8)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if candidate[y, x] and not background[y, x]:
                background[y, x] = 1
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if candidate[y, x] and not background[y, x]:
                background[y, x] = 1
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dx or dy):
                    continue
                ny, nx = y + dy, x + dx
                if (
                    0 <= ny < height
                    and 0 <= nx < width
                    and candidate[ny, nx]
                    and not background[ny, nx]
                ):
                    background[ny, nx] = 1
                    queue.append((ny, nx))
    alpha = np.where(background, 0, 255).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (alpha > 0).astype(np.uint8), 8
    )
    if count > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        alpha = np.where(labels == largest, 255, 0).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    rgba[:, :, 3] = alpha
    result = Image.fromarray(rgba)
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


def extract_full_character(sheet: Image.Image, character_id: str) -> Image.Image:
    crop = sheet.crop(FULL_BOXES[character_id]).convert("RGB")
    rgb = np.array(crop)
    height, width = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    mask = np.full((height, width), cv2.GC_PR_BGD, np.uint8)
    mask[:5, :] = cv2.GC_BGD
    mask[-5:, :] = cv2.GC_BGD
    mask[:, :5] = cv2.GC_BGD
    mask[:, -5:] = cv2.GC_BGD
    near_white = (hsv[:, :, 2] > 225) & (hsv[:, :, 1] < 35)
    mask[near_white] = cv2.GC_PR_BGD
    r, g, b = [rgb[:, :, index].astype(np.int16) for index in range(3)]
    skin = (r > 120) & (g > 60) & (b > 40) & (r > g) & ((r - b) > 18)
    strong = (hsv[:, :, 1] > 55) | (hsv[:, :, 2] < 175) | skin
    mask[strong] = cv2.GC_PR_FGD
    mask[(hsv[:, :, 1] > 105) & (hsv[:, :, 2] < 225)] = cv2.GC_FGD
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        rgb,
        mask,
        None,
        background_model,
        foreground_model,
        8,
        cv2.GC_INIT_WITH_MASK,
    )
    alpha = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0
    ).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (alpha > 0).astype(np.uint8), 8
    )
    if count > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        alpha = np.where(labels == largest, 255, 0).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    result = Image.fromarray(np.dstack([rgb, alpha]))
    bounds = Image.fromarray(alpha).getbbox()
    return result.crop(bounds) if bounds else result


def place_on_canvas(
    image: Image.Image,
    size: tuple[int, int],
    ratio: float,
    bottom: bool,
) -> Image.Image:
    width, height = size
    scale = min(width * ratio / image.width, height * ratio / image.height)
    resized = image.resize(
        (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (width - resized.width) // 2
    y = (
        height - resized.height - int(height * 0.02)
        if bottom
        else (height - resized.height) // 2
    )
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save_webp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=92, method=4, lossless=False, exact=True)


def generate_featured_assets(sheet: Image.Image) -> dict[str, Image.Image]:
    full_images: dict[str, Image.Image] = {}
    for character_id in FULL_BOXES:
        full = extract_full_character(sheet, character_id)
        full_images[character_id] = full
        directory = FEATURED_ROOT / character_id
        save_webp(
            place_on_canvas(full, (768, 1024), 0.92, True),
            directory / "full-neutral.webp",
        )
        bust_source = full.crop((0, 0, full.width, max(1, int(full.height * 0.5))))
        save_webp(
            place_on_canvas(bust_source, (768, 1024), 0.94, False),
            directory / "bust-neutral.webp",
        )
        chibi = remove_white_background(sheet.crop(CHIBI_BOXES[character_id]))
        save_webp(
            place_on_canvas(chibi, (512, 512), 0.86, True),
            directory / "chibi-neutral.webp",
        )
        for expression in ("neutral", "focused", "happy"):
            face = remove_white_background(
                sheet.crop(EXPRESSION_BOXES[(character_id, expression)])
            )
            save_webp(
                place_on_canvas(face, (512, 512), 0.90, False),
                directory / f"expression-{expression}.webp",
            )
        focused = Image.open(directory / "expression-focused.webp").convert("RGBA")
        pixels = np.array(focused)
        colors = pixels[:, :, :3].astype(np.float32)
        colors = np.clip((colors - 128) * 1.08 + 128, 0, 255)
        colors[:, :, 1] *= 0.90
        colors[:, :, 2] *= 0.92
        pixels[:, :, :3] = colors.astype(np.uint8)
        save_webp(
            Image.fromarray(pixels),
            directory / "expression-frustrated.webp",
        )
    return full_images


def skin_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = [rgb[:, :, index].astype(np.int16) for index in range(3)]
    return (r > 120) & (g > 60) & (b > 40) & (r > g) & ((r - b) > 20)


def prepare_atlas_source(name: str, image: Image.Image):
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].copy()
    alpha = rgba[:, :, 3]
    height, width = alpha.shape
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, saturation, value = [hsv[:, :, index] for index in range(3)]
    y = np.arange(height)[:, None] / height
    x = np.arange(width)[None, :] / width
    skin = skin_mask(rgb)
    head = (y < 0.24) & (alpha > 20)
    body = (
        (y > 0.10)
        & (y < 0.72)
        & (x > 0.04)
        & (x < 0.96)
        & (alpha > 20)
    )
    if name in ("kuroba", "seto"):
        hair = head & (~skin) & (value < 165)
    elif name == "higami":
        hair = head & (~skin) & (
            ((((hue < 15) | (hue > 170)) & (saturation > 70)))
            | (value < 85)
        )
    else:
        hair = head & (~skin) & (
            ((value > 115) & (saturation < 90))
            | ((value < 165) & (saturation < 60))
        )
    if name == "kuroba":
        accent = body & (hue < 20) & (saturation > 95) & (value > 80)
        primary = body & (value < 115) & (~skin) & (~accent)
    elif name == "seto":
        accent = (
            body
            & (hue > 78)
            & (hue < 108)
            & (saturation > 65)
            & (value > 70)
        )
        primary = (
            body
            & (hue > 95)
            & (hue < 140)
            & (value < 165)
            & (saturation > 25)
            & (~accent)
        )
    elif name == "higami":
        accent = (
            body
            & (((hue < 12) | (hue > 170)))
            & (saturation > 65)
            & (value > 45)
        )
        primary = body & (value < 110) & (~skin) & (~accent)
    else:
        accent = (
            body
            & (hue > 85)
            & (hue < 120)
            & (saturation > 45)
            & (value > 60)
        )
        primary = body & (value > 140) & (saturation < 90) & (~skin) & (~accent)
    torso = (
        (y > 0.12)
        & (y < 0.53)
        & (x > 0.12)
        & (x < 0.88)
        & (alpha > 20)
    )
    shorts = (
        (y > 0.42)
        & (y < 0.72)
        & (x > 0.12)
        & (x < 0.88)
        & (alpha > 20)
    )
    if name == "shiroma":
        remove = (torso | shorts) & (value < 145) & (saturation > 20)
    else:
        remove = (
            (torso | shorts)
            & (value > 165)
            & (saturation < 115)
            & (~skin)
        )
    remove = cv2.dilate(
        remove.astype(np.uint8) * 255,
        np.ones((5, 5), np.uint8),
        1,
    )
    rgb = cv2.cvtColor(
        cv2.inpaint(
            cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR),
            remove,
            3,
            cv2.INPAINT_TELEA,
        ),
        cv2.COLOR_BGR2RGB,
    )
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    for mask, minimum, maximum in (
        (hair, 28, 178),
        (primary, 35, 210),
        (accent, 70, 225),
    ):
        luminance = np.clip(
            gray.astype(np.float32) * 0.95,
            minimum,
            maximum,
        ).astype(np.uint8)
        neutral = np.stack([luminance, luminance, luminance], axis=2)
        blended = (neutral * 0.87 + rgb * 0.13).astype(np.uint8)
        rgb[mask] = blended[mask]
    return Image.fromarray(np.dstack([rgb, alpha])), hair, primary, accent


def render_atlas_layers(source, mirror: bool, width_factor: float):
    base, hair, primary, accent = source
    if mirror:
        base = ImageOps.mirror(base)
        hair = np.fliplr(hair)
        primary = np.fliplr(primary)
        accent = np.fliplr(accent)
    scale = 366 / base.height
    width = int(base.width * scale * width_factor)
    height = int(base.height * scale)
    if width > 242:
        correction = 242 / width
        width = 242
        height = int(height * correction)
    base = base.resize((width, height), Image.Resampling.LANCZOS)
    masks = [
        Image.fromarray((mask * 255).astype(np.uint8)).resize(
            (width, height),
            Image.Resampling.LANCZOS,
        )
        for mask in (hair, primary, accent)
    ]
    x = (TILE_W - width) // 2
    y = TILE_H - height - 4
    tile = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
    tile.alpha_composite(base, (x, y))
    layers = [tile]
    for mask in masks:
        alpha = Image.new("L", (TILE_W, TILE_H), 0)
        alpha.paste(mask, (x, y))
        layers.append(
            Image.merge(
                "RGBA",
                (Image.new("L", (TILE_W, TILE_H), 255),) * 3 + (alpha,),
            )
        )
    return layers


def generate_atlas(full_images: dict[str, Image.Image]) -> None:
    sources = {
        "kuroba": prepare_atlas_source(
            "kuroba", full_images["kuroba-hayato"]
        ),
        "seto": prepare_atlas_source("seto", full_images["seto-soma"]),
        "higami": prepare_atlas_source(
            "higami", full_images["higami-ren"]
        ),
        "shiroma": prepare_atlas_source(
            "shiroma", full_images["shiroma-minato"]
        ),
    }
    order = ["kuroba", "seto", "higami", "shiroma"] * 2
    entries: list[Image.Image] = []
    for index, name in enumerate(order):
        for width_factor in (1.12, 1.06, 0.92, 1.0):
            entries.extend(
                render_atlas_layers(sources[name], index >= 4, width_factor)
            )
    for kind in range(4):
        mask = Image.new("L", (TILE_W, TILE_H), 0)
        draw = ImageDraw.Draw(mask)
        if kind == 0:
            draw.rounded_rectangle((154, 76, 170, 94), radius=5, fill=255)
        elif kind == 1:
            draw.polygon(
                [(72, 68), (126, 48), (184, 68), (180, 82), (126, 64), (76, 84)],
                fill=255,
            )
        elif kind == 2:
            draw.rounded_rectangle(
                (82, 83, 119, 105),
                radius=8,
                outline=255,
                width=5,
            )
            draw.rounded_rectangle(
                (136, 83, 173, 105),
                radius=8,
                outline=255,
                width=5,
            )
            draw.line((119, 93, 136, 93), fill=255, width=5)
        else:
            draw.rounded_rectangle((58, 188, 82, 210), radius=8, fill=255)
        entries.append(
            Image.merge(
                "RGBA",
                (Image.new("L", (TILE_W, TILE_H), 255),) * 3 + (mask,),
            )
        )
    for kind in range(2):
        effect = Image.new("RGBA", (TILE_W, TILE_H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(effect)
        if kind == 0:
            for radius, opacity in ((116, 45), (92, 55), (68, 70)):
                draw.ellipse(
                    (
                        128 - radius,
                        192 - radius,
                        128 + radius,
                        192 + radius,
                    ),
                    outline=(255, 190, 60, opacity),
                    width=4,
                )
        else:
            for x, y, radius in (
                (54, 64, 4),
                (198, 82, 5),
                (42, 238, 3),
                (210, 270, 4),
                (128, 32, 5),
            ):
                draw.ellipse(
                    (x - radius, y - radius, x + radius, y + radius),
                    fill=(255, 235, 170, 200),
                )
        entries.append(effect)
    if len(entries) != 134:
        raise RuntimeError(f"unexpected atlas entry count: {len(entries)}")
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    for index, entry in enumerate(entries):
        atlas.alpha_composite(
            entry,
            (
                (index % ATLAS_COLUMNS) * TILE_W,
                (index // ATLAS_COLUMNS) * TILE_H,
            ),
        )
    ATLAS_PATH.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(
        ATLAS_PATH,
        "WEBP",
        quality=80,
        method=4,
        lossless=False,
        exact=True,
    )


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    sheet = Image.open(SOURCE).convert("RGBA")
    full_images = generate_featured_assets(sheet)
    generate_atlas(full_images)
    print(f"generated featured art and {ATLAS_PATH}")


if __name__ == "__main__":
    main()
