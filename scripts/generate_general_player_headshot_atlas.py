from __future__ import annotations

from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "scripts/art-source/full"
OUTPUT = ROOT / "src/assets/player-parts/v1/all-parts-atlas.webp"

TILE_WIDTH = 256
TILE_HEIGHT = 384
ATLAS_COLUMNS = 8
ATLAS_WIDTH = 2048
ATLAS_HEIGHT = 6528
CROP_RATIO = 0.27
BODY_WIDTH_FACTORS = (1.12, 1.06, 0.92, 1.0)
SOURCE_FILES = (
    "kuroba-hayato.png",
    "seto-soma.png",
    "higami-ren.png",
    "shiroma-minato.png",
)


def remove_key_background(image: Image.Image) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3]
    original_alpha = rgba[:, :, 3]
    height, width = original_alpha.shape
    red, green, blue = [rgb[:, :, index].astype(np.int16) for index in range(3)]
    key_candidate = (red > 175) & (green < 115) & (blue > 175)

    background = np.zeros((height, width), np.uint8)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if key_candidate[y, x] and not background[y, x]:
                background[y, x] = 1
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if key_candidate[y, x] and not background[y, x]:
                background[y, x] = 1
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for delta_y in (-1, 0, 1):
            for delta_x in (-1, 0, 1):
                if delta_x == 0 and delta_y == 0:
                    continue
                next_y = y + delta_y
                next_x = x + delta_x
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and key_candidate[next_y, next_x]
                    and not background[next_y, next_x]
                ):
                    background[next_y, next_x] = 1
                    queue.append((next_y, next_x))

    alpha = np.where(background, 0, original_alpha).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    rgba[:, :, 3] = alpha
    result = Image.fromarray(rgba)
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


def normalize_headshot(
    source: Image.Image,
    width_factor: float,
    mirror: bool,
) -> Image.Image:
    crop = source.crop((0, 0, source.width, int(source.height * CROP_RATIO)))
    if mirror:
        crop = ImageOps.mirror(crop)

    canvas = Image.new("RGBA", (TILE_WIDTH, TILE_HEIGHT), (0, 0, 0, 0))
    scale = min(
        TILE_WIDTH * 0.93 * width_factor / crop.width,
        348 / crop.height,
    )
    resized = crop.resize(
        (
            max(1, int(crop.width * scale)),
            max(1, int(crop.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    canvas.alpha_composite(resized, ((TILE_WIDTH - resized.width) // 2, 14))
    return canvas


def masks_for(image: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, saturation, value = [hsv[:, :, index] for index in range(3)]
    red, green, blue = [rgb[:, :, index].astype(np.int16) for index in range(3)]
    y = np.arange(TILE_HEIGHT)[:, None] / TILE_HEIGHT

    skin = (
        (alpha > 25)
        & (red > 100)
        & (green > 45)
        & (blue > 25)
        & (red > green)
        & ((red - blue) > 8)
        & (hue < 32)
    )
    hair = (
        (alpha > 25)
        & (y < 0.72)
        & (~skin)
        & (((value < 190) & (saturation > 20)) | (value < 100))
    )
    clothing = (alpha > 25) & (y > 0.28) & (~skin) & (~hair)
    accent = clothing & (
        ((saturation > 75) & (value > 40))
        | ((value < 115) & (saturation > 30))
    )
    primary = clothing & (~accent)
    return hair, primary, accent


def neutralize(
    image: Image.Image,
    masks: tuple[np.ndarray, np.ndarray, np.ndarray],
) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    colors = rgba[:, :, :3].astype(np.float32)
    gray = cv2.cvtColor(colors.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(
        np.float32
    )
    neutral = np.stack([gray, gray, gray], axis=2)
    for mask, strength in zip(masks, (0.80, 0.88, 0.84), strict=True):
        colors[mask] = neutral[mask] * strength + colors[mask] * (1 - strength)
    rgba[:, :, :3] = np.clip(colors, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba)


def mask_image(mask: np.ndarray) -> Image.Image:
    alpha = Image.fromarray(mask.astype(np.uint8) * 255)
    white = Image.new("L", (TILE_WIDTH, TILE_HEIGHT), 255)
    return Image.merge("RGBA", (white, white, white, alpha))


def accessory_layers() -> list[Image.Image]:
    layers: list[Image.Image] = []
    for kind in range(4):
        layer = Image.new("RGBA", (TILE_WIDTH, TILE_HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        if kind == 0:
            draw.rounded_rectangle(
                (185, 118, 199, 145), radius=4, fill=(255, 255, 255, 240)
            )
        elif kind == 1:
            draw.polygon(
                [(54, 55), (126, 39), (204, 58), (200, 76), (127, 58), (58, 78)],
                fill=(255, 255, 255, 240),
            )
        elif kind == 2:
            draw.rounded_rectangle(
                (67, 107, 116, 137),
                radius=10,
                outline=(255, 255, 255, 240),
                width=5,
            )
            draw.rounded_rectangle(
                (140, 107, 189, 137),
                radius=10,
                outline=(255, 255, 255, 240),
                width=5,
            )
            draw.line((116, 122, 140, 122), fill=(255, 255, 255, 240), width=5)
        else:
            draw.rounded_rectangle(
                (30, 300, 62, 326), radius=8, fill=(255, 255, 255, 240)
            )
        layers.append(layer)
    return layers


def effect_layers() -> list[Image.Image]:
    layers: list[Image.Image] = []
    for kind in range(2):
        layer = Image.new("RGBA", (TILE_WIDTH, TILE_HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        if kind == 0:
            for radius, opacity in ((116, 45), (92, 55), (68, 70)):
                draw.ellipse(
                    (
                        128 - radius,
                        178 - radius,
                        128 + radius,
                        178 + radius,
                    ),
                    outline=(255, 190, 60, opacity),
                    width=4,
                )
        else:
            for x, y, radius in (
                (45, 60, 4),
                (205, 82, 5),
                (35, 235, 3),
                (215, 270, 4),
                (128, 30, 5),
            ):
                draw.ellipse(
                    (x - radius, y - radius, x + radius, y + radius),
                    fill=(255, 235, 170, 200),
                )
        layers.append(layer)
    return layers


def main() -> None:
    sources = [
        remove_key_background(Image.open(SOURCE_ROOT / name).convert("RGBA"))
        for name in SOURCE_FILES
    ]
    entries: list[Image.Image] = []

    for head_index in range(8):
        source = sources[head_index % len(sources)]
        mirror = head_index >= len(sources)
        for width_factor in BODY_WIDTH_FACTORS:
            portrait = normalize_headshot(source, width_factor, mirror)
            masks = masks_for(portrait)
            entries.extend(
                [neutralize(portrait, masks), *(mask_image(mask) for mask in masks)]
            )

    entries.extend(accessory_layers())
    entries.extend(effect_layers())
    if len(entries) != 134:
        raise RuntimeError(f"unexpected atlas entry count: {len(entries)}")

    atlas = Image.new("RGBA", (ATLAS_WIDTH, ATLAS_HEIGHT), (0, 0, 0, 0))
    for entry_index, entry in enumerate(entries):
        atlas.alpha_composite(
            entry,
            (
                (entry_index % ATLAS_COLUMNS) * TILE_WIDTH,
                (entry_index // ATLAS_COLUMNS) * TILE_HEIGHT,
            ),
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(
        OUTPUT,
        "WEBP",
        quality=90,
        method=6,
        lossless=False,
        exact=True,
    )
    print(f"generated {OUTPUT} ({ATLAS_WIDTH}x{ATLAS_HEIGHT})")


if __name__ == "__main__":
    main()
