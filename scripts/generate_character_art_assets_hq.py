from __future__ import annotations

import importlib.util
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MODULE_PATH = Path(__file__).with_name("generate_character_art_assets.py")
spec = importlib.util.spec_from_file_location("character_art_generator", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot load generator: {MODULE_PATH}")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

original_extract = generator.extract_full_character


def extract_full_character(sheet: Image.Image, character_id: str) -> Image.Image:
    if character_id != "shiroma-minato":
        return original_extract(sheet, character_id)

    crop = sheet.crop(generator.FULL_BOXES[character_id]).convert("RGB")
    rgb = np.array(crop)
    height, width = rgb.shape[:2]
    mask = np.full((height, width), cv2.GC_BGD, np.uint8)

    polygon = np.array(
        [
            [65, 0],
            [165, 0],
            [205, 55],
            [240, 95],
            [255, 170],
            [245, 245],
            [270, 330],
            [295, 440],
            [300, 560],
            [285, 700],
            [220, 740],
            [150, 715],
            [115, 660],
            [70, 640],
            [20, 610],
            [0, 545],
            [15, 475],
            [40, 405],
            [20, 330],
            [10, 250],
            [20, 170],
            [40, 100],
        ],
        np.int32,
    )
    probable = np.zeros((height, width), np.uint8)
    cv2.fillPoly(probable, [polygon], 1)
    mask[probable == 1] = cv2.GC_PR_FGD

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    r, g, b = [rgb[:, :, index].astype(np.int16) for index in range(3)]
    skin = (r > 120) & (g > 60) & (b > 40) & (r > g) & ((r - b) > 18)
    strong = ((hsv[:, :, 1] > 50) | (hsv[:, :, 2] < 170) | skin) & (
        probable == 1
    )
    mask[strong] = cv2.GC_FGD
    mask[:5, :] = cv2.GC_BGD
    mask[-5:, :] = cv2.GC_BGD
    mask[:, :5] = cv2.GC_BGD
    mask[:, -5:] = cv2.GC_BGD

    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        rgb,
        mask,
        None,
        background_model,
        foreground_model,
        10,
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


generator.extract_full_character = extract_full_character

if __name__ == "__main__":
    generator.main()
