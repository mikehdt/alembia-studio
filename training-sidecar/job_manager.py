"""Training job lifecycle management."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from models import (
    JobProgress,
    JobState,
    JobStatus,
    StartJobRequest,
    StartJobResponse,
)
from providers.base import TrainingProvider
from ws_manager import WebSocketManager


class JobManager:
    """Manages training job lifecycle, state persistence, and progress broadcasting."""

    def __init__(self, jobs_dir: Path, ws_manager: WebSocketManager):
        self._jobs_dir = jobs_dir
        self._ws = ws_manager
        self._active_job: Optional[JobState] = None
        self._training_task: Optional[asyncio.Task] = None
        self._providers: dict[str, TrainingProvider] = {}

        # Try to recover state from a previous run
        self._recover_state()

    def register_provider(self, name: str, provider: TrainingProvider):
        """Register a training provider (e.g. 'ai-toolkit', 'kohya')."""
        self._providers[name] = provider

    @property
    def active_job_id(self) -> Optional[str]:
        return self._active_job.job_id if self._active_job else None

    @property
    def active_job(self) -> Optional[JobState]:
        return self._active_job

    @property
    def providers(self) -> dict[str, TrainingProvider]:
        return self._providers

    def get_status(self) -> Optional[dict]:
        """Get current job state as a dict, or None if no active job."""
        if self._active_job is None:
            return None
        return self._active_job.model_dump()

    async def start_job(self, request: StartJobRequest) -> StartJobResponse:
        """Create and start a training job. Returns immediately; training runs in background."""
        if self._active_job and self._active_job.status in (
            JobStatus.PENDING,
            JobStatus.PREPARING,
            JobStatus.TRAINING,
        ):
            raise RuntimeError(
                f"Job {self._active_job.job_id} is already active "
                f"(status: {self._active_job.status})"
            )

        # Validate provider
        provider = self._providers.get(request.provider.value)
        if provider is None:
            raise RuntimeError(
                f"Provider '{request.provider.value}' is not registered. "
                f"Available: {list(self._providers.keys())}"
            )

        # Create job state
        job_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        progress = JobProgress(job_id=job_id, status=JobStatus.PENDING)

        self._active_job = JobState(
            job_id=job_id,
            status=JobStatus.PENDING,
            provider=request.provider,
            project_path=request.project_path,
            config=request.model_dump(),
            started_at=now,
            progress=progress,
        )
        self._persist_state()

        # Launch training in the background
        self._training_task = asyncio.create_task(
            self._run_training(job_id, request, provider)
        )

        return StartJobResponse(job_id=job_id, status=JobStatus.PENDING)

    async def cancel_job(self) -> bool:
        """Cancel the active training job."""
        if self._active_job is None:
            return False

        provider = self._providers.get(self._active_job.provider.value)
        if provider:
            await provider.cancel_training()

        if self._training_task and not self._training_task.done():
            self._training_task.cancel()

        await self._update_progress(
            JobProgress(
                job_id=self._active_job.job_id,
                status=JobStatus.CANCELLED,
                current_step=self._active_job.progress.current_step,
                total_steps=self._active_job.progress.total_steps,
                error="Cancelled by user",
            )
        )
        return True

    async def _run_training(
        self,
        job_id: str,
        request: StartJobRequest,
        provider: TrainingProvider,
    ):
        """Background task that runs the full training pipeline."""
        try:
            # Generate config
            config_dir = str(self._jobs_dir / job_id)
            Path(config_dir).mkdir(parents=True, exist_ok=True)
            config_path = await provider.generate_config(request, config_dir)

            # Stream progress from provider
            async for progress in provider.start_training(request, config_path):
                # Override the job_id to match ours (provider may not know it)
                progress.job_id = job_id
                await self._update_progress(progress)

        except asyncio.CancelledError:
            # Job was cancelled — state already updated by cancel_job
            pass
        except Exception as e:
            await self._update_progress(
                JobProgress(
                    job_id=job_id,
                    status=JobStatus.FAILED,
                    error=str(e),
                )
            )

    async def _update_progress(self, progress: JobProgress):
        """Update job progress and broadcast to WebSocket clients."""
        if self._active_job is None:
            return

        self._active_job.progress = progress
        self._active_job.status = progress.status

        if progress.status in (
            JobStatus.COMPLETED,
            JobStatus.FAILED,
            JobStatus.CANCELLED,
        ):
            self._active_job.completed_at = datetime.now(timezone.utc).isoformat()

        self._persist_state()
        await self._ws.broadcast(progress.model_dump())

    def mark_failed(self, error: str):
        """Mark the active job as failed with an error message."""
        if self._active_job is None:
            return

        self._active_job.status = JobStatus.FAILED
        self._active_job.progress.status = JobStatus.FAILED
        self._active_job.progress.error = error
        self._active_job.completed_at = datetime.now(timezone.utc).isoformat()
        self._persist_state()

    def clear_completed(self):
        """Clear a completed/failed/cancelled job from active state.

        Also deletes the persisted state file so the job doesn't come
        back via `_recover_state()` the next time the sidecar starts.
        """
        if self._active_job and self._active_job.status in (
            JobStatus.COMPLETED,
            JobStatus.FAILED,
            JobStatus.CANCELLED,
        ):
            path = self._jobs_dir / f"{self._active_job.job_id}.json"
            try:
                path.unlink(missing_ok=True)
            except OSError as e:
                print(f"Warning: Failed to delete cleared job file: {e}")
            self._active_job = None

    def _persist_state(self):
        """Write current job state to disk for crash recovery."""
        if self._active_job is None:
            return

        path = self._jobs_dir / f"{self._active_job.job_id}.json"
        try:
            path.write_text(
                json.dumps(self._active_job.model_dump(), indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            print(f"Warning: Failed to persist job state: {e}")

    def _recover_state(self):
        """Attempt to recover an in-flight job from disk after a restart.

        Terminal jobs (completed/failed/cancelled) are NOT recovered — the
        client owns terminal training history via localStorage, so there's
        no reason to resurface them here. Stale terminal files are cleaned
        up opportunistically.
        """
        if not self._jobs_dir.exists():
            return

        latest: Optional[tuple[float, Path]] = None
        for path in self._jobs_dir.glob("*.json"):
            mtime = path.stat().st_mtime
            if latest is None or mtime > latest[0]:
                latest = (mtime, path)

        if latest is None:
            return

        try:
            data = json.loads(latest[1].read_text(encoding="utf-8"))
            job = JobState(**data)

            if job.status in (
                JobStatus.PENDING,
                JobStatus.PREPARING,
                JobStatus.TRAINING,
            ):
                # Sidecar restarted while this job was running — mark failed.
                job.status = JobStatus.FAILED
                job.progress.status = JobStatus.FAILED
                job.progress.error = "Training interrupted — sidecar restarted"
                job.completed_at = datetime.now(timezone.utc).isoformat()
                self._active_job = job
            else:
                # Terminal job left over from a previous session — drop it.
                try:
                    latest[1].unlink(missing_ok=True)
                except OSError:
                    pass
        except (json.JSONDecodeError, OSError, ValueError) as e:
            print(f"Warning: Failed to recover job state: {e}")
