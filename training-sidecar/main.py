"""Training sidecar — FastAPI server for managing LoRA training jobs."""

import argparse
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from captioning.batch_manager import CaptionBatchManager
from captioning.provider import get_provider as get_caption_provider
from captioning.provider import unload_provider as unload_caption_provider
from config import SidecarConfig, load_config
from job_manager import JobManager
from models import (
    CaptionBatchRequest,
    CaptionBatchResponse,
    CaptionRequest,
    CaptionResponse,
    HealthResponse,
    StartJobRequest,
)
from providers.ai_toolkit import AiToolkitProvider
from providers.mock import MockProvider
from ws_manager import WebSocketManager

# --- Globals initialised at startup ---
ws_manager = WebSocketManager()
caption_ws_manager = WebSocketManager()
job_manager: JobManager
caption_manager: CaptionBatchManager
sidecar_config: SidecarConfig


def _register_providers(jm: JobManager, config: SidecarConfig):
    """Register available training providers based on config."""
    backends = config.backends

    # ai-toolkit
    aitk_path = backends.get("ai-toolkit")
    if aitk_path:
        provider = AiToolkitProvider(aitk_path)
        jm.register_provider("ai-toolkit", provider)
        print(f"[sidecar] Registered ai-toolkit provider at {aitk_path}")

    # TODO Phase 6: Kohya provider
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
    )
    caption_manager = CaptionBatchManager(ws_manager=caption_ws_manager)
    _register_providers(job_manager, sidecar_config)

    # Write PID file so Node.js can find us after a restart
    pid_path = sidecar_config.training_dir / "sidecar.pid"
    pid_path.write_text(str(os.getpid()), encoding="utf-8")

    # Signal to the Node.js process manager that we're ready
    print(f"SIDECAR_READY port={sidecar_config.port}", flush=True)

    yield

    # Cleanup on shutdown
    if pid_path.exists():
        pid_path.unlink()


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
async def cancel_job():
    success = await job_manager.cancel_job()
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
async def clear_job():
    """Clear a completed/failed/cancelled job from active state."""
    job_manager.clear_completed()
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
    # GPU guard — don't run captioning while training is active
    if job_manager.active_job_id is not None:
        return JSONResponse(
            {"error": "Cannot caption while training is active"},
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
    """Start a batch caption run — progress streams via /ws/caption."""
    if job_manager.active_job_id is not None:
        return JSONResponse(
            {"error": "Cannot caption while training is active"},
            status_code=409,
        )

    if caption_manager.has_active:
        return JSONResponse(
            {"error": "Another caption batch is already running"},
            status_code=409,
        )

    try:
        await caption_manager.start_batch(request)
        return CaptionBatchResponse(
            batch_id=request.batch_id,
            status="started",
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
