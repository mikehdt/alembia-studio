"""
HuggingFace transformers captioning provider.

Loads a vision-language model via `transformers` + PyTorch on CUDA and runs
inference in streaming mode so cancellation can interrupt within a token or two.

Model lifecycle mirrors the llama-cpp provider:
- Lazily loaded on first caption request
- Cached between requests for the same model directory
- Released on unload() (frees GPU memory)

Loading strategy: fp16, device_map="cuda", no quantization. We explicitly
avoid bitsandbytes here — if a low-VRAM variant is needed it gets its own
model entry in the registry rather than a runtime toggle.

Loading progress surfacing: transformers emits a `Loading checkpoint shards`
tqdm bar while reading safetensors. We monkey-patch the tqdm used by
`transformers.utils.logging` during the load so each step invokes our
on_load_progress callback — giving the UI real per-shard updates instead of
a silent 15-30s spinner.

Known behaviour:
- First call blocks ~10-30s for model load. Subsequent calls reuse the cached
  instance as long as the same model_path keeps coming in.
- `cancel_check` is polled per streamed token. Windows Python can't reliably
  interrupt a single forward pass, so cancel takes effect on the next token
  after the flag flips — usually <100ms on GPU.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import re
import sys
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterator, Optional

from captioning.provider import (
    CancelCheck,
    CaptionCancelled,
    CaptioningProvider,
    LoadProgressCallback,
)

if TYPE_CHECKING:
    from models import VideoSamplingOptions

# File extensions that route through the video branch instead of PIL.
_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}


# Match tqdm's rendered progress line, e.g.
#   "Loading checkpoint shards:  50%|#####     | 1/2 [00:01<00:01,  1.76s/it]"
# Captures: description, current, total. We don't parse the percent because
# tqdm writes partial redraws with \r and we'd rather key on the step counter.
_TQDM_LINE_RE = re.compile(
    r"(?P<desc>[^\r\n:]+?):\s*\d+%\|[^|]*\|\s*(?P<cur>\d+)/(?P<tot>\d+)"
)


class _TqdmStderrHook:
    """
    Wraps sys.stderr so tqdm progress lines flow through a progress callback.

    tqdm writes its bars to stderr with \\r carriage returns for in-place
    updates. We pass writes through to the real stderr unchanged (so the
    terminal still shows the live bar) and additionally scan each write for
    a tqdm-formatted progress line — when we find one we fire our callback.

    This is version-independent: it works with whichever tqdm transformers
    happens to use, as long as the output format matches the regex. If the
    regex ever stops matching we just stop sending per-shard updates — the
    load itself still succeeds, and the pre/post messages around it still
    fire to keep the UI alive.
    """

    def __init__(
        self,
        original: Any,
        on_load_progress: LoadProgressCallback,
    ) -> None:
        self._original = original
        self._callback = on_load_progress
        self._last_key: Optional[tuple[str, int, int]] = None
        self._last_time = 0.0

    def write(self, data: Any) -> int:
        try:
            written = self._original.write(data)
        except Exception:
            written = 0

        if not isinstance(data, str):
            return written

        # tqdm flushes the same line multiple times with \r. Split on both
        # \r and \n so we see the latest state rather than the accumulated one.
        for chunk in re.split(r"[\r\n]", data):
            if not chunk:
                continue
            match = _TQDM_LINE_RE.search(chunk)
            if not match:
                continue
            desc = match.group("desc").strip() or "Loading model"
            current = int(match.group("cur"))
            total = int(match.group("tot"))
            key = (desc, current, total)
            if key == self._last_key:
                continue
            # Rate-limit broadcasts so rapid tqdm updates don't flood the
            # WebSocket. One update per 100ms is plenty for a ~2s shard load.
            now = time.monotonic()
            if now - self._last_time < 0.1 and current != total:
                continue
            self._last_key = key
            self._last_time = now
            try:
                self._callback(desc, current, total)
            except Exception:
                # Never let a broken callback break the load.
                pass

        return written

    def flush(self) -> None:
        try:
            self._original.flush()
        except Exception:
            pass

    def __getattr__(self, name: str) -> Any:
        # Forward anything else (isatty, fileno, encoding, ...) to the
        # underlying stream so libraries that probe stderr still work.
        return getattr(self._original, name)


@contextlib.contextmanager
def _broadcast_tqdm(
    on_load_progress: Optional[LoadProgressCallback],
) -> Iterator[None]:
    """
    During the blocking `from_pretrained` call, wrap sys.stderr so tqdm
    progress lines get forwarded to `on_load_progress`. No monkey-patching
    of transformers or huggingface_hub internals — we just observe the
    bytes tqdm writes.
    """
    if on_load_progress is None:
        yield
        return

    original_stderr = sys.stderr
    sys.stderr = _TqdmStderrHook(original_stderr, on_load_progress)  # type: ignore[assignment]
    try:
        yield
    finally:
        sys.stderr = original_stderr


class TransformersCaptioningProvider(CaptioningProvider):
    """Real VLM captioning via HuggingFace transformers + PyTorch CUDA."""

    def __init__(self) -> None:
        self._model: Optional[Any] = None
        self._processor: Optional[Any] = None
        self._loaded_model_path: Optional[str] = None
        # Serialise all torch operations behind an async lock — the model is
        # not safe for concurrent forward passes, and cheaply queueing requests
        # is fine given batches are sequential anyway.
        self._lock = asyncio.Lock()

    def _load_model(
        self,
        model_path: str,
        on_load_progress: Optional[LoadProgressCallback] = None,
    ) -> None:
        """Load the model and processor. Blocking; runs in an executor."""
        # Imports inside the function so the sidecar boots cleanly even when
        # the gpu extra isn't installed.
        import torch
        from transformers import AutoModelForImageTextToText, AutoProcessor

        if self._model is not None and self._loaded_model_path == model_path:
            return

        # Release any previous instance before loading the next.
        if self._model is not None:
            try:
                del self._model
            except Exception:
                pass
            self._model = None
            self._processor = None
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass

        if not torch.cuda.is_available():
            raise RuntimeError(
                "transformers VLM provider requires CUDA. "
                "Install the 'gpu' extra and ensure an NVIDIA GPU is present, "
                "or pick a GGUF (llama-cpp) model instead."
            )

        model_dir = Path(model_path)
        if not model_dir.exists():
            raise FileNotFoundError(
                f"Model directory not found: {model_path}. "
                "Download the model via the Model Manager first."
            )

        if on_load_progress is not None:
            on_load_progress("Reading tokenizer and processor", 0, 0)

        # Qwen2.5/3-VL ship with AutoProcessor + AutoModelForImageTextToText.
        # trust_remote_code=False is intentional — the HF canonical Qwen VL
        # classes have been upstreamed into transformers.
        processor = AutoProcessor.from_pretrained(
            str(model_dir),
            trust_remote_code=False,
        )

        if on_load_progress is not None:
            on_load_progress("Loading checkpoint shards", 0, 0)

        # Patch transformers' tqdm so shard loading pings our callback.
        with _broadcast_tqdm(on_load_progress):
            model = AutoModelForImageTextToText.from_pretrained(
                str(model_dir),
                torch_dtype=torch.float16,
                device_map="cuda",
                trust_remote_code=False,
            )
        model.eval()

        if on_load_progress is not None:
            on_load_progress("Model ready", 1, 1)

        self._model = model
        self._processor = processor
        self._loaded_model_path = model_path

    def _generate_caption_blocking(
        self,
        image_path: str,
        prompt: str,
        max_tokens: int,
        temperature: float,
        cancel_check: Optional[CancelCheck],
    ) -> str:
        """Run streamed inference synchronously inside the lock."""
        import torch
        from PIL import Image
        from transformers import TextIteratorStreamer

        assert self._model is not None and self._processor is not None

        image = Image.open(image_path).convert("RGB")

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        # Qwen VL processors accept the messages structure directly and
        # handle the chat template + image tokenisation in one call.
        inputs = self._processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self._model.device)

        streamer = TextIteratorStreamer(
            self._processor.tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
        )

        generation_kwargs: dict[str, Any] = {
            **inputs,
            "streamer": streamer,
            "max_new_tokens": max_tokens,
            "do_sample": temperature > 0,
            "temperature": max(temperature, 1e-5),
            "pad_token_id": self._processor.tokenizer.eos_token_id,
        }

        # Kick off generation in a background thread so we can iterate the
        # streamer and poll for cancellation in the calling thread.
        gen_thread = threading.Thread(
            target=self._model.generate,
            kwargs=generation_kwargs,
            daemon=True,
        )
        gen_thread.start()

        pieces: list[str] = []
        cancelled = False
        try:
            for chunk in streamer:
                if cancel_check is not None and cancel_check():
                    cancelled = True
                    break
                if chunk:
                    pieces.append(chunk)
        finally:
            # If we bailed early, drain the streamer so the generation thread
            # doesn't block forever pushing into a full queue. Transformers'
            # streamer doesn't expose a cancel hook, so the generate() call
            # itself runs to completion — but on GPU that's usually fast, and
            # the consumer thread returns control to the caller immediately.
            if cancelled:
                for _ in streamer:
                    pass
            gen_thread.join(timeout=60)
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass

        if cancelled:
            raise CaptionCancelled("cancelled mid-inference")

        return "".join(pieces).strip()

    def _generate_video_caption_blocking(
        self,
        video_path: str,
        prompt: str,
        max_tokens: int,
        temperature: float,
        cancel_check: Optional[CancelCheck],
        video_options: Optional["VideoSamplingOptions"],
    ) -> str:
        """
        Run streamed inference on a video file. Mirrors the image path but
        constructs a `video` content message and uses qwen-vl-utils to
        sample frames before tokenization.

        Frame sampling strategy: qwen-vl-utils' `smart_nframes` takes
        `fps` (max sampling rate) and `max_frames` (hard cap). It computes
        `duration * fps` and then clamps that to `max_frames` and to the
        clip's real frame count. This naturally gives:

        - Long clips (where duration*fps > budget): sampled uniformly at
          `budget` frames spread across the full duration.
        - Short clips (where duration*fps < budget): sampled at `fps`,
          with no wasted oversampling.
        - Ultra-short clips: clamped to `total_frames` so we never try to
          read more frames than exist.

        We deliberately do NOT pass `nframes` (which would force exactly
        that count and crash on clips shorter than the budget) — the
        fps + max_frames combo does the right thing in all three regimes.
        """
        import torch
        from qwen_vl_utils import process_vision_info
        from transformers import TextIteratorStreamer

        assert self._model is not None and self._processor is not None

        # Defaults match the Pydantic model — used when the request didn't
        # include a video block at all (single-image API callers).
        frame_budget = video_options.frame_budget if video_options else 32
        max_fps = video_options.max_fps if video_options else 2.0
        max_pixels = video_options.max_pixels if video_options else 360 * 420

        video_content: dict[str, Any] = {
            "type": "video",
            "video": video_path,
            "max_pixels": max_pixels,
            # `fps` here is the sampling rate ceiling — smart_nframes reads
            # it as "at most this many frames per second of video."
            "fps": max_fps,
            # `max_frames` is the hard cap on total sampled frames. When
            # `duration * fps` would exceed the budget, this clamps it.
            "max_frames": frame_budget,
        }

        messages = [
            {
                "role": "user",
                "content": [
                    video_content,
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        # Render the chat template to text. We use tokenize=False here
        # because the processor needs the rendered text *and* the video
        # tensor in the same call, which is a different shape than the
        # image path — the image path lets apply_chat_template do the
        # whole thing in one step, but video needs the explicit
        # process_vision_info call.
        text = self._processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=False,
        )

        # Sample frames + assemble the video tensor. process_vision_info
        # returns (image_inputs, video_inputs, video_kwargs). With
        # return_video_kwargs=True we also get the per-frame fps so the
        # processor can build the correct temporal embeddings.
        image_inputs, video_inputs, video_kwargs = process_vision_info(
            messages, return_video_kwargs=True
        )

        inputs = self._processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            return_tensors="pt",
            **(video_kwargs or {}),
        ).to(self._model.device)

        # Log what we actually sampled so VRAM/quality issues are debuggable.
        try:
            n_frames = (
                video_inputs[0].shape[0] if video_inputs else 0
            )  # T dim of the (T, C, H, W) tensor
            print(
                f"[transformers_provider] video: {os.path.basename(video_path)} "
                f"frames={n_frames} max_pixels={max_pixels} "
                f"budget={frame_budget} max_fps={max_fps}",
                file=sys.stderr,
            )
        except Exception:
            pass

        streamer = TextIteratorStreamer(
            self._processor.tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
        )

        generation_kwargs: dict[str, Any] = {
            **inputs,
            "streamer": streamer,
            "max_new_tokens": max_tokens,
            "do_sample": temperature > 0,
            "temperature": max(temperature, 1e-5),
            "pad_token_id": self._processor.tokenizer.eos_token_id,
        }

        gen_thread = threading.Thread(
            target=self._model.generate,
            kwargs=generation_kwargs,
            daemon=True,
        )
        gen_thread.start()

        pieces: list[str] = []
        cancelled = False
        try:
            for chunk in streamer:
                if cancel_check is not None and cancel_check():
                    cancelled = True
                    break
                if chunk:
                    pieces.append(chunk)
        finally:
            if cancelled:
                for _ in streamer:
                    pass
            gen_thread.join(timeout=120)
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass

        if cancelled:
            raise CaptionCancelled("cancelled mid-inference")

        return "".join(pieces).strip()

    async def prepare(
        self,
        model_path: str,
        on_load_progress: Optional[LoadProgressCallback] = None,
    ) -> None:
        """Pre-load the model so the first caption isn't gated on a cold load."""
        async with self._lock:
            if self._model is None or self._loaded_model_path != model_path:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._load_model, model_path, on_load_progress
                )

    async def caption_image(
        self,
        image_path: str,
        model_path: str,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.7,
        cancel_check: Optional[CancelCheck] = None,
        on_load_progress: Optional[LoadProgressCallback] = None,
        video_options: Optional["VideoSamplingOptions"] = None,
    ) -> str:
        async with self._lock:
            # Normally the batch manager calls `prepare` first, but we also
            # keep a lazy-load path so single-image callers still work.
            if self._model is None or self._loaded_model_path != model_path:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._load_model, model_path, on_load_progress
                )

            ext = os.path.splitext(image_path)[1].lower()
            is_video = ext in _VIDEO_EXTENSIONS

            # Run inference in a thread so the event loop stays free to push
            # WebSocket progress updates to connected clients.
            if is_video:
                return await asyncio.get_event_loop().run_in_executor(
                    None,
                    self._generate_video_caption_blocking,
                    image_path,
                    prompt,
                    max_tokens,
                    temperature,
                    cancel_check,
                    video_options,
                )
            return await asyncio.get_event_loop().run_in_executor(
                None,
                self._generate_caption_blocking,
                image_path,
                prompt,
                max_tokens,
                temperature,
                cancel_check,
            )

    async def unload(self) -> None:
        async with self._lock:
            if self._model is not None:
                try:
                    del self._model
                    del self._processor
                except Exception:
                    pass
                self._model = None
                self._processor = None
                self._loaded_model_path = None
                try:
                    import torch

                    torch.cuda.empty_cache()
                except Exception:
                    pass
