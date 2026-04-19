"""Training job lifecycle management."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from job_registry import JobKind, JobRegistry, LifecycleStatus
from models import (
    JobProgress,
    JobState,
    JobStatus,
    StartJobRequest,
    StartJobResponse,
)
from providers.base import TrainingProvider
from ws_manager import WebSocketManager


_TERMINAL_TRAINING_STATUSES = (
    JobStatus.COMPLETED,
    JobStatus.FAILED,
    JobStatus.CANCELLED,
)


def _lifecycle_from_training(status: JobStatus) -> LifecycleStatus:
    """Map the training-specific JobStatus onto the shared lifecycle vocabulary.

    PENDING / PREPARING / TRAINING all collapse to RUNNING — the sub-phase
    detail stays in the progress payload.
    """
    if status == JobStatus.COMPLETED:
        return LifecycleStatus.COMPLETED
    if status == JobStatus.FAILED:
        return LifecycleStatus.FAILED
    if status == JobStatus.CANCELLED:
        return LifecycleStatus.CANCELLED
    return LifecycleStatus.RUNNING


class JobManager:
    """Manages training job lifecycle, state persistence, and progress broadcasting.

    Training jobs are enqueued via the shared JobRegistry; a worker loop picks
    them up and invokes the runner. Multiple jobs may be tracked simultaneously
    (queued + running + terminal), keyed by job_id in `_jobs`.
    """

    def __init__(
        self,
        jobs_dir: Path,
        ws_manager: WebSocketManager,
        registry: JobRegistry,
    ):
        self._jobs_dir = jobs_dir
        self._ws = ws_manager
        self._registry = registry
        self._jobs: dict[str, JobState] = {}
        self._providers: dict[str, TrainingProvider] = {}

        # Try to recover state from a previous run
        self._recover_state()

    def register_provider(self, name: str, provider: TrainingProvider):
        """Register a training provider (e.g. 'ai-toolkit', 'kohya')."""
        self._providers[name] = provider

    @property
    def providers(self) -> dict[str, TrainingProvider]:
        return self._providers

    @property
    def active_job_id(self) -> Optional[str]:
        """ID of the currently running training job, if any."""
        for rec in self._registry.running_jobs():
            if rec.kind == JobKind.TRAINING:
                return rec.id
        return None

    def _focus_job(self) -> Optional[JobState]:
        """Pick the most relevant job for the single-job status view.

        Priority: running training job, else oldest queued training job, else
        newest terminal training job. Mirrors the pre-queue behaviour where
        the status endpoint returned a single training job state.
        """
        for rec in self._registry.running_jobs():
            if rec.kind == JobKind.TRAINING and rec.id in self._jobs:
                return self._jobs[rec.id]
        for rec in self._registry.queued_jobs():
            if rec.kind == JobKind.TRAINING and rec.id in self._jobs:
                return self._jobs[rec.id]
        terminal = [
            j for j in self._jobs.values() if j.status in _TERMINAL_TRAINING_STATUSES
        ]
        if terminal:
            terminal.sort(key=lambda j: j.completed_at or "", reverse=True)
            return terminal[0]
        return None

    def get_status(self) -> Optional[dict]:
        """Get the focus job's state as a dict, or None if no training jobs tracked.

        Includes the registry's queue position for queued jobs so the client
        can show placement.
        """
        job = self._focus_job()
        if job is None:
            return None
        data = job.model_dump()
        position = self._registry.queue_position(job.job_id)
        if position > 0:
            data["queue_position"] = position
        return data

    async def start_job(self, request: StartJobRequest) -> StartJobResponse:
        """Create a training job and enqueue it. Returns immediately.

        The job starts in QUEUED lifecycle status; when a worker picks it up,
        it transitions to RUNNING and the provider's training loop begins.
        """
        provider = self._providers.get(request.provider.value)
        if provider is None:
            raise RuntimeError(
                f"Provider '{request.provider.value}' is not registered. "
                f"Available: {list(self._providers.keys())}"
            )

        job_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()
        progress = JobProgress(job_id=job_id, status=JobStatus.PENDING)

        self._jobs[job_id] = JobState(
            job_id=job_id,
            status=JobStatus.PENDING,
            provider=request.provider,
            project_path=request.project_path,
            config=request.model_dump(),
            started_at=now,
            progress=progress,
        )
        self._registry.create(
            job_id,
            JobKind.TRAINING,
            status=LifecycleStatus.QUEUED,
            metadata={
                "provider": request.provider.value,
                "project_path": request.project_path,
            },
        )
        self._persist_state(job_id)

        # Runner invoked by the worker when it's this job's turn. The worker
        # calls set_running() before invoking us, so the record carries the
        # assigned gpu_id by the time the runner body executes.
        async def runner() -> None:
            record = self._registry.get(job_id)
            gpu_id = record.gpu_id if record and record.gpu_id is not None else 0
            await self._run_training(job_id, request, provider, gpu_id=gpu_id)

        self._registry.enqueue(job_id, runner)

        return StartJobResponse(job_id=job_id, status=JobStatus.PENDING)

    async def cancel_job(self, job_id: Optional[str] = None) -> bool:
        """Cancel a training job — queued or running.

        If `job_id` is omitted, cancels the focus job (running one, else oldest
        queued). Returns True if a job was cancelled.
        """
        if job_id is None:
            focus = self._focus_job()
            if focus is None or focus.status in _TERMINAL_TRAINING_STATUSES:
                return False
            job_id = focus.job_id

        job = self._jobs.get(job_id)
        if job is None:
            return False

        record = self._registry.get(job_id)
        if record is None:
            return False

        # Cancelled while still queued — no subprocess to kill.
        if record.status == LifecycleStatus.QUEUED:
            self._registry.cancel_queued(job_id)
            job.status = JobStatus.CANCELLED
            job.progress.status = JobStatus.CANCELLED
            job.progress.error = "Cancelled before start"
            job.completed_at = datetime.now(timezone.utc).isoformat()
            self._persist_state(job_id)
            await self._ws.broadcast(job.progress.model_dump())
            return True

        # Running — ask the provider to stop; the runner's exception handler
        # will emit the CANCELLED progress update.
        provider = self._providers.get(job.provider.value)
        if provider:
            await provider.cancel_training()

        await self._update_progress(
            JobProgress(
                job_id=job_id,
                status=JobStatus.CANCELLED,
                current_step=job.progress.current_step,
                total_steps=job.progress.total_steps,
                error="Cancelled by user",
            )
        )
        return True

    async def _run_training(
        self,
        job_id: str,
        request: StartJobRequest,
        provider: TrainingProvider,
        gpu_id: int = 0,
    ):
        """Runner invoked by the worker when this job reaches the front of the queue."""
        try:
            config_dir = str(self._jobs_dir / job_id)
            Path(config_dir).mkdir(parents=True, exist_ok=True)
            config_path = await provider.generate_config(request, config_dir)

            async for progress in provider.start_training(
                request, config_path, gpu_id=gpu_id
            ):
                progress.job_id = job_id
                await self._update_progress(progress)

        except asyncio.CancelledError:
            # Cancellation path: the cancel_job caller already emitted the
            # CANCELLED progress update and updated state.
            raise
        except Exception as e:
            await self._update_progress(
                JobProgress(
                    job_id=job_id,
                    status=JobStatus.FAILED,
                    error=str(e),
                )
            )

    async def _update_progress(self, progress: JobProgress):
        """Update the referenced job's progress and broadcast to WebSocket clients."""
        job = self._jobs.get(progress.job_id)
        if job is None:
            return

        job.progress = progress
        job.status = progress.status

        if progress.status in _TERMINAL_TRAINING_STATUSES:
            job.completed_at = datetime.now(timezone.utc).isoformat()
            self._registry.finish(
                job.job_id, _lifecycle_from_training(progress.status)
            )

        self._persist_state(job.job_id)
        await self._ws.broadcast(progress.model_dump())

    def mark_failed(self, job_id: str, error: str):
        """Mark a specific job as failed with an error message."""
        job = self._jobs.get(job_id)
        if job is None:
            return

        job.status = JobStatus.FAILED
        job.progress.status = JobStatus.FAILED
        job.progress.error = error
        job.completed_at = datetime.now(timezone.utc).isoformat()
        self._registry.finish(job_id, LifecycleStatus.FAILED)
        self._persist_state(job_id)

    def clear_completed(self, job_id: Optional[str] = None):
        """Clear terminal training jobs from active state and disk.

        If `job_id` is given, clears only that job (if terminal). Otherwise,
        sweeps all terminal training jobs.
        """
        targets = (
            [job_id]
            if job_id is not None
            else [
                jid
                for jid, j in self._jobs.items()
                if j.status in _TERMINAL_TRAINING_STATUSES
            ]
        )
        for jid in targets:
            job = self._jobs.get(jid)
            if job is None or job.status not in _TERMINAL_TRAINING_STATUSES:
                continue
            path = self._jobs_dir / f"{jid}.json"
            try:
                path.unlink(missing_ok=True)
            except OSError as e:
                print(f"Warning: Failed to delete cleared job file: {e}")
            self._registry.remove(jid)
            del self._jobs[jid]

    def _persist_state(self, job_id: str):
        """Write a job's state to disk for crash recovery."""
        job = self._jobs.get(job_id)
        if job is None:
            return

        path = self._jobs_dir / f"{job_id}.json"
        try:
            path.write_text(
                json.dumps(job.model_dump(), indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            print(f"Warning: Failed to persist job state: {e}")

    def _recover_state(self):
        """Attempt to recover in-flight jobs from disk after a restart.

        Each in-flight file (PENDING/PREPARING/TRAINING) is marked FAILED since
        the training subprocess did not survive the restart. Terminal files
        from prior sessions are cleaned up opportunistically — the client
        owns terminal training history via localStorage.
        """
        if not self._jobs_dir.exists():
            return

        for path in self._jobs_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                job = JobState(**data)

                if job.status in (
                    JobStatus.PENDING,
                    JobStatus.PREPARING,
                    JobStatus.TRAINING,
                ):
                    job.status = JobStatus.FAILED
                    job.progress.status = JobStatus.FAILED
                    job.progress.error = "Training interrupted — sidecar restarted"
                    job.completed_at = datetime.now(timezone.utc).isoformat()
                    self._jobs[job.job_id] = job
                    self._registry.create(
                        job.job_id,
                        JobKind.TRAINING,
                        status=LifecycleStatus.FAILED,
                        metadata={
                            "provider": job.provider.value,
                            "project_path": job.project_path,
                        },
                    )
                    self._persist_state(job.job_id)
                else:
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        pass
            except (json.JSONDecodeError, OSError, ValueError) as e:
                print(f"Warning: Failed to recover job state from {path.name}: {e}")
