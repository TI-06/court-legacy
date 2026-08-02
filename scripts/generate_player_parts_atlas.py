"""Generate the source-quality deterministic player-art WebP atlas.

The atlas reuses the four approved featured-player SD assets as visual
anchors, then derives deterministic body, hair, uniform, accessory, and
tier layers for generated players.
"""

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TILE_W, TILE_H, COLS = (256, 384, 8)
TRAN = (0, 0, 0, 0)
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/assets/characters/featured"
OUT = ROOT / "src/assets/player-parts/v1"
OUT.mkdir(parents=True, exist_ok=True)
CHARS = ["kuroba-hayato", "seto-soma", "higami-ren", "shiroma-minato"]
HAIR_STYLES = [
    "buzz",
    "center-part",
    "crew",
    "curly",
    "shaggy",
    "short-spike",
    "side-swept",
    "undercut",
]
BODY_TYPES = ["large", "muscular", "slim", "standard"]


def trim(image: Image.Image) -> Image.Image:
    box = image.getbbox()
    return image.crop(box) if box else image


def normalize(image: Image.Image) -> Image.Image:
    image = trim(image.convert("RGBA"))
    scale = min(220 / image.width, 350 / image.height)
    image = image.resize(
        (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (TILE_W, TILE_H), TRAN)
    canvas.alpha_composite(
        image,
        ((TILE_W - image.width) // 2, TILE_H - image.height - 6),
    )

    pixels = np.array(canvas).copy()
    alpha = pixels[:, :, 3]
    closed = cv2.morphologyEx(
        alpha,
        cv2.MORPH_CLOSE,
        np.ones((13, 13), np.uint8),
    )
    holes = (
        (closed > 20)
        & (alpha < 20)
        & (np.indices(alpha.shape)[0] < 190)
    ).astype(np.uint8) * 255
    if holes.any():
        for channel in range(3):
            pixels[:, :, channel] = cv2.inpaint(
                pixels[:, :, channel],
                holes,
                3,
                cv2.INPAINT_TELEA,
            )
        pixels[:, :, 3] = np.maximum(
            alpha,
            np.where(holes > 0, closed, 0).astype(np.uint8),
        )
    return Image.fromarray(pixels)


def skin_mask(pixels: np.ndarray) -> np.ndarray:
    rgb = pixels[:, :, :3]
    alpha = pixels[:, :, 3]
    hue, saturation, value = cv2.split(cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV))
    return (
        (
            ((hue < 25) | (hue > 170))
            & (saturation > 18)
            & (saturation < 190)
            & (value > 95)
            & (alpha > 15)
        ).astype(np.uint8)
        * 255
    )


def largest_components(mask: np.ndarray, ratio: float = 0.02) -> np.ndarray:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (mask > 0).astype(np.uint8),
        8,
    )
    components = sorted(
        [(stats[index, 4], index) for index in range(1, count)],
        reverse=True,
    )
    if not components:
        return mask
    maximum = components[0][0]
    keep = [index for area, index in components if area >= maximum * ratio]
    return np.isin(labels, keep).astype(np.uint8) * 255


def hair_mask(image: Image.Image, source_index: int) -> Image.Image:
    pixels = np.array(image)
    alpha = pixels[:, :, 3]
    y_grid, x_grid = np.mgrid[0:TILE_H, 0:TILE_W]
    skin = skin_mask(pixels) > 0
    rgb = pixels[:, :, :3]
    hue, saturation, value = cv2.split(cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV))
    zone = (
        (alpha > 20)
        & ~skin
        & (
            (y_grid < 145)
            | ((y_grid < 180) & ((x_grid < 82) | (x_grid > 174)))
        )
        & (
            ((x_grid - 128) / 115) ** 2
            + ((y_grid - 95) / 125) ** 2
            < 1.3
        )
    )
    if source_index == 0:
        color = ((value < 145) & (saturation < 150)) | (
            (hue < 20) & (saturation > 70) & (value < 220)
        )
    elif source_index == 1:
        color = (
            (hue > 85)
            & (hue < 135)
            & (saturation > 25)
            & (value < 190)
        ) | ((value < 95) & (saturation < 130))
    elif source_index == 2:
        color = (
            ((hue < 15) | (hue > 165))
            & (saturation > 55)
            & (value < 210)
        ) | ((value < 80) & (saturation > 40))
    else:
        color = (saturation < 80) & (value > 100) & (y_grid < 170)

    zone &= ~((x_grid > 96) & (x_grid < 160) & (y_grid > 145))
    mask = (zone & color).astype(np.uint8) * 255
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        np.ones((3, 3), np.uint8),
    )
    mask = largest_components(mask, 0.015)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    return Image.fromarray(cv2.GaussianBlur(mask, (0, 0), 0.6), "L")


def uniform_masks(
    image: Image.Image,
    source_index: int,
) -> tuple[Image.Image, Image.Image]:
    pixels = np.array(image)
    alpha = pixels[:, :, 3]
    y_grid, x_grid = np.mgrid[0:TILE_H, 0:TILE_W]
    skin = skin_mask(pixels) > 0
    rgb = pixels[:, :, :3]
    hue, saturation, value = cv2.split(cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV))
    zone = (
        (alpha > 20)
        & ~skin
        & (y_grid > 168)
        & (y_grid < 330)
        & (x_grid > 30)
        & (x_grid < 226)
    )
    primary = zone.copy()
    if source_index == 0:
        accent = zone & (
            ((hue < 25) & (saturation > 85) & (value > 70))
            | (value > 205)
        )
    elif source_index == 1:
        accent = zone & (
            (
                (hue > 80)
                & (hue < 110)
                & (saturation > 65)
                & (value > 80)
            )
            | (value > 210)
        )
    elif source_index == 2:
        accent = zone & (
            ((hue < 12) | (hue > 165))
            & (saturation > 75)
            & (value > 65)
        )
    else:
        accent = zone & (
            (
                (hue > 85)
                & (hue < 115)
                & (saturation > 40)
                & (value > 90)
            )
            | (value > 220)
        )

    primary &= ~((y_grid > 315) & (value < 120))
    accent &= y_grid < 315
    return (
        Image.fromarray(
            cv2.GaussianBlur(primary.astype(np.uint8) * 255, (0, 0), 0.5),
            "L",
        ),
        Image.fromarray(
            cv2.GaussianBlur(accent.astype(np.uint8) * 255, (0, 0), 0.5),
            "L",
        ),
    )


def remove_prints(image: Image.Image, source_index: int) -> Image.Image:
    pixels = np.array(image).copy()
    rgb = pixels[:, :, :3]
    alpha = pixels[:, :, 3]
    hue, saturation, value = cv2.split(
        cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    )
    y_grid, x_grid = np.mgrid[0:TILE_H, 0:TILE_W]
    chest = (
        (x_grid > 88)
        & (x_grid < 170)
        & (y_grid > 195)
        & (y_grid < 252)
        & (alpha > 20)
    )
    shorts = (
        (x_grid > 90)
        & (x_grid < 168)
        & (y_grid >= 265)
        & (y_grid < 318)
        & (alpha > 20)
    )
    region = chest | shorts
    if source_index == 3:
        ink = (value < 130) & (saturation > 20)
    else:
        ink = (value > 155) & (saturation < 100)
    mask = (region & ink).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    if mask.any():
        rgb = cv2.inpaint(rgb, mask, 3, cv2.INPAINT_TELEA)
    pixels[:, :, :3] = rgb
    pixels[:, :, 3] = alpha
    return Image.fromarray(pixels)


def grayscale_region(image: Image.Image, mask: Image.Image) -> Image.Image:
    pixels = np.array(image).copy()
    mask_values = np.array(mask).astype(np.float32) / 255
    rgb = pixels[:, :, :3].astype(np.float32)
    luminance = (
        0.2126 * rgb[:, :, 0]
        + 0.7152 * rgb[:, :, 1]
        + 0.0722 * rgb[:, :, 2]
    )
    grayscale = np.stack([luminance] * 3, 2)
    rgb = (
        rgb * (1 - mask_values[:, :, None])
        + grayscale * mask_values[:, :, None]
    )
    pixels[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels)


def transform(
    image: Image.Image,
    scale_x: float = 1,
    flip: bool = False,
) -> Image.Image:
    source = (
        image.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else image
    )
    new_width = max(1, int(TILE_W * scale_x))
    resized = source.resize((new_width, TILE_H), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (TILE_W, TILE_H), TRAN)
    canvas.alpha_composite(resized, ((TILE_W - new_width) // 2, 0))
    return canvas


def transform_mask(
    mask: Image.Image,
    scale_x: float = 1,
    flip: bool = False,
) -> Image.Image:
    source = (
        mask.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else mask
    )
    new_width = max(1, int(TILE_W * scale_x))
    resized = source.resize((new_width, TILE_H), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (TILE_W, TILE_H), 0)
    canvas.paste(resized, ((TILE_W - new_width) // 2, 0))
    return canvas


def mask_rgba(mask: Image.Image) -> Image.Image:
    alpha = np.array(mask)
    output = np.zeros((TILE_H, TILE_W, 4), np.uint8)
    output[:, :, :3] = 255
    output[:, :, 3] = alpha
    return Image.fromarray(output)


def accessory(kind: str) -> Image.Image:
    canvas = Image.new("RGBA", (TILE_W, TILE_H), TRAN)
    draw = ImageDraw.Draw(canvas)
    if kind == "headband":
        draw.rounded_rectangle(
            (70, 62, 186, 78),
            7,
            fill=(255, 255, 255, 235),
        )
    elif kind == "sports-glasses":
        draw.rounded_rectangle(
            (76, 96, 118, 120),
            8,
            outline="white",
            width=6,
        )
        draw.rounded_rectangle(
            (138, 96, 180, 120),
            8,
            outline="white",
            width=6,
        )
        draw.line((118, 107, 138, 107), fill="white", width=5)
    elif kind == "ear-tape":
        draw.rounded_rectangle(
            (58, 108, 73, 135),
            5,
            fill=(255, 255, 255, 230),
        )
    elif kind == "wristband":
        draw.rounded_rectangle(
            (48, 238, 75, 256),
            5,
            fill=(255, 255, 255, 230),
        )
    return canvas


def effect(kind: str) -> Image.Image:
    canvas = Image.new("RGBA", (TILE_W, TILE_H), TRAN)
    draw = ImageDraw.Draw(canvas)
    color = (
        (255, 190, 45, 145)
        if kind == "prospect"
        else (255, 100, 25, 175)
    )
    for index in range(4):
        draw.rounded_rectangle(
            (
                12 + index * 8,
                12 + index * 8,
                TILE_W - 12 - index * 8,
                TILE_H - 12 - index * 8,
            ),
            20,
            outline=color,
            width=4 - index,
        )
    return canvas.filter(ImageFilter.GaussianBlur(0.7))


sources: list[tuple[Image.Image, Image.Image, Image.Image, Image.Image]] = []
for source_index, character in enumerate(CHARS):
    source_image = normalize(
        Image.open(SRC / character / "chibi-neutral.webp")
    )
    source_image = remove_prints(source_image, source_index)
    hair = hair_mask(source_image, source_index)
    uniform_primary, uniform_accent = uniform_masks(
        source_image,
        source_index,
    )
    base = grayscale_region(
        grayscale_region(source_image, hair),
        uniform_primary,
    )
    sources.append((base, hair, uniform_primary, uniform_accent))

style_source = {
    "buzz": (0, False, 0.9),
    "center-part": (1, False, 1.0),
    "crew": (0, False, 0.95),
    "curly": (1, False, 1.08),
    "shaggy": (0, True, 1.04),
    "short-spike": (0, False, 1.05),
    "side-swept": (1, True, 1.03),
    "undercut": (2, True, 0.98),
}
body_scale = {
    "large": 1.1,
    "muscular": 1.05,
    "slim": 0.93,
    "standard": 1.0,
}
entries: list[Image.Image] = []
for hair_style in HAIR_STYLES:
    source_index, flip, style_scale = style_source[hair_style]
    base, hair, uniform_primary, uniform_accent = sources[source_index]
    for body_type in BODY_TYPES:
        scale_x = style_scale * body_scale[body_type]
        entries.append(transform(base, scale_x, flip))
        entries.append(mask_rgba(transform_mask(hair, scale_x, flip)))
        entries.append(
            mask_rgba(transform_mask(uniform_primary, scale_x, flip))
        )
        entries.append(
            mask_rgba(transform_mask(uniform_accent, scale_x, flip))
        )
for accessory_name in [
    "ear-tape",
    "headband",
    "sports-glasses",
    "wristband",
]:
    entries.append(accessory(accessory_name))
for effect_name in ["generational", "prospect"]:
    entries.append(effect(effect_name))

rows = math.ceil(len(entries) / COLS)
atlas = Image.new("RGBA", (COLS * TILE_W, rows * TILE_H), TRAN)
for index, tile in enumerate(entries):
    atlas.alpha_composite(
        tile,
        ((index % COLS) * TILE_W, (index // COLS) * TILE_H),
    )
atlas.save(
    OUT / "all-parts-atlas.webp",
    "WEBP",
    quality=92,
    method=4,
)
print(f"generated {len(entries)} tiles at {atlas.width}x{atlas.height}")
