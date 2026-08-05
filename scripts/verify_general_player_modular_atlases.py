from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "src/assets/player-parts/v2"
TILE_WIDTH = 256
TILE_HEIGHT = 384
COLUMNS = 8
SAFE_MARGIN = 2
SPECS = {
    "body-atlas.webp": 16,
    "skin-atlas.webp": 16,
    "face-shadow-atlas.webp": 4,
    "back-hair-atlas.webp": 6,
    "front-hair-atlas.webp": 8,
    "eyes-atlas.webp": 24,
    "brows-atlas.webp": 20,
    "mouths-atlas.webp": 20,
    "uniform-atlas.webp": 32,
    "accessory-atlas.webp": 16,
    "effect-atlas.webp": 2,
}


def verify_tile(alpha: Image.Image, name: str, index: int) -> None:
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError(f"{name} tile {index} is empty")
    left, top, right, bottom = bounds
    if left < SAFE_MARGIN or top < SAFE_MARGIN:
        raise RuntimeError(f"{name} tile {index} touches the top/left edge: {bounds}")
    if right > TILE_WIDTH - SAFE_MARGIN or bottom > TILE_HEIGHT - SAFE_MARGIN:
        raise RuntimeError(f"{name} tile {index} touches the bottom/right edge: {bounds}")


def main() -> None:
    for name, count in SPECS.items():
        path = ASSET_ROOT / name
        if not path.exists():
            raise RuntimeError(f"missing atlas: {path.relative_to(ROOT)}")
        with Image.open(path) as image:
            rgba = image.convert("RGBA")
            expected_rows = (count + COLUMNS - 1) // COLUMNS
            expected_size = (COLUMNS * TILE_WIDTH, expected_rows * TILE_HEIGHT)
            if rgba.size != expected_size:
                raise RuntimeError(f"{name} has {rgba.size}, expected {expected_size}")
            if rgba.getchannel("A").getextrema()[0] != 0:
                raise RuntimeError(f"{name} has no transparent background")
            for index in range(count):
                x = (index % COLUMNS) * TILE_WIDTH
                y = (index // COLUMNS) * TILE_HEIGHT
                alpha = rgba.crop((x, y, x + TILE_WIDTH, y + TILE_HEIGHT)).getchannel("A")
                verify_tile(alpha, name, index)
        print(f"verified {path.relative_to(ROOT)} ({count} tiles)")


if __name__ == "__main__":
    main()
