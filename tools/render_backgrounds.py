"""Run from the repository root: python tools/render_backgrounds.py.

Requires ffmpeg, Pillow and NumPy. Rebuilds the background styles from waterfall.mp4.
"""

from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT, FPS = 1280, 720, 30
CELL_WIDTH, CELL_HEIGHT = 8, 12
COLUMNS, ROWS = WIDTH // CELL_WIDTH, HEIGHT // CELL_HEIGHT
RAMP = " .,:;i+xX#@"
ASSETS = Path(__file__).resolve().parents[1] / "assets"
FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 12)


def ascii_frame(frame):
    colors = np.asarray(frame.resize((COLUMNS, ROWS), Image.Resampling.BOX))
    luminance = colors @ np.array([0.2126, 0.7152, 0.0722])
    indices = np.clip(luminance / 255 * (len(RAMP) - 1), 0, len(RAMP) - 1).astype(int)
    mask = atlas[indices].transpose(0, 2, 1, 3).reshape(HEIGHT, WIDTH)
    colors = np.repeat(np.repeat(colors, CELL_HEIGHT, axis=0), CELL_WIDTH, axis=1)
    # Keep the photographic detail and original tracking glitches beneath the characters.
    return np.clip(np.asarray(frame) * .35 + colors * (mask[..., None] / 255) * .85, 0, 255).astype(np.uint8)


atlas = []
for character in RAMP:
    tile = Image.new("L", (CELL_WIDTH, CELL_HEIGHT))
    ImageDraw.Draw(tile).text((0, -2), character, font=FONT, fill=255)
    atlas.append(np.asarray(tile))
atlas = np.array(atlas)


def pixel_frame(frame):
    small = frame.resize((128, 72), Image.Resampling.BOX)
    colors = np.round(np.asarray(small) / 51) * 51
    return np.asarray(Image.fromarray(colors.astype(np.uint8)).resize((WIDTH, HEIGHT), Image.Resampling.NEAREST))


def halftone_frame(frame):
    brightness = np.asarray(frame.convert('L').resize((WIDTH // 8, HEIGHT // 8), Image.Resampling.BOX)) / 255
    y, x = np.mgrid[:8, :8]
    distance = (x - 3.5) ** 2 + (y - 3.5) ** 2
    dots = distance < brightness[..., None, None] * 20
    pixels = (dots.transpose(0, 2, 1, 3).reshape(HEIGHT, WIDTH) * 235).astype(np.uint8)
    return np.repeat(pixels[..., None], 3, axis=2)


def render(style, transform):
    decoder = subprocess.Popen([
        "ffmpeg", "-nostdin", "-v", "error", "-i", str(ASSETS / "waterfall.mp4"),
        "-vf", f"fps={FPS},scale={WIDTH}:{HEIGHT}",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], stdout=subprocess.PIPE)
    encoder = subprocess.Popen([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-crf", "20", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(ASSETS / f"waterfall-{style}.mp4"),
    ], stdin=subprocess.PIPE)
    frames = 0
    changed = False
    first = None
    try:
        while raw := decoder.stdout.read(WIDTH * HEIGHT * 3):
            assert len(raw) == WIDTH * HEIGHT * 3, "Incomplete source frame"
            output = transform(Image.frombytes("RGB", (WIDTH, HEIGHT), raw))
            if first is None:
                first = output.copy()
                Image.fromarray(output).save(ASSETS / f"waterfall-{style}.webp")
            else:
                changed |= not np.array_equal(first, output)
            encoder.stdin.write(output.tobytes())
            frames += 1
    finally:
        decoder.stdout.close()
        encoder.stdin.close()
        decoder_status = decoder.wait()
        encoder_status = encoder.wait()
    assert decoder_status == encoder_status == 0, "Video conversion failed"
    assert frames > FPS and changed, "Output must contain moving frames"
    print(f"Verified {style}: {frames} frames, {frames / FPS:.2f}s, with motion.", flush=True)


if __name__ == "__main__":
    for style, transform in [('ascii', ascii_frame), ('pixel', pixel_frame), ('halftone', halftone_frame)]:
        render(style, transform)
