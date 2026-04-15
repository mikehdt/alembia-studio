"""ai-toolkit (Ostris) training provider.

Spawns training as a subprocess via ai-toolkit's run.py, generates YAML configs,
and parses tqdm stdout for progress updates.
"""

import asyncio
import os
import re
import signal
import sys
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Optional

import yaml

from models import JobProgress, JobStatus, StartJobRequest
from providers.base import TrainingProvider

# Regex to parse tqdm progress output:
# my_lora:  25%|███| 500/2000 [05:30<15:30, 1.50it/s] lr: 1.0e-04 loss: 8.532e-02
TQDM_PATTERN = re.compile(
    r"(\d+)/(\d+)\s+"  # current/total steps
    r"\[([^\]]+)\]\s*"  # elapsed<remaining
    r"(.*)"  # postfix (lr, loss, etc.)
)

LOSS_PATTERN = re.compile(r"loss:\s*([\d.eE+-]+)")
LR_PATTERN = re.compile(r"lr:\s*([\d.eE+-]+)")
ETA_PATTERN = re.compile(r"<(\d+):(\d+):?(\d*)")


# --- Model definitions ---

SUPPORTED_MODELS = [
    {
        "id": "flux-dev",
        "name": "Flux.1 Dev",
        "architecture": "flux",
        "model_path": "black-forest-labs/FLUX.1-dev",
        "config": {"arch": "flux", "quantize": True},
        "train_defaults": {
            "noise_scheduler": "flowmatch",
            "optimizer": "adamw8bit",
            "lr": 1e-4,
            "dtype": "bf16",
            "resolution": [512, 768, 1024],
            "steps": 2000,
            "guidance_scale": 4,
            "sample_steps": 20,
        },
    },
    {
        "id": "flux-schnell",
        "name": "Flux.1 Schnell",
        "architecture": "flux",
        "model_path": "black-forest-labs/FLUX.1-schnell",
        "config": {"arch": "flux", "quantize": True},
        "train_defaults": {
            "noise_scheduler": "flowmatch",
            "optimizer": "adamw8bit",
            "lr": 1e-4,
            "dtype": "bf16",
            "resolution": [512, 768, 1024],
            "steps": 1500,
            "guidance_scale": 1,
            "sample_steps": 4,
        },
    },
    {
        "id": "sdxl",
        "name": "Stable Diffusion XL",
        "architecture": "sdxl",
        "model_path": "stabilityai/stable-diffusion-xl-base-1.0",
        "config": {"arch": "sdxl"},
        "train_defaults": {
            "noise_scheduler": "ddpm",
            "optimizer": "adamw8bit",
            "lr": 1e-4,
            "dtype": "bf16",
            "resolution": [1024],
            "steps": 3000,
            "guidance_scale": 7,
            "sample_steps": 25,
        },
    },
    {
        "id": "zimage-turbo",
        "name": "Z-Image Turbo",
        "architecture": "zimage",
        "model_path": "Tongyi-MAI/Z-Image-Turbo",
        "config": {"arch": "zimage"},
        "train_defaults": {
            "noise_scheduler": "flowmatch",
            "optimizer": "adamw8bit",
            "lr": 1e-4,
            "dtype": "bf16",
            "resolution": [512, 768, 1024],
            "steps": 2000,
            "guidance_scale": 4,
            "sample_steps": 8,
        },
    },
    {
        "id": "wan22-14b",
        "name": "Wan 2.2 14B",
        "architecture": "wan22_14b",
        "model_path": "ai-toolkit/Wan2.2-T2V-A14B-Diffusers-bf16",
        "config": {"arch": "wan22_14b"},
        "train_defaults": {
            "noise_scheduler": "flowmatch",
            "optimizer": "adamw8bit",
            "lr": 2e-4,
            "dtype": "bf16",
            "resolution": [512, 768],
            "steps": 2000,
            "guidance_scale": 4,
            "sample_steps": 20,
        },
    },
    {
        "id": "ltx2",
        "name": "LTX-Video 2",
        "architecture": "ltx2",
        "model_path": "Lightricks/LTX-Video-0.9.7-dev",
        "config": {"arch": "ltx2"},
        "train_defaults": {
            "noise_scheduler": "flowmatch",
            "optimizer": "adamw8bit",
            "lr": 1e-4,
            "dtype": "bf16",
            "resolution": [512, 768],
            "steps": 2000,
            "guidance_scale": 4,
            "sample_steps": 20,
        },
    },
]


def _find_model(model_id: str) -> Optional[dict]:
    for m in SUPPORTED_MODELS:
        if m["id"] == model_id:
            return m
    return None


def _parse_eta_seconds(eta_str: str) -> Optional[int]:
    """Parse tqdm ETA string like '15:30' or '1:15:30' into seconds."""
    match = ETA_PATTERN.search(eta_str)
    if not match:
        return None
    parts = [int(p) for p in match.groups() if p]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


class AiToolkitProvider(TrainingProvider):
    """Training provider backed by ostris/ai-toolkit."""

    def __init__(self, toolkit_path: str):
        self._toolkit_path = Path(toolkit_path)
        self._process: Optional[asyncio.subprocess.Process] = None

    async def validate_environment(self) -> tuple[bool, Optional[str]]:
        run_py = self._toolkit_path / "run.py"
        if not run_py.exists():
            return False, f"ai-toolkit not found at {self._toolkit_path} (missing run.py)"

        toolkit_init = self._toolkit_path / "toolkit" / "job.py"
        if not toolkit_init.exists():
            return False, f"ai-toolkit installation appears incomplete (missing toolkit/job.py)"

        return True, None

    async def generate_config(
        self, request: StartJobRequest, config_dir: str
    ) -> str:
        model_def = _find_model(request.base_model)
        if model_def is None:
            raise ValueError(f"Unknown model: {request.base_model}")

        hp = request.hyperparameters
        defaults = model_def["train_defaults"]

        # Build the ai-toolkit YAML config
        config = {
            "job": "extension",
            "config": {
                "name": request.output_name,
                "process": [
                    {
                        "type": "sd_trainer",
                        "training_folder": request.output_path,
                        "device": "cuda:0",
                        "network": {
                            "type": hp.get("network_type", "lora"),
                            "linear": hp.get("network_dim", 16),
                            "linear_alpha": hp.get("network_alpha", 16),
                            # network_dropout defaults to 0 (disabled); only
                            # emit when the user explicitly set it
                            **(
                                {"dropout": hp.get("network_dropout")}
                                if hp.get("network_dropout", 0) > 0
                                else {}
                            ),
                        },
                        "save": {
                            "dtype": "float16",
                            "save_every": _steps_per_epoch(
                                hp.get("save_every_n_epochs", 1),
                                hp.get("epochs", 10),
                                hp.get("steps", defaults.get("steps", 2000)),
                            ),
                            # save_only_last → keep exactly 1 step checkpoint;
                            # otherwise keep a rolling window of 4.
                            "max_step_saves_to_keep": 1
                            if hp.get("save_only_last", False)
                            else 4,
                            # Full training state snapshot so runs can resume.
                            "save_state": hp.get("save_state", False),
                        },
                        "datasets": [
                            {
                                "folder_path": ds.path,
                                "caption_ext": "txt",
                                "caption_dropout_rate": 0.05,
                                "shuffle_tokens": False,
                                "cache_latents_to_disk": True,
                                "resolution": hp.get(
                                    "resolution", defaults.get("resolution", [1024])
                                ),
                                "num_repeats": ds.num_repeats,
                                "keep_tokens": hp.get("keep_tokens", 0),
                            }
                            for ds in request.datasets
                        ],
                        "train": {
                            "batch_size": hp.get("batch_size", 1),
                            "steps": hp.get("steps", defaults.get("steps", 2000)),
                            "gradient_accumulation_steps": hp.get(
                                "gradient_accumulation_steps", 1
                            ),
                            "train_unet": True,
                            "train_text_encoder": False,
                            "gradient_checkpointing": True,
                            "noise_scheduler": defaults.get(
                                "noise_scheduler", "flowmatch"
                            ),
                            "optimizer": hp.get(
                                "optimizer", defaults.get("optimizer", "adamw8bit")
                            ),
                            "lr": hp.get("lr", defaults.get("lr", 1e-4)),
                            "dtype": hp.get(
                                "mixed_precision", defaults.get("dtype", "bf16")
                            ),
                            "max_grad_norm": hp.get("max_grad_norm", 1.0),
                            # Point at a previously saved training-state dir
                            # to continue from where a prior run left off.
                            **(
                                {"resume_from_checkpoint": hp.get("resume_state")}
                                if hp.get("resume_state")
                                else {}
                            ),
                        },
                        "model": {
                            "name_or_path": hp.get(
                                "model_path", model_def["model_path"]
                            ),
                            **model_def["config"],
                        },
                        **(
                            {
                                "sample": {
                                    "sampler": defaults.get(
                                        "noise_scheduler", "flowmatch"
                                    ),
                                    "sample_every": hp.get(
                                        "sample_every_n_steps", 250
                                    ),
                                    "width": _first_resolution(hp, defaults),
                                    "height": _first_resolution(hp, defaults),
                                    "prompts": request.sample_prompts,
                                    "seed": 42,
                                    "walk_seed": True,
                                    "guidance_scale": defaults.get(
                                        "guidance_scale", 4
                                    ),
                                    "sample_steps": defaults.get("sample_steps", 20),
                                },
                            }
                            if request.sample_prompts
                            else {}
                        ),
                    }
                ],
            },
            "meta": {"name": request.output_name, "version": "1.0"},
        }

        config_path = os.path.join(config_dir, f"{request.output_name}.yaml")
        with open(config_path, "w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)

        return config_path

    async def start_training(
        self, request: StartJobRequest, config_path: str
    ) -> AsyncGenerator[JobProgress, None]:
        job_id = request.output_name  # Will be overridden by caller with real job ID

        # Find the Python executable — prefer the ai-toolkit venv
        python_exe = _find_python(self._toolkit_path)
        run_py = str(self._toolkit_path / "run.py")

        self._process = await asyncio.create_subprocess_exec(
            python_exe,
            "-u",
            run_py,
            config_path,
            cwd=str(self._toolkit_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )

        # Yield preparing status
        yield JobProgress(job_id=job_id, status=JobStatus.PREPARING)

        log_lines: list[str] = []
        sample_paths: list[str] = []

        async def read_stream(
            stream: asyncio.StreamReader, is_stderr: bool = False
        ):
            """Read lines from a stream, handling tqdm's CR-based updates."""
            buffer = ""
            while True:
                chunk = await stream.read(256)
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="replace")
                buffer += text
                # tqdm uses \r for progress updates, \n for log lines
                while "\r" in buffer or "\n" in buffer:
                    # Split on either \r or \n
                    for sep in ["\n", "\r"]:
                        if sep in buffer:
                            line, buffer = buffer.split(sep, 1)
                            line = line.strip()
                            if line:
                                yield line
                            break

        # Read stdout for progress, stderr for logs
        async for line in read_stream(self._process.stdout):
            # Try to parse tqdm progress
            match = TQDM_PATTERN.search(line)
            if match:
                current_step = int(match.group(1))
                total_steps = int(match.group(2))
                time_info = match.group(3)
                postfix = match.group(4)

                loss_match = LOSS_PATTERN.search(postfix)
                lr_match = LR_PATTERN.search(postfix)
                eta = _parse_eta_seconds(time_info)

                yield JobProgress(
                    job_id=job_id,
                    status=JobStatus.TRAINING,
                    current_step=current_step,
                    total_steps=total_steps,
                    loss=float(loss_match.group(1)) if loss_match else None,
                    learning_rate=float(lr_match.group(1)) if lr_match else None,
                    eta_seconds=eta,
                    sample_image_paths=sample_paths,
                    log_lines=log_lines[-50:],  # Keep last 50 lines
                )
            else:
                # Non-progress line — add to log
                log_lines.append(line)

                # Check for sample image saves
                if "sample" in line.lower() and (
                    line.endswith(".png") or line.endswith(".jpg")
                ):
                    sample_paths.append(line.strip())

        # Wait for process to finish
        return_code = await self._process.wait()
        self._process = None

        if return_code == 0:
            yield JobProgress(
                job_id=job_id,
                status=JobStatus.COMPLETED,
                log_lines=log_lines[-50:],
                sample_image_paths=sample_paths,
            )
        else:
            # Collect stderr for error message
            stderr_lines = []
            if self._process is None:
                # Process already finished, stderr was not read
                pass
            yield JobProgress(
                job_id=job_id,
                status=JobStatus.FAILED,
                error=f"Training process exited with code {return_code}",
                log_lines=log_lines[-50:],
            )

    async def cancel_training(self) -> None:
        if self._process is None:
            return

        if sys.platform == "win32":
            # On Windows, kill the process tree
            os.system(f"taskkill /F /T /PID {self._process.pid}")
        else:
            self._process.send_signal(signal.SIGTERM)

        try:
            await asyncio.wait_for(self._process.wait(), timeout=10)
        except asyncio.TimeoutError:
            self._process.kill()

        self._process = None

    def get_supported_models(self) -> list[dict]:
        return [
            {"id": m["id"], "name": m["name"], "architecture": m["architecture"]}
            for m in SUPPORTED_MODELS
        ]


# --- Helpers ---


def _steps_per_epoch(save_every_n_epochs: int, epochs: int, total_steps: int) -> int:
    """Convert save-every-N-epochs to save-every-N-steps."""
    if epochs <= 0:
        return total_steps
    steps_per_epoch = total_steps // epochs
    return max(1, steps_per_epoch * save_every_n_epochs)


def _first_resolution(hp: dict, defaults: dict) -> int:
    """Get the first (largest) resolution value for sample generation."""
    res = hp.get("resolution", defaults.get("resolution", [1024]))
    if isinstance(res, list):
        return max(res) if res else 1024
    return int(res)


def _find_python(toolkit_path: Path) -> str:
    """Find the Python executable for ai-toolkit's environment."""
    if sys.platform == "win32":
        candidates = [
            toolkit_path / "venv" / "Scripts" / "python.exe",
            toolkit_path / ".venv" / "Scripts" / "python.exe",
        ]
    else:
        candidates = [
            toolkit_path / "venv" / "bin" / "python",
            toolkit_path / ".venv" / "bin" / "python",
        ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    # Fall back to system python
    return sys.executable
