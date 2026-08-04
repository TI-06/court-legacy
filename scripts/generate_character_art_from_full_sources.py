from __future__ import annotations

from collections import deque
import importlib.util
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "scripts/art-source/full"
GENERATOR_PATH = Path(__file__).with_name("generate_character_art_assets.py")

spec = importlib.util.spec_from_file_location("character_art_generator", GENERATOR_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot load generator: {GENERATOR_PATH}")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

CHARACTERS = (
    "kuroba-hayato",
    "seto-soma",
    "higami-ren",
    "shiroma-minato",
)

ACCENT_COLORS = {
    "kuroba-hayato": (244, 122, 24),
    "seto-soma": (34, 153, 214),
    "higami-ren": (196, 52, 63),
    "shiroma-minato": (62, 170, 221),
}


def remove_key_background(
    image: Image.Image,
    character_id: str,
) -> Image.Image:
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3]
    height, width = rgb.shape[:2]
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
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dx or dy):
                    continue
                ny, nx = y + dy, x + dx
                if (
                    0 <= ny < height
                    and 0 <= nx < width
                    and key_candidate[ny, nx]
                    and not background[ny, nx]
                ):
                    background[ny, nx] = 1
                    queue.append((ny, nx))

    alpha = np.where(background, 0, 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue, saturation, value = [hsv[:, :, index] for index in range(3)]
    remaining_magenta = (
        (alpha > 32)
        & (hue > 135)
        & (hue < 175)
        & (saturation > 70)
        & (value > 45)
    )
    target = np.array(ACCENT_COLORS[character_id], dtype=np.float32)
    luminance = np.clip(value.astype(np.float32) / 210.0, 0.35, 1.18)
    recolored = np.clip(luminance[:, :, None] * target[None, None, :], 0, 255)
    rgb[remaining_magenta] = recolored[remaining_magenta].astype(np.uint8)

    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = alpha
    result = Image.fromarray(rgba)
    bounds = result.getbbox()
    return result.crop(bounds) if bounds else result


def make_chibi(full: Image.Image) -> Image.Image:
    body = generator.place_on_canvas(full, (512, 512), 0.68, True)
    head_source = full.crop((0, 0, full.width, max(1, int(full.height * 0.30))))
    head = generator.place_on_canvas(head_source, (300, 260), 0.94, False)
    body.alpha_composite(head, ((512 - head.width) // 2, 12))
    return body


def make_expression(full: Image.Image, tone: str) -> Image.Image:
    face_source = full.crop((0, 0, full.width, max(1, int(full.height * 0.28))))
    image = generator.place_on_canvas(face_source, (512, 512), 0.94, False)
    if tone == "focused":
        image = ImageEnhance.Contrast(image).enhance(1.10)
    elif tone == "happy":
        image = ImageEnhance.Brightness(image).enhance(1.08)
        image = ImageEnhance.Color(image).enhance(1.08)
    elif tone == "frustrated":
        image = ImageEnhance.Contrast(image).enhance(1.14)
        pixels = np.array(image)
        colors = pixels[:, :, :3].astype(np.float32)
        colors[:, :, 1] *= 0.90
        colors[:, :, 2] *= 0.92
        pixels[:, :, :3] = np.clip(colors, 0, 255).astype(np.uint8)
        image = Image.fromarray(pixels)
    return image


def main() -> None:
    full_images: dict[str, Image.Image] = {}
    for character_id in CHARACTERS:
        source = SOURCE_ROOT / f"{character_id}.png"
        if not source.exists():
            raise FileNotFoundError(source)
        full = remove_key_background(Image.open(source), character_id)
        full_images[character_id] = full
        directory = generator.FEATURED_ROOT / character_id
        generator.save_webp(
            generator.place_on_canvas(full, (768, 1024), 0.94, True),
            directory / "full-neutral.webp",
        )
        bust_source = full.crop((0, 0, full.width, max(1, int(full.height * 0.52))))
        generator.save_webp(
            generator.place_on_canvas(bust_source, (768, 1024), 0.96, False),
            directory / "bust-neutral.webp",
        )
        generator.save_webp(make_chibi(full), directory / "chibi-neutral.webp")
        for tone in ("neutral", "focused", "happy", "frustrated"):
            generator.save_webp(
                make_expression(full, tone),
                directory / f"expression-{tone}.webp",
            )
    generator.generate_atlas(full_images)
    print("generated character art from four direct full-body sources")


if __name__ == "__main__":
    main()
