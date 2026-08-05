from __future__ import annotations

from dataclasses import dataclass
from math import cos, pi, sin
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "src/assets/player-parts/v2"
TILE_WIDTH = 256
TILE_HEIGHT = 384
SCALE = 4
COLUMNS = 8

BODY_TYPES = ("slim", "standard", "muscular", "large")
POSES = ("ready", "upright", "leaning", "celebration")
FACE_SHAPES = ("round", "oval", "angular", "wide")
FRONT_HAIR = (
    "short-spike",
    "side-swept",
    "buzz",
    "curly",
    "center-part",
    "shaggy",
    "undercut",
    "crew",
)
BACK_HAIR = (
    "cropped",
    "rounded",
    "layered",
    "tapered",
    "long-nape",
    "undercut-back",
)
EYES = ("round", "sharp", "narrow", "droop", "bright", "deep-set")
BROWS = ("straight", "arched", "bold", "soft", "angled")
MOUTHS = ("small", "wide", "soft", "firm", "grin")
EXPRESSIONS = ("neutral", "focused", "joy", "frustrated")
UNIFORM_PATTERNS = ("classic", "side-stripe", "chevron", "split")
ACCESSORIES = ("ear-tape", "headband", "sports-glasses", "wristband")

INK = (19, 29, 45, 255)
INK_SOFT = (38, 51, 70, 220)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


@dataclass(frozen=True)
class AtlasSpec:
    name: str
    count: int
    painter: Callable[[int], Image.Image]


def px(value: float) -> int:
    return round(value * SCALE)


def scaled_points(points: list[tuple[float, float]]) -> list[tuple[int, int]]:
    return [(px(x), px(y)) for x, y in points]


def canvas() -> Image.Image:
    return Image.new("RGBA", (TILE_WIDTH * SCALE, TILE_HEIGHT * SCALE), TRANSPARENT)


def finish(image: Image.Image) -> Image.Image:
    return image.resize((TILE_WIDTH, TILE_HEIGHT), Image.Resampling.LANCZOS)


def rounded_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = None,
    width: float = 0,
) -> None:
    draw.polygon(scaled_points(points), fill=fill)
    if outline and width > 0:
        draw.line(
            scaled_points([*points, points[0]]),
            fill=outline,
            width=px(width),
            joint="curve",
        )


def pose_offsets(pose_index: int) -> tuple[float, float, float]:
    return (
        (0.0, 0.0, 0.0),
        (0.0, -2.0, 0.0),
        (-5.0, 3.0, -0.035),
        (2.0, -7.0, 0.02),
    )[pose_index]


def face_bounds(face_index: int) -> tuple[float, float, float, float]:
    return (
        (79, 58, 177, 178),
        (82, 52, 174, 182),
        (84, 55, 172, 181),
        (75, 58, 181, 176),
    )[face_index]


def torso_points(body_index: int, pose_index: int) -> list[tuple[float, float]]:
    shoulder = (76, 84, 92, 102)[body_index]
    waist = (50, 56, 61, 68)[body_index]
    shift_x, shift_y, _ = pose_offsets(pose_index)
    left = 128 - shoulder + shift_x
    right = 128 + shoulder + shift_x
    return [
        (left + 10, 202 + shift_y),
        (left, 222 + shift_y),
        (128 - waist, 371),
        (128 + waist, 371),
        (right, 222 + shift_y),
        (right - 10, 202 + shift_y),
        (159 + shift_x, 187 + shift_y),
        (97 + shift_x, 187 + shift_y),
    ]


def arm_shapes(body_index: int, pose_index: int) -> list[list[tuple[float, float]]]:
    shoulder = (76, 84, 92, 102)[body_index]
    sx, sy, _ = pose_offsets(pose_index)
    if pose_index == 0:
        return [
            [(128 - shoulder + 8, 220), (48, 278), (71, 305), (107, 250)],
            [(128 + shoulder - 8, 220), (208, 278), (185, 305), (149, 250)],
        ]
    if pose_index == 1:
        return [
            [(128 - shoulder + 8, 218), (65, 278), (78, 351), (104, 345)],
            [(128 + shoulder - 8, 218), (191, 278), (178, 351), (152, 345)],
        ]
    if pose_index == 2:
        return [
            [(128 - shoulder + 8 + sx, 220 + sy), (45, 266), (75, 293), (108, 247)],
            [(128 + shoulder - 8 + sx, 220 + sy), (204, 250), (188, 284), (149, 245)],
        ]
    return [
        [(128 - shoulder + 10, 214), (75, 147), (95, 127), (119, 204)],
        [(128 + shoulder - 10, 214), (182, 143), (164, 122), (139, 204)],
    ]


def paint_body(index: int) -> Image.Image:
    body_index = index % len(BODY_TYPES)
    pose_index = index // len(BODY_TYPES)
    image = canvas()
    draw = ImageDraw.Draw(image)
    points = torso_points(body_index, pose_index)
    rounded_polygon(draw, points, (42, 55, 74, 255), INK, 5)

    for arm in arm_shapes(body_index, pose_index):
        rounded_polygon(draw, arm, (37, 49, 67, 255), INK, 5)

    sx, sy, _ = pose_offsets(pose_index)
    draw.rounded_rectangle(
        (px(91 + sx), px(174 + sy), px(165 + sx), px(220 + sy)),
        radius=px(18),
        fill=(43, 56, 74, 255),
        outline=INK,
        width=px(5),
    )
    # Cel-shaded lower torso and shoulder highlights.
    draw.polygon(
        scaled_points(
            [
                (118 + sx, 211 + sy),
                (166 + sx, 205 + sy),
                (176 + sx, 356),
                (138 + sx, 370),
            ]
        ),
        fill=(14, 23, 37, 90),
    )
    draw.line(
        scaled_points([(87 + sx, 220), (112 + sx, 205), (141 + sx, 205)]),
        fill=(111, 130, 153, 100),
        width=px(3),
    )
    return finish(image)


def face_mask(draw: ImageDraw.ImageDraw, face_index: int, fill=WHITE) -> None:
    left, top, right, bottom = face_bounds(face_index)
    if face_index == 2:
        draw.polygon(
            scaled_points(
                [
                    (left + 9, top + 13),
                    (right - 9, top + 13),
                    (right, 103),
                    (159, 161),
                    (128, bottom),
                    (96, 161),
                    (left, 103),
                ]
            ),
            fill=fill,
        )
    else:
        draw.ellipse((px(left), px(top), px(right), px(bottom)), fill=fill)


def paint_skin(index: int) -> Image.Image:
    face_index = index % len(FACE_SHAPES)
    pose_index = index // len(FACE_SHAPES)
    image = canvas()
    draw = ImageDraw.Draw(image)
    sx, sy, _ = pose_offsets(pose_index)

    # The face remains at a stable anchor so eye/hair parts align across poses.
    face_mask(draw, face_index)
    draw.ellipse((px(68), px(105), px(91), px(140)), fill=WHITE)
    draw.ellipse((px(165), px(105), px(188), px(140)), fill=WHITE)
    draw.rounded_rectangle(
        (px(108 + sx), px(162 + sy), px(148 + sx), px(220 + sy)),
        radius=px(14),
        fill=WHITE,
    )

    # Hands/forearms use pose-specific silhouettes.
    if pose_index == 0:
        draw.rounded_rectangle((px(48), px(267), px(83), px(311)), radius=px(15), fill=WHITE)
        draw.rounded_rectangle((px(173), px(267), px(208), px(311)), radius=px(15), fill=WHITE)
    elif pose_index == 1:
        draw.rounded_rectangle((px(65), px(308), px(87), px(366)), radius=px(11), fill=WHITE)
        draw.rounded_rectangle((px(169), px(308), px(191), px(366)), radius=px(11), fill=WHITE)
    elif pose_index == 2:
        draw.rounded_rectangle((px(43), px(254), px(80), px(296)), radius=px(15), fill=WHITE)
        draw.rounded_rectangle((px(177), px(239), px(211), px(282)), radius=px(15), fill=WHITE)
    else:
        draw.rounded_rectangle((px(68), px(124), px(101), px(166)), radius=px(14), fill=WHITE)
        draw.rounded_rectangle((px(156), px(119), px(190), px(161)), radius=px(14), fill=WHITE)
    return finish(image)


def paint_face_shadow(index: int) -> Image.Image:
    face_index = index % len(FACE_SHAPES)
    image = canvas()
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = face_bounds(face_index)
    draw.pieslice(
        (px(left + 3), px(top + 4), px(right - 2), px(bottom - 2)),
        start=285,
        end=95,
        fill=(33, 42, 58, 47),
    )
    draw.arc(
        (px(112), px(116), px(142), px(154)),
        start=75,
        end=122,
        fill=(68, 55, 53, 135),
        width=px(2.2),
    )
    draw.ellipse((px(100), px(145), px(117), px(151)), fill=(225, 112, 112, 36))
    draw.ellipse((px(139), px(145), px(156), px(151)), fill=(225, 112, 112, 36))
    return finish(image)


def paint_back_hair(index: int) -> Image.Image:
    image = canvas()
    draw = ImageDraw.Draw(image)
    variant = index % len(BACK_HAIR)
    shapes = (
        (73, 42, 183, 164),
        (69, 38, 187, 174),
        (66, 36, 190, 186),
        (76, 39, 180, 170),
        (68, 36, 188, 213),
        (71, 38, 185, 178),
    )
    box = shapes[variant]
    draw.ellipse(tuple(px(value) for value in box), fill=WHITE)
    if variant in (2, 4):
        draw.polygon(
            scaled_points([(76, 119), (68, 218), (101, 180), (128, 207), (155, 180), (188, 218), (180, 116)]),
            fill=WHITE,
        )
    if variant == 5:
        draw.rounded_rectangle((px(69), px(104), px(86), px(177)), radius=px(7), fill=TRANSPARENT)
        draw.rounded_rectangle((px(170), px(104), px(187), px(177)), radius=px(7), fill=TRANSPARENT)
    return finish(image)


def paint_front_hair(index: int) -> Image.Image:
    image = canvas()
    draw = ImageDraw.Draw(image)
    variant = index % len(FRONT_HAIR)
    if variant == 0:  # spikes
        points = [(76, 108), (68, 66), (91, 74), (96, 37), (116, 62), (130, 29), (142, 62), (168, 37), (165, 75), (190, 65), (178, 113)]
        rounded_polygon(draw, points, WHITE)
    elif variant == 1:  # side swept
        draw.pieslice((px(65), px(36), px(191), px(143)), 180, 360, fill=WHITE)
        draw.polygon(scaled_points([(73, 68), (185, 47), (150, 122), (125, 92), (99, 129)]), fill=WHITE)
    elif variant == 2:  # buzz
        draw.pieslice((px(76), px(48), px(180), px(122)), 180, 360, fill=WHITE)
    elif variant == 3:  # curls
        for x, y, r in ((82, 72, 29), (112, 54, 31), (145, 55, 31), (174, 73, 28), (104, 91, 30), (151, 91, 30)):
            draw.ellipse((px(x-r), px(y-r), px(x+r), px(y+r)), fill=WHITE)
    elif variant == 4:  # centre part
        draw.pieslice((px(65), px(35), px(191), px(140)), 180, 360, fill=WHITE)
        draw.polygon(scaled_points([(68, 65), (124, 44), (116, 130), (91, 99)]), fill=WHITE)
        draw.polygon(scaled_points([(188, 65), (132, 44), (140, 130), (165, 99)]), fill=WHITE)
    elif variant == 5:  # shaggy
        rounded_polygon(draw, [(66, 105), (70, 54), (91, 34), (112, 48), (130, 27), (147, 51), (173, 37), (187, 66), (181, 118), (158, 99), (147, 137), (127, 100), (107, 139), (95, 100)], WHITE)
    elif variant == 6:  # undercut
        draw.pieslice((px(72), px(38), px(184), px(133)), 180, 360, fill=WHITE)
        draw.polygon(scaled_points([(82, 65), (177, 43), (146, 120), (119, 96), (95, 121)]), fill=WHITE)
        draw.rectangle((px(72), px(88), px(84), px(131)), fill=WHITE)
    else:  # crew
        draw.pieslice((px(74), px(43), px(182), px(122)), 180, 360, fill=WHITE)
        for x in range(80, 181, 20):
            draw.polygon(scaled_points([(x, 61), (x+8, 39), (x+17, 63)]), fill=WHITE)
    return finish(image)


def expression_row(index: int, styles: int) -> tuple[int, int]:
    return index % styles, index // styles


def paint_eyes(index: int) -> Image.Image:
    style, expression = expression_row(index, len(EYES))
    image = canvas()
    draw = ImageDraw.Draw(image)
    y = (116, 112, 110, 120)[expression]
    tilt = (0, -5, 4, 6)[expression]
    widths = (23, 27, 25, 24, 27, 22)
    heights = (15, 11, 8, 12, 17, 9)
    width = widths[style]
    height = heights[style]
    for side in (-1, 1):
        cx = 128 + side * 31
        top = y - height / 2 + (tilt if side == 1 else -tilt) * 0.18
        box = (px(cx - width / 2), px(top), px(cx + width / 2), px(top + height))
        draw.ellipse(box, fill=(248, 251, 255, 255), outline=INK, width=px(3))
        pupil_x = cx + side * (2 if style in (1, 5) else 0)
        pupil_r = 4.4 if style in (0, 4) else 3.5
        draw.ellipse((px(pupil_x-pupil_r), px(y-pupil_r), px(pupil_x+pupil_r), px(y+pupil_r)), fill=INK)
        draw.ellipse((px(pupil_x-1.2), px(y-2.7), px(pupil_x+1.2), px(y-0.3)), fill=WHITE)
        if expression == 3:
            draw.line(scaled_points([(cx-width/2, y-7), (cx+width/2, y-11 if side == -1 else y-3)]), fill=INK, width=px(3))
    return finish(image)


def paint_brows(index: int) -> Image.Image:
    style, expression = expression_row(index, len(BROWS))
    image = canvas()
    draw = ImageDraw.Draw(image)
    y = (94, 90, 91, 88)[expression]
    widths = (25, 27, 29, 24, 28)
    thickness = (3, 3, 5, 2.5, 4)[style]
    for side in (-1, 1):
        cx = 128 + side * 31
        if expression == 3 or style == 4:
            points = [(cx - widths[style]/2, y + (4 if side == -1 else -4)), (cx + widths[style]/2, y + (-4 if side == -1 else 4))]
        elif style == 1:
            points = [(cx - widths[style]/2, y+2), (cx, y-3), (cx + widths[style]/2, y+1)]
        else:
            points = [(cx - widths[style]/2, y), (cx + widths[style]/2, y + (1 if side == 1 else -1))]
        draw.line(scaled_points(points), fill=INK, width=px(thickness), joint="curve")
    return finish(image)


def paint_mouths(index: int) -> Image.Image:
    style, expression = expression_row(index, len(MOUTHS))
    image = canvas()
    draw = ImageDraw.Draw(image)
    y = 157
    widths = (20, 35, 25, 24, 39)
    width = widths[style]
    if expression == 2 or style == 4:
        draw.arc((px(128-width/2), px(y-7), px(128+width/2), px(y+14)), 8, 172, fill=INK, width=px(3))
        if expression == 2:
            draw.pieslice((px(128-width/2+3), px(y), px(128+width/2-3), px(y+15)), 0, 180, fill=(123, 43, 55, 255))
    elif expression == 3:
        draw.arc((px(128-width/2), px(y-1), px(128+width/2), px(y+15)), 188, 352, fill=INK, width=px(3))
    elif style == 2:
        draw.arc((px(128-width/2), px(y-5), px(128+width/2), px(y+8)), 15, 165, fill=INK_SOFT, width=px(2.5))
    else:
        draw.line(scaled_points([(128-width/2, y), (128+width/2, y)]), fill=INK, width=px(3 if style == 3 else 2.5))
    return finish(image)


def paint_uniform(index: int) -> Image.Image:
    # First 16 tiles are primary masks; next 16 are accent masks.
    accent = index >= 16
    local = index - 16 if accent else index
    pattern_index = local % len(UNIFORM_PATTERNS)
    body_index = local // len(UNIFORM_PATTERNS)
    image = canvas()
    draw = ImageDraw.Draw(image)
    points = torso_points(body_index, 1)
    if not accent:
        rounded_polygon(draw, points, WHITE)
        draw.polygon(scaled_points([(97, 187), (128, 219), (159, 187), (148, 177), (108, 177)]), fill=TRANSPARENT)
    elif pattern_index == 0:
        draw.polygon(scaled_points([(95, 190), (111, 185), (128, 213), (145, 185), (161, 190), (145, 225), (111, 225)]), fill=WHITE)
        draw.rectangle((px(111), px(350), px(145), px(371)), fill=WHITE)
    elif pattern_index == 1:
        draw.polygon(scaled_points([(82, 208), (99, 202), (112, 371), (94, 371)]), fill=WHITE)
        draw.polygon(scaled_points([(174, 208), (157, 202), (144, 371), (162, 371)]), fill=WHITE)
    elif pattern_index == 2:
        draw.line(scaled_points([(79, 228), (128, 274), (177, 228)]), fill=WHITE, width=px(18), joint="curve")
    else:
        draw.polygon(scaled_points([(128, 199), (177, 216), (164, 371), (128, 371)]), fill=WHITE)
    return finish(image)


def paint_accessory(index: int) -> Image.Image:
    accessory_index = index % len(ACCESSORIES)
    pose_index = index // len(ACCESSORIES)
    image = canvas()
    draw = ImageDraw.Draw(image)
    if accessory_index == 0:
        draw.rounded_rectangle((px(173), px(115), px(187), px(145)), radius=px(5), fill=WHITE)
    elif accessory_index == 1:
        draw.polygon(scaled_points([(72, 72), (128, 55), (184, 72), (181, 86), (128, 70), (75, 87)]), fill=WHITE)
    elif accessory_index == 2:
        for cx in (98, 158):
            draw.rounded_rectangle((px(cx-24), px(106), px(cx+24), px(133)), radius=px(9), outline=INK, width=px(4))
        draw.line(scaled_points([(122, 119), (134, 119)]), fill=INK, width=px(4))
    else:
        wrist = ((52, 279), (76, 337), (50, 270), (79, 148))[pose_index]
        draw.rounded_rectangle((px(wrist[0]-13), px(wrist[1]-9), px(wrist[0]+13), px(wrist[1]+9)), radius=px(5), fill=WHITE)
    return finish(image)


def paint_effect(index: int) -> Image.Image:
    image = canvas()
    draw = ImageDraw.Draw(image)
    if index == 0:
        for radius, alpha in ((108, 38), (88, 50), (67, 68)):
            draw.ellipse((px(128-radius), px(178-radius), px(128+radius), px(178+radius)), outline=(255, 179, 54, alpha), width=px(4))
    else:
        for step in range(10):
            angle = step * pi / 5
            x = 128 + cos(angle) * (88 + (step % 2) * 18)
            y = 180 + sin(angle) * (135 + (step % 3) * 10)
            r = 3 + step % 3
            draw.ellipse((px(x-r), px(y-r), px(x+r), px(y+r)), fill=(255, 232, 151, 205))
    return finish(image.filter(ImageFilter.GaussianBlur(radius=0.25)))


def save_atlas(spec: AtlasSpec) -> None:
    rows = (spec.count + COLUMNS - 1) // COLUMNS
    atlas = Image.new("RGBA", (COLUMNS * TILE_WIDTH, rows * TILE_HEIGHT), TRANSPARENT)
    for index in range(spec.count):
        atlas.alpha_composite(spec.painter(index), ((index % COLUMNS) * TILE_WIDTH, (index // COLUMNS) * TILE_HEIGHT))
    output = OUTPUT_ROOT / spec.name
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, "WEBP", lossless=True, method=6, exact=True)
    print(f"generated {output.relative_to(ROOT)} {atlas.width}x{atlas.height} ({spec.count} tiles)")


def main() -> None:
    specs = (
        AtlasSpec("body-atlas.webp", 16, paint_body),
        AtlasSpec("skin-atlas.webp", 16, paint_skin),
        AtlasSpec("face-shadow-atlas.webp", 4, paint_face_shadow),
        AtlasSpec("back-hair-atlas.webp", 6, paint_back_hair),
        AtlasSpec("front-hair-atlas.webp", 8, paint_front_hair),
        AtlasSpec("eyes-atlas.webp", len(EYES) * len(EXPRESSIONS), paint_eyes),
        AtlasSpec("brows-atlas.webp", len(BROWS) * len(EXPRESSIONS), paint_brows),
        AtlasSpec("mouths-atlas.webp", len(MOUTHS) * len(EXPRESSIONS), paint_mouths),
        AtlasSpec("uniform-atlas.webp", 32, paint_uniform),
        AtlasSpec("accessory-atlas.webp", len(ACCESSORIES) * len(POSES), paint_accessory),
        AtlasSpec("effect-atlas.webp", 2, paint_effect),
    )
    for spec in specs:
        save_atlas(spec)


if __name__ == "__main__":
    main()
