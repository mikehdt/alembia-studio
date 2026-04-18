"""ai-toolkit training provider that drives the UI's HTTP API.

Instead of spawning `run.py` directly and scraping stderr (see
`ai_toolkit.py` for that approach — kept around as a template for the
future Kohya / Musubi providers), this provider talks to ai-toolkit's
own web server. Benefits:

  * structured progress (step / status / info / speed_string) via
    `GET /api/jobs?id=...` — no tqdm regex
  * graceful cancel via `GET /api/jobs/<id>/stop`
  * loss / log / sample-image history surfaced by ai-toolkit's API
  * insulated from their SQLite schema — the HTTP API is the contract

Requires the ai-toolkit UI server to be running, managed by
`ai_toolkit_server.AiToolkitServer`.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Optional

import httpx

from ai_toolkit_server import AiToolkitServer
from models import JobProgress, JobStatus, StartJobRequest
from providers.ai_toolkit import (
    SUPPORTED_MODELS,
    _find_model,
    _first_resolution,
    _steps_per_epoch,
)
from providers.base import TrainingProvider

POLL_INTERVAL_SECONDS = 1.0
TERMINAL_STATUSES = {"completed", "stopped", "error"}


class AiToolkitUiProvider(TrainingProvider):
    """ai-toolkit provider that uses the UI server's HTTP API."""

    def __init__(self, toolkit_path: str, server: AiToolkitServer):
        self._toolkit_path = Path(toolkit_path)
        self._server = server
        # Tracked so cancel_training can stop the in-flight job without
        # the caller having to thread the id back through.
        self._current_job_id: Optional[str] = None

    async def validate_environment(self) -> tuple[bool, Optional[str]]:
        ui_dir = self._toolkit_path / "ui"
        if not ui_dir.exists():
            return False, f"ai-toolkit UI not found at {ui_dir}"
        return True, None

    async def generate_config(
        self, request: StartJobRequest, config_dir: str
    ) -> str:
        """Return a stub path. The real config is sent to the API in
        start_training as JSON; ai-toolkit's worker writes it to disk
        itself. We don't need to materialise a YAML file."""
        return ""

    async def start_training(
        self, request: StartJobRequest, config_path: str
    ) -> AsyncGenerator[JobProgress, None]:
        # The local job_id used by the parent JobManager is opaque to us;
        # ai-toolkit assigns its own id when we POST /api/jobs. We use
        # the parent id as the human-readable name and remember the
        # ai-toolkit id for polling/cancel.
        local_job_id = request.output_name

        # Accumulate a log tail as we progress through setup so the UI
        # can surface what the sidecar is actually doing during the
        # pre-training window (which can take a minute+ the first time
        # ai-toolkit's server cold-starts).
        log_tail: list[str] = []

        def _emit(label: str) -> JobProgress:
            log_tail.append(label)
            return JobProgress(
                job_id=local_job_id,
                status=JobStatus.PREPARING,
                log_lines=log_tail[-50:],
            )

        yield _emit("Starting ai-toolkit server...")
        await self._server.ensure_running()
        yield _emit("ai-toolkit server ready")

        config_dict = _build_config_dict(request)
        # Unique name — ai-toolkit's `name` column is a unique key, so a
        # second run with the same output_name would 409. Append a short
        # suffix; the user-facing label still comes from request.output_name.
        unique_name = f"{request.output_name}-{uuid.uuid4().hex[:8]}"

        async with httpx.AsyncClient(
            base_url=self._server.base_url, timeout=30.0
        ) as client:
            yield _emit("Submitting job to ai-toolkit...")
            # 1. Create the job row
            create_res = await client.post(
                "/api/jobs",
                json={
                    "name": unique_name,
                    "gpu_ids": "0",
                    "job_config": config_dict,
                },
            )
            if create_res.status_code >= 400:
                raise RuntimeError(
                    f"ai-toolkit /api/jobs returned {create_res.status_code}: "
                    f"{create_res.text[:300]}"
                )
            created = create_res.json()
            aitk_id: str = created["id"]
            self._current_job_id = aitk_id

            yield _emit(f"Job created: {aitk_id}")

            # 2. Queue the job
            start_res = await client.get(f"/api/jobs/{aitk_id}/start")
            if start_res.status_code >= 400:
                raise RuntimeError(
                    f"ai-toolkit /api/jobs/{aitk_id}/start returned "
                    f"{start_res.status_code}: {start_res.text[:300]}"
                )

            # 3. Make sure the queue itself is running. ai-toolkit's Queue
            # rows have an `is_running` flag; if it's false the worker
            # ignores queued jobs forever ("Queue Stopped" in their UI).
            # /api/queue/<gpu_ids>/start flips it to true (or creates the
            # row already-running).
            queue_res = await client.get("/api/queue/0/start")
            if queue_res.status_code >= 400:
                raise RuntimeError(
                    f"ai-toolkit /api/queue/0/start returned "
                    f"{queue_res.status_code}: {queue_res.text[:300]}"
                )

            yield _emit("Waiting for worker to pick up job...")

            # 4. Poll the job row until terminal. We keep the log_tail we
            # already built up during setup so the UI doesn't lose context
            # when the polling phase starts.
            total_steps = int(request.hyperparameters.get("steps", 0)) or 0
            sample_paths: list[str] = []
            last_step = -1
            last_status_label = ""

            while True:
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                res = await client.get("/api/jobs", params={"id": aitk_id})
                if res.status_code != 200:
                    # Transient — keep polling.
                    continue
                row = res.json()
                if row is None:
                    # Job vanished (deleted out from under us).
                    yield JobProgress(
                        job_id=local_job_id,
                        status=JobStatus.FAILED,
                        error="ai-toolkit job row disappeared",
                    )
                    break

                aitk_status: str = row.get("status", "")
                step: int = row.get("step", 0) or 0
                info: str = row.get("info", "") or ""
                speed: str = row.get("speed_string", "") or ""

                if info and info != last_status_label:
                    log_tail.append(info)
                    del log_tail[:-50]
                    last_status_label = info

                if aitk_status in ("queued", "starting"):
                    yield JobProgress(
                        job_id=local_job_id,
                        status=JobStatus.PREPARING,
                        log_lines=log_tail[-50:],
                    )
                elif aitk_status == "running":
                    if step != last_step or info != last_status_label:
                        last_step = step
                        # ai-toolkit's `step` updates only after training
                        # has begun. Until then, keep emitting PREPARING.
                        if step <= 0:
                            yield JobProgress(
                                job_id=local_job_id,
                                status=JobStatus.PREPARING,
                                log_lines=log_tail,
                            )
                        else:
                            loss, lr, eta = _parse_speed_string(speed)
                            yield JobProgress(
                                job_id=local_job_id,
                                status=JobStatus.TRAINING,
                                current_step=step,
                                total_steps=total_steps,
                                loss=loss,
                                learning_rate=lr,
                                eta_seconds=eta,
                                sample_image_paths=sample_paths,
                                log_lines=log_tail,
                            )
                elif aitk_status in TERMINAL_STATUSES:
                    final_status = (
                        JobStatus.COMPLETED
                        if aitk_status == "completed"
                        else JobStatus.CANCELLED
                        if aitk_status == "stopped"
                        else JobStatus.FAILED
                    )
                    yield JobProgress(
                        job_id=local_job_id,
                        status=final_status,
                        current_step=step,
                        total_steps=total_steps,
                        error=info if final_status == JobStatus.FAILED else None,
                        log_lines=log_tail,
                    )
                    break

            self._current_job_id = None

    async def cancel_training(self) -> None:
        if not self._current_job_id:
            return
        try:
            async with httpx.AsyncClient(
                base_url=self._server.base_url, timeout=10.0
            ) as client:
                await client.get(f"/api/jobs/{self._current_job_id}/stop")
        except httpx.HTTPError as err:
            print(f"[ai-toolkit-ui] cancel failed: {err}")

    def get_supported_models(self) -> list[dict]:
        return [
            {"id": m["id"], "name": m["name"], "architecture": m["architecture"]}
            for m in SUPPORTED_MODELS
        ]


# ---------------------------------------------------------------------------
# Config builder (mirrors providers/ai_toolkit.py but emits ui_trainer)
# ---------------------------------------------------------------------------


def _build_config_dict(request: StartJobRequest) -> dict:
    """Build the ai-toolkit job_config dict — same shape as the YAML the
    CLI provider emits, but with `process[0].type = ui_trainer` so
    UITrainer is selected and writes step/info to the DB.

    ai-toolkit's worker injects `sqlite_db_path` itself before spawning,
    so we don't need to set that here.
    """
    model_def = _find_model(request.base_model)
    if model_def is None:
        raise ValueError(f"Unknown model: {request.base_model}")

    hp = request.hyperparameters
    defaults = model_def["train_defaults"]

    return {
        "job": "extension",
        "config": {
            "name": request.output_name,
            "process": [
                {
                    "type": "ui_trainer",
                    "training_folder": request.output_path,
                    "device": "cuda:0",
                    "network": {
                        "type": hp.get("network_type", "lora"),
                        "linear": hp.get("network_dim", 16),
                        "linear_alpha": hp.get("network_alpha", 16),
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
                        "max_step_saves_to_keep": (
                            hp["max_saves_to_keep"]
                            if hp.get("max_saves_to_keep", 4) > 0
                            else 10_000
                        ),
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
                            "network_weight": ds.lora_weight,
                            "is_reg": ds.is_regularization,
                        }
                        for ds in request.datasets
                    ],
                    "train": {
                        "batch_size": hp.get("batch_size", 1),
                        "steps": hp.get("steps", defaults.get("steps", 2000)),
                        # Force start_step=0 (unless the user explicitly
                        # opted into resume). Without this, ai-toolkit
                        # auto-loads training_info.step from any existing
                        # safetensors in the output dir — so a re-run with
                        # the same output_name silently inherits the prior
                        # run's step counter, often skipping training
                        # entirely (range(prev_step, new_steps) → empty).
                        "start_step": 0
                        if not hp.get("resume_state")
                        else None,
                        "gradient_accumulation_steps": hp.get(
                            "gradient_accumulation_steps", 1
                        ),
                        "train_unet": True,
                        "train_text_encoder": hp.get("train_text_encoder", False),
                        "gradient_checkpointing": True,
                        "noise_scheduler": defaults.get("noise_scheduler", "flowmatch"),
                        "optimizer": hp.get(
                            "optimizer", defaults.get("optimizer", "adamw8bit")
                        ),
                        "lr": hp.get("lr", defaults.get("lr", 1e-4)),
                        **(
                            {"lr_unet": hp["backbone_lr"]}
                            if hp.get("backbone_lr", 0) > 0
                            else {}
                        ),
                        **(
                            {"lr_text_encoder": hp["text_encoder_lr"]}
                            if hp.get("text_encoder_lr", 0) > 0
                            else {}
                        ),
                        "dtype": hp.get(
                            "mixed_precision", defaults.get("dtype", "bf16")
                        ),
                        "max_grad_norm": hp.get("max_grad_norm", 1.0),
                        **(
                            {"ema_config": {"use_ema": True, "ema_decay": 0.99}}
                            if hp.get("ema", False)
                            else {}
                        ),
                        "loss_type": hp.get("loss_type", "mse"),
                        "timestep_type": hp.get("timestep_type", "sigmoid"),
                        "timestep_bias": hp.get("timestep_bias", "balanced"),
                        "cache_text_embeddings": hp.get(
                            "cache_text_embeddings", False
                        ),
                        "unload_text_encoder": hp.get("unload_text_encoder", False),
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
                        "quantize": hp.get(
                            "transformer_quantization", "float8"
                        ) == "float8",
                        "quantize_te": hp.get(
                            "text_encoder_quantization", "float8"
                        ) == "float8",
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
                                "guidance_scale": defaults.get("guidance_scale", 4),
                                "sample_steps": defaults.get("sample_steps", 20),
                            },
                        }
                        if request.sample_prompts
                        else {}
                    ),
                }
            ],
            "meta": {"name": request.output_name, "version": "1.0"},
        },
    }


def _parse_speed_string(s: str) -> tuple[Optional[float], Optional[float], Optional[int]]:
    """Pick out loss / lr / eta from ai-toolkit's `speed_string` field
    if present. Format varies — best-effort parse, returns None where
    unrecognised. Don't rely on these being populated."""
    import re

    if not s:
        return None, None, None
    loss_m = re.search(r"loss:\s*([\d.eE+-]+)", s)
    lr_m = re.search(r"lr:\s*([\d.eE+-]+)", s)
    eta_m = re.search(r"(?:eta|ETA)[:\s]+(\d+)", s)
    return (
        float(loss_m.group(1)) if loss_m else None,
        float(lr_m.group(1)) if lr_m else None,
        int(eta_m.group(1)) if eta_m else None,
    )
