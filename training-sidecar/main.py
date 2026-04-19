"""Training sidecar — FastAPI server for managing LoRA training jobs."""

import argparse
import asyncio
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from captioning.batch_manager import CaptionBatchManager
from captioning.provider import get_provider as get_caption_provider
from captioning.provider import unload_provider as unload_caption_provider
from config import SidecarConfig, load_config
from job_manager import JobManager
from job_registry import JobRegistry, run_worker
from models import (
    CaptionBatchRequest,
    CaptionBatchResponse,
    CaptionRequest,
    CaptionResponse,
    HealthResponse,
    StartJobRequest,
)
from ai_toolkit_server import AiToolkitServer
from providers.ai_toolkit_ui import AiToolkitUiProvider
from providers.mock import MockProvider
from ws_manager import WebSocketManager

# --- Globals initialised at startup ---
ws_manager = WebSocketManager()
caption_ws_manager = WebSocketManager()
job_registry = JobRegistry()
job_manager: JobManager
caption_manager: CaptionBatchManager
sidecar_config: SidecarConfig
# Tracks any ai-toolkit UI server we spawn so we can stop it on shutdown.
aitk_server: Optional["AiToolkitServer"] = None
# Worker task(s) that pull jobs from the registry queue. Phase 2 runs one.
worker_tasks: list[asyncio.Task] = []


def _register_providers(jm: JobManager, config: SidecarConfig):
    """Register available training providers based on config."""
    global aitk_server
    backends = config.backends

    # ai-toolkit — driven via its bundled UI server's HTTP API.
    # The server is spawned lazily on first training request (via
    # AiToolkitServer.ensure_running) — we just register the provider here.
    aitk_path = backends.get("ai-toolkit")
    if aitk_path:
        log_path = config.training_dir / "aitk-server.log"
        aitk_server = AiToolkitServer(Path(aitk_path), log_path=log_path)
        provider = AiToolkitUiProvider(aitk_path, aitk_server)
        jm.register_provider("ai-toolkit", provider)
        print(
            f"[sidecar] Registered ai-toolkit provider at {aitk_path} "
            f"(server logs -> {log_path})"
        )

    # TODO Phase 6: Kohya provider (will use the stderr-scraping pattern
    # in providers/ai_toolkit.py since sd-scripts has no equivalent UI/API)
    # kohya_path = backends.get("kohya")
    # if kohya_path:
    #     provider = KohyaProvider(kohya_path)
    #     jm.register_provider("kohya", provider)

    # Mock provider is always registered — it needs no external tooling and
    # lets the UI be exercised end-to-end (including GPU-busy blocking)
    # without a real training backend installed.
    jm.register_provider("mock", MockProvider())
    print("[sidecar] Registered mock provider")

    if not jm.providers:
        print(
            "[sidecar] Warning: No training backends configured. "
            "Add paths to config.json under 'trainingBackends'.",
            file=sys.stderr,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle for the FastAPI app."""
    global job_manager, caption_manager, sidecar_config

    sidecar_config = load_config()
    job_manager = JobManager(
        jobs_dir=sidecar_config.training_dir / "jobs",
        ws_manager=ws_manager,
        registry=job_registry,
    )
    caption_manager = CaptionBatchManager(
        ws_manager=caption_ws_manager, registry=job_registry
    )
    _register_providers(job_manager, sidecar_config)

    # Write PID file so Node.js can find us after a restart
    pid_path = sidecar_config.training_dir / "sidecar.pid"
    pid_path.write_text(str(os.getpid()), encoding="utf-8")

    # Start the queue worker(s) — one per `sidecarWorkers` entry in
    # config.json, each pinned to its assigned GPU.
    #
    # Caveat: VLM captioning runs in-process inside this sidecar, so its
    # CUDA context is shared with whichever GPU torch picked at process
    # startup (usually GPU 0). Caption jobs assigned to a non-zero worker
    # slot will still execute on the sidecar's GPU, not on the worker's
    # `gpu_id`. Isolating captioning would require spawning it as a
    # subprocess with its own `CUDA_VISIBLE_DEVICES` — deferred.
    for i, wc in enumerate(sidecar_config.workers):
        worker_tasks.append(
            asyncio.create_task(
                run_worker(job_registry, worker_id=i, gpu_id=wc.gpu_id)
            )
        )
        print(f"[sidecar] Worker {i} pinned to GPU {wc.gpu_id}")

    # Signal to the Node.js process manager that we're ready
    print(f"SIDECAR_READY port={sidecar_config.port}", flush=True)

    yield

    # Cleanup on shutdown
    for task in worker_tasks:
        task.cancel()
    for task in worker_tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    worker_tasks.clear()

    if pid_path.exists():
        pid_path.unlink()
    if aitk_server is not None:
        await aitk_server.stop()


app = FastAPI(title="Training Sidecar", version="0.1.0", lifespan=lifespan)

# Allow connections from the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health ---


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(active_job=job_manager.active_job_id)


# --- Provider info ---


@app.get("/providers")
async def list_providers():
    """List registered providers and their supported models."""
    result = {}
    for name, provider in job_manager.providers.items():
        result[name] = {
            "models": provider.get_supported_models(),
        }
    return result


@app.get("/providers/{provider_name}/validate")
async def validate_provider(provider_name: str):
    """Validate that a provider's environment is correctly set up."""
    provider = job_manager.providers.get(provider_name)
    if provider is None:
        return JSONResponse(
            {"valid": False, "error": f"Unknown provider: {provider_name}"},
            status_code=404,
        )
    valid, error = await provider.validate_environment()
    return {"valid": valid, "error": error}


# --- Job management ---


@app.post("/jobs/start")
async def start_job(request: StartJobRequest):
    try:
        response = await job_manager.start_job(request)
        return response
    except RuntimeError as e:
        return JSONResponse({"error": str(e)}, status_code=409)


@app.post("/jobs/cancel")
async def cancel_job(job_id: Optional[str] = None):
    """Cancel a training job. If `job_id` is omitted, cancels the focus job
    (running training job if any, else oldest queued)."""
    success = await job_manager.cancel_job(job_id)
    if not success:
        return JSONResponse({"error": "No active job to cancel"}, status_code=404)
    return {"status": "cancelled"}


@app.get("/jobs/status")
async def job_status():
    state = job_manager.get_status()
    if state is None:
        return {"active": False}
    return {"active": True, **state}


@app.post("/jobs/clear")
async def clear_job(job_id: Optional[str] = None):
    """Clear terminal training jobs. If `job_id` is omitted, clears all of them."""
    job_manager.clear_completed(job_id)
    return {"status": "cleared"}


# --- WebSocket for real-time progress ---


@app.websocket("/ws/progress")
async def ws_progress(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send current state immediately on connect
        state = job_manager.get_status()
        if state and "progress" in state:
            await websocket.send_json(state["progress"])

        # Keep connection alive — the server pushes updates via broadcast
        while True:
            # Wait for client messages (ping/pong or close)
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)


# --- Captioning (VLM) ---


@app.post("/caption", response_model=CaptionResponse)
async def caption_single(request: CaptionRequest):
    """Caption a single image synchronously. Used for testing or small jobs."""
    # GPU guard — don't run captioning while another GPU job is active
    if job_registry.has_running():
        return JSONResponse(
            {"error": "Cannot caption while another GPU job is running"},
            status_code=409,
        )

    try:
        provider = get_caption_provider(request.runtime)
        caption = await provider.caption_image(
            image_path=request.image_path,
            model_path=request.model_path,
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )
        return CaptionResponse(image_path=request.image_path, caption=caption)
    except Exception as err:
        return JSONResponse({"error": str(err)}, status_code=500)


@app.post("/caption/batch", response_model=CaptionBatchResponse)
async def caption_batch(request: CaptionBatchRequest):
    """Enqueue a batch caption run — progress streams via /ws/caption.

    Always enqueues; the worker picks it up when no other GPU-bound job is
    running. The 409 path only fires on duplicate batch IDs.
    """
    try:
        await caption_manager.start_batch(request)
        return CaptionBatchResponse(
            batch_id=request.batch_id,
            status="queued",
            total=len(request.image_paths),
        )
    except RuntimeError as err:
        return JSONResponse({"error": str(err)}, status_code=409)


@app.post("/caption/batch/{batch_id}/cancel")
async def cancel_caption_batch(batch_id: str):
    """Cancel an in-progress caption batch."""
    success = caption_manager.cancel_batch(batch_id)
    if not success:
        return JSONResponse(
            {"error": f"Batch {batch_id} not running"}, status_code=404
        )
    return {"status": "cancelling"}


@app.post("/caption/unload")
async def unload_caption_model():
    """Release all cached VLMs from memory/GPU."""
    await unload_caption_provider()
    return {"status": "unloaded"}


@app.websocket("/ws/caption")
async def ws_caption(websocket: WebSocket):
    """WebSocket for streaming caption batch progress."""
    await caption_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        caption_ws_manager.disconnect(websocket)


# --- Entry point ---


def main():
    parser = argparse.ArgumentParser(description="Training sidecar server")
    parser.add_argument(
        "--app-root",
        type=Path,
        default=None,
        help="Path to the img-tagger app root (parent of config.json)",
    )
    args = parser.parse_args()

    config = load_config(args.app_root)

    import uvicorn

    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        log_level="info",
        # Disable WebSocket ping timeout on localhost. Long-running inference
        # (several minutes for VLM captioning on CPU) exceeds the default 20s
        # ping interval / 20s timeout, and uvicorn drops the connection even
        # though the server is still processing. Localhost IPC doesn't need
        # liveness checks.
        ws_ping_interval=None,
        ws_ping_timeout=None,
    )


if __name__ == "__main__":
    main()
