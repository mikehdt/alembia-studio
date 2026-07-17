"""
Image preprocessing shared by the captioning providers.

Downscaling is not an optimisation here — it's a correctness guard. Qwen-VL
turns every 32x32 block of source pixels into one visual token (patch_size 16
x merge_size 2), and attention cost grows with the square of that token count.
A 3000x3000 image is ~8800 tokens and exhausts 16GB of VRAM during the
forward pass. Where NVIDIA's sysmem fallback is enabled the driver spills to
system RAM instead of raising, so the symptom is inference crawling to a halt
rather than a clean OOM — which is why this went unnoticed for so long.

The model's own preprocessor_config.json would normally clamp this, but the
shipped Qwen3-VL config disables it (`max_pixels: null`, `longest_edge:
16777216` — a ~16k-token ceiling), so the cap has to live on our side.
"""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image as PILImage

# Total pixel budget per image, ~1024 visual tokens at 32x32 px per token.
# Captioning quality is flat above roughly this point — the extra resolution
# buys detail the model doesn't use for scene description — while VRAM cost
# keeps climbing. The video path applies the same idea per frame with a
# tighter budget (see VLM_VIDEO_QUALITY_PIXELS in the Node types).
MAX_IMAGE_PIXELS = 1024 * 1024


def downscale_to_pixel_budget(
    image: "PILImage.Image",
    max_pixels: int = MAX_IMAGE_PIXELS,
) -> "PILImage.Image":
    """
    Shrink `image` so w*h <= max_pixels, preserving aspect ratio.

    Images already within budget are returned untouched — no re-encode, no
    quality loss. Never upscales.
    """
    from PIL import Image

    width, height = image.size
    pixels = width * height
    if pixels <= max_pixels or pixels == 0:
        return image

    scale = (max_pixels / pixels) ** 0.5
    # floor() can land on 0 for extreme aspect ratios; clamp to a valid edge.
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))

    print(
        f"[image_prep] downscaling {width}x{height} -> "
        f"{new_size[0]}x{new_size[1]} ({pixels / 1e6:.1f}MP over "
        f"{max_pixels / 1e6:.1f}MP budget)",
        file=sys.stderr,
    )

    return image.resize(new_size, Image.LANCZOS)
