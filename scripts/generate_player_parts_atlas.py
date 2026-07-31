from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter

TILE_W = 64
TILE_H = 96
ATLAS_W = 512
ATLAS_H = 768
SCALE = 4

TRANSPARENT = (0, 0, 0, 0)
WHITE = (255, 255, 255, 255)
INK = (29, 34, 45, 255)
SKIN = (239, 188, 151, 255)
SKIN_SHADOW = (205, 137, 112, 170)
MOUTH = (139, 70, 72, 255)


def scaled_box(box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(value * SCALE for value in box)


def scaled_points(points: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    return [(x * SCALE, y * SCALE) for x, y in points]


def new_tile() -> Image.Image:
    return Image.new("RGBA", (TILE_W * SCALE, TILE_H * SCALE), TRANSPARENT)


def downsample(image: Image.Image) -> Image.Image:
    return image.resize((TILE_W, TILE_H), Image.Resampling.LANCZOS)


def ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
) -> None:
    draw.ellipse(scaled_box(box), fill=fill)


def rounded_rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.rounded_rectangle(scaled_box(box), radius=radius * SCALE, fill=fill)


def polygon(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[int, int]],
    fill: tuple[int, int, int, int],
) -> None:
    draw.polygon(scaled_points(points), fill=fill)


def line(
    draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[int, int]],
    fill: tuple[int, int, int, int],
    width: int,
) -> None:
    draw.line(scaled_points(points), fill=fill, width=width * SCALE, joint="curve")


def body_tile(body_type: str, pose: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    torso_half = {"slim": 10, "standard": 12, "muscular": 14, "large": 16}[body_type]
    shoulder_y = 46
    waist_y = 74
    center = 32

    if pose == "ready":
        arm_left = [(center - torso_half + 2, 48), (12, 63), (16, 69)]
        arm_right = [(center + torso_half - 2, 48), (52, 63), (48, 69)]
        leg_left = [(27, 72), (19, 91), (24, 93)]
        leg_right = [(37, 72), (45, 91), (40, 93)]
    elif pose == "leaning":
        arm_left = [(center - torso_half + 2, 48), (10, 57), (12, 64)]
        arm_right = [(center + torso_half - 2, 48), (48, 67), (53, 64)]
        leg_left = [(27, 72), (17, 90), (23, 93)]
        leg_right = [(37, 72), (43, 92), (48, 90)]
    elif pose == "celebration":
        arm_left = [(center - torso_half + 2, 49), (18, 28), (22, 24)]
        arm_right = [(center + torso_half - 2, 49), (46, 28), (42, 24)]
        leg_left = [(27, 72), (24, 93), (29, 93)]
        leg_right = [(37, 72), (40, 93), (35, 93)]
    else:
        arm_left = [(center - torso_half + 2, 48), (18, 70), (22, 72)]
        arm_right = [(center + torso_half - 2, 48), (46, 70), (42, 72)]
        leg_left = [(27, 72), (25, 93), (30, 93)]
        leg_right = [(37, 72), (39, 93), (34, 93)]

    line(draw, arm_left, SKIN, 6)
    line(draw, arm_right, SKIN, 6)
    line(draw, leg_left, SKIN, 7)
    line(draw, leg_right, SKIN, 7)
    rounded_rectangle(draw, (28, 36, 36, 50), 3, SKIN)
    rounded_rectangle(
        draw,
        (center - torso_half, shoulder_y, center + torso_half, waist_y),
        8,
        (226, 229, 235, 255),
    )
    rounded_rectangle(draw, (center - torso_half + 2, 69, center + torso_half - 2, 82), 4, INK)
    ellipse(draw, (15, 88, 27, 94), INK)
    ellipse(draw, (37, 88, 49, 94), INK)
    polygon(
        draw,
        [(center + torso_half - 5, shoulder_y), (center + torso_half, shoulder_y + 5), (center + torso_half - 3, waist_y)],
        SKIN_SHADOW,
    )
    return downsample(image)


def face_tile(shape: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    boxes = {
        "round": (18, 15, 46, 48),
        "oval": (19, 13, 45, 49),
        "angular": (20, 13, 44, 50),
        "wide": (16, 16, 48, 47),
    }
    box = boxes[shape]
    ellipse(draw, (box[0] - 2, 27, box[0] + 3, 37), SKIN)
    ellipse(draw, (box[2] - 3, 27, box[2] + 2, 37), SKIN)
    ellipse(draw, box, SKIN)
    polygon(draw, [(32, box[1]), (box[2], 25), (41, box[3]), (32, box[3])], SKIN_SHADOW)
    ellipse(draw, (25, 39, 29, 42), (240, 150, 148, 55))
    ellipse(draw, (35, 39, 39, 42), (240, 150, 148, 55))
    return downsample(image)


def hair_back_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    shapes: dict[str, list[tuple[int, int]]] = {
        "short-spike": [(17, 31), (16, 16), (21, 19), (22, 10), (27, 15), (31, 7), (35, 15), (42, 9), (44, 18), (50, 16), (47, 36)],
        "side-swept": [(16, 33), (17, 16), (27, 9), (41, 10), (49, 20), (47, 36), (40, 23), (28, 20)],
        "buzz": [(19, 28), (20, 17), (27, 12), (39, 12), (45, 18), (46, 29)],
        "curly": [(15, 32), (17, 18), (22, 11), (29, 8), (36, 9), (44, 12), (50, 21), (48, 35)],
        "center-part": [(16, 34), (17, 18), (25, 10), (32, 8), (39, 10), (47, 18), (48, 35), (37, 24), (32, 18), (27, 24)],
        "shaggy": [(14, 35), (17, 15), (25, 8), (35, 7), (45, 12), (51, 23), (48, 39), (43, 31), (39, 40), (34, 30), (28, 40), (23, 30), (18, 39)],
        "undercut": [(18, 33), (19, 18), (27, 10), (42, 9), (49, 17), (45, 24), (31, 20), (21, 32)],
        "crew": [(18, 29), (20, 16), (27, 11), (39, 11), (46, 18), (46, 31), (39, 24), (25, 24)],
    }
    polygon(draw, shapes[style], WHITE)
    return downsample(image)


def hair_front_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    shapes: dict[str, list[tuple[int, int]]] = {
        "short-spike": [(18, 23), (22, 15), (25, 22), (30, 12), (33, 22), (39, 14), (41, 23), (48, 18), (44, 30), (37, 25), (33, 32), (28, 25), (23, 32)],
        "side-swept": [(18, 24), (23, 14), (36, 12), (48, 20), (42, 23), (31, 21), (24, 31)],
        "buzz": [(20, 22), (23, 16), (32, 14), (42, 17), (45, 23), (37, 21), (27, 21)],
        "curly": [(17, 25), (20, 16), (27, 12), (34, 13), (42, 14), (48, 22), (44, 28), (37, 24), (31, 29), (25, 24)],
        "center-part": [(18, 24), (23, 15), (31, 12), (31, 30), (26, 24), (21, 31), (32, 13), (42, 15), (48, 24), (43, 31), (37, 24), (33, 30)],
        "shaggy": [(16, 24), (21, 13), (31, 10), (42, 13), (49, 22), (45, 34), (40, 27), (36, 36), (31, 27), (26, 36), (22, 27), (18, 33)],
        "undercut": [(18, 24), (23, 15), (34, 11), (47, 17), (42, 23), (29, 21), (22, 31)],
        "crew": [(19, 23), (23, 15), (32, 12), (42, 15), (46, 23), (38, 21), (27, 21)],
    }
    polygon(draw, shapes[style], WHITE)
    return downsample(image)


def eyes_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    if style == "narrow":
        line(draw, [(23, 29), (29, 28)], WHITE, 2)
        line(draw, [(35, 28), (41, 29)], WHITE, 2)
    elif style == "sharp":
        polygon(draw, [(22, 27), (30, 28), (28, 32), (24, 31)], WHITE)
        polygon(draw, [(34, 28), (42, 27), (40, 31), (36, 32)], WHITE)
    elif style == "droop":
        ellipse(draw, (22, 27, 29, 33), WHITE)
        ellipse(draw, (35, 27, 42, 33), WHITE)
        line(draw, [(22, 27), (29, 29)], INK, 1)
        line(draw, [(35, 29), (42, 27)], INK, 1)
    else:
        ellipse(draw, (22, 26, 29, 34), WHITE)
        ellipse(draw, (35, 26, 42, 34), WHITE)
    return downsample(image)


def brows_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    width = 3 if style == "bold" else 2
    if style == "arched":
        line(draw, [(22, 23), (26, 20), (30, 22)], INK, width)
        line(draw, [(34, 22), (38, 20), (42, 23)], INK, width)
    elif style == "soft":
        line(draw, [(22, 22), (30, 22)], (70, 54, 52, 210), width)
        line(draw, [(34, 22), (42, 22)], (70, 54, 52, 210), width)
    else:
        line(draw, [(22, 23), (30, 21)], INK, width)
        line(draw, [(34, 21), (42, 23)], INK, width)
    return downsample(image)


def mouth_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    if style == "wide":
        line(draw, [(25, 39), (32, 42), (39, 39)], MOUTH, 2)
    elif style == "soft":
        line(draw, [(27, 39), (32, 41), (37, 39)], MOUTH, 1)
    elif style == "small":
        line(draw, [(29, 40), (35, 40)], MOUTH, 1)
    else:
        line(draw, [(26, 40), (38, 40)], MOUTH, 2)
    return downsample(image)


def uniform_tile(pattern: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    rounded_rectangle(draw, (20, 45, 44, 76), 8, WHITE)
    rounded_rectangle(draw, (22, 69, 42, 82), 4, WHITE)
    if pattern == "side-stripe":
        polygon(draw, [(20, 49), (24, 47), (25, 74), (21, 76)], TRANSPARENT)
    elif pattern == "chevron":
        polygon(draw, [(22, 51), (32, 58), (42, 51), (40, 57), (32, 64), (24, 57)], TRANSPARENT)
    elif pattern == "split":
        polygon(draw, [(32, 45), (44, 49), (42, 76), (32, 76)], (255, 255, 255, 160))
    else:
        rounded_rectangle(draw, (24, 50, 40, 54), 2, (255, 255, 255, 170))
    return downsample(image)


def accessory_tile(style: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    if style == "headband":
        polygon(draw, [(19, 20), (31, 16), (45, 20), (44, 24), (31, 20), (20, 24)], WHITE)
    elif style == "sports-glasses":
        rounded_rectangle(draw, (21, 26, 30, 33), 3, WHITE)
        rounded_rectangle(draw, (34, 26, 43, 33), 3, WHITE)
        line(draw, [(30, 29), (34, 29)], WHITE, 2)
    elif style == "ear-tape":
        rounded_rectangle(draw, (44, 29, 48, 38), 2, WHITE)
    else:
        rounded_rectangle(draw, (13, 65, 21, 70), 2, WHITE)
        rounded_rectangle(draw, (43, 65, 51, 70), 2, WHITE)
    return downsample(image)


def effect_tile(tier: str) -> Image.Image:
    image = new_tile()
    draw = ImageDraw.Draw(image)
    color = (255, 184, 66, 150) if tier == "generational" else (86, 193, 255, 130)
    for inset, alpha in ((3, 45), (7, 75), (11, 120)):
        draw.ellipse(
            scaled_box((inset, inset, TILE_W - inset, TILE_H - inset)),
            outline=(color[0], color[1], color[2], alpha),
            width=2 * SCALE,
        )
    image = image.filter(ImageFilter.GaussianBlur(1.2 * SCALE))
    return downsample(image)


def paste(atlas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    atlas.alpha_composite(image, (x, y))


def generate(output: Path) -> None:
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), TRANSPARENT)
    body_types = ["large", "muscular", "slim", "standard"]
    poses = ["ready", "upright", "leaning", "celebration"]
    for pose_index, pose in enumerate(poses):
        for body_index, body_type in enumerate(body_types):
            tile_index = pose_index * 4 + body_index
            paste(atlas, body_tile(body_type, pose), (tile_index % 8) * TILE_W, (tile_index // 8) * TILE_H)

    for index, shape in enumerate(["angular", "oval", "round", "wide"]):
        paste(atlas, face_tile(shape), index * TILE_W, 192)

    styles = ["buzz", "center-part", "crew", "curly", "shaggy", "short-spike", "side-swept", "undercut"]
    for index, style in enumerate(styles):
        paste(atlas, hair_back_tile(style), ((index + 4) % 8) * TILE_W, 192 + ((index + 4) // 8) * TILE_H)
        paste(atlas, hair_front_tile(style), ((index + 4) % 8) * TILE_W, 288 + ((index + 4) // 8) * TILE_H)

    for index, style in enumerate(["droop", "narrow", "round", "sharp"]):
        paste(atlas, eyes_tile(style), (index + 4) * TILE_W, 384)
    for index, style in enumerate(["arched", "bold", "soft", "straight"]):
        paste(atlas, brows_tile(style), index * TILE_W, 480)
    for index, style in enumerate(["firm", "small", "soft", "wide"]):
        paste(atlas, mouth_tile(style), (index + 4) * TILE_W, 480)
    for index, style in enumerate(["chevron", "classic", "side-stripe", "split"]):
        paste(atlas, uniform_tile(style), index * 2 * TILE_W, 576)
    for index, style in enumerate(["ear-tape", "headband", "sports-glasses", "wristband"]):
        paste(atlas, accessory_tile(style), index * TILE_W, 672)
    paste(atlas, effect_tile("generational"), 256, 672)
    paste(atlas, effect_tile("prospect"), 320, 672)

    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, "WEBP", lossless=False, quality=82, method=6)


if __name__ == "__main__":
    generate(Path("src/assets/player-parts/v1/all-parts-atlas.webp"))
