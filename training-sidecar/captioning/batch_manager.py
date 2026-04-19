"""
Batch captioning manager — tracks active batches and streams progress.

Unlike the training JobManager which allows only one job at a time,
captioning is lightweight enough that we could support multiple batches,
but we only run one at a time for now to avoid GPU contention.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Optional

from captioning.provider import CaptionCancelled, get_provider
from job_registry import JobKind, JobRegistry, LifecycleStatus
from models import CaptionBatchProgress, CaptionBatchRequest
from ws_manager import WebSocketManager


@dataclass
class BatchState:
    batch_id: str
    total: int
    current: int = 0
    status: str = "running"  # running, completed, failed, cancelled
    cancel_requested: bool = False
    task: Optional[asyncio.Task] = None
    results: list[dict] = field(default_factory=list)


class CaptionBatchManager:
    """Manages active caption batches and broadcasts progress."""

    def __init__(
        self, ws_manager: WebSocketManager, registry: JobRegistry
    ) -> None:
        self.ws_manager = ws_manager
        self.registry = registry
        self.batches: dict[str, BatchState] = {}

    def get_batch(self, batch_id: str) -> Optional[BatchState]:
        return self.batches.get(batch_id)

    @property
    def has_active(self) -> bool:
        return any(b.status == "running" for b in self.batches.values())

    async def start_batch(self, request: CaptionBatchRequest) -> None:
        """Enqueue a batch caption run.

        The batch starts in QUEUED lifecycle status. When a worker picks it up,
        the runner loads the model and streams per-image progress.
        """
        if request.batch_id in self.batches:
            raise RuntimeError(f"Batch {request.batch_id} already exists")

        state = BatchState(
            batch_id=request.batch_id,
            total=len(request.image_paths),
        )
        self.batches[request.batch_id] = state
        self.registry.create(
            request.batch_id,
            JobKind.CAPTION_BATCH,
            status=LifecycleStatus.QUEUED,
            metadata={"total": state.total, "runtime": request.runtime},
        )

        async def runner() -> None:
            await self._run_batch(request, state)

        self.registry.enqueue(request.batch_id, runner)

    async def _run_batch(
        self, request: CaptionBatchRequest, state: BatchState
    ) -> None:
        """Run the batch — one image at a time, broadcasting progress."""
        provider = get_provider(request.runtime)

        # Closure read by the provider during inference so we can abort
        # mid-image instead of waiting for the next loop iteration.
        def cancel_check() -> bool:
            return state.cancel_requested

        # Model loading happens inside the provider's executor thread.
        # The provider calls on_load_progress(message, current, total) from
        # that thread — we schedule the async broadcast back onto the main
        # event loop with run_coroutine_threadsafe.
        main_loop = asyncio.get_running_loop()

        def on_load_progress(message: str, current: int, total: int) -> None:
            coro = self._broadcast(
                CaptionBatchProgress(
                    batch_id=state.batch_id,
                    current=current,
                    total=total,
                    status="loading",
                    message=message,
                )
            )
            try:
                asyncio.run_coroutine_threadsafe(coro, main_loop)
            except Exception:
                # Best-effort — never break model loading over a broadcast failure.
                pass

        async def broadcast_cancelled() -> None:
            state.status = "cancelled"
            self.registry.finish(state.batch_id, LifecycleStatus.CANCELLED)
            await self._broadcast(
                CaptionBatchProgress(
                    batch_id=state.batch_id,
                    current=state.current,
                    total=state.total,
                    status="cancelled",
                )
            )

        try:
            # Pre-load the model so the UI can surface loading progress
            # separately from inference progress. Without this, the first
            # caption_image call blocks through load AND inference and the
            # UI sits on the last loading tick for the whole duration.
            try:
                await provider.prepare(
                    model_path=request.model_path,
                    on_load_progress=on_load_progress,
                )
            except CaptionCancelled:
                await broadcast_cancelled()
                return

            # Model is ready — broadcast a "running" transition so the UI
            # clears its loading overlay before the first image starts.
            if not state.cancel_requested:
                await self._broadcast(
                    CaptionBatchProgress(
                        batch_id=state.batch_id,
                        current=0,
                        total=state.total,
                        status="running",
                    )
                )

            for i, image_path in enumerate(request.image_paths):
                if state.cancel_requested:
                    await broadcast_cancelled()
                    return

                try:
                    caption = await provider.caption_image(
                        image_path=image_path,
                        model_path=request.model_path,
                        prompt=request.prompt,
                        max_tokens=request.max_tokens,
                        temperature=request.temperature,
                        cancel_check=cancel_check,
                        on_load_progress=on_load_progress,
                        video_options=request.video,
                    )
                    state.current = i + 1
                    state.results.append(
                        {"image_path": image_path, "caption": caption}
                    )
                    await self._broadcast(
                        CaptionBatchProgress(
                            batch_id=state.batch_id,
                            current=state.current,
                            total=state.total,
                            image_path=image_path,
                            caption=caption,
                            status="running",
                        )
                    )
                except CaptionCancelled:
                    # Mid-image cancel — drop the partial caption and exit.
                    await broadcast_cancelled()
                    return
                except Exception as err:
                    import traceback

                    traceback.print_exc()
                    # Per-image error — broadcast and keep going
                    await self._broadcast(
                        CaptionBatchProgress(
                            batch_id=state.batch_id,
                            current=state.current,
                            total=state.total,
                            image_path=image_path,
                            status="running",
                            error=str(err),
                        )
                    )

            state.status = "completed"
            self.registry.finish(state.batch_id, LifecycleStatus.COMPLETED)
            await self._broadcast(
                CaptionBatchProgress(
                    batch_id=state.batch_id,
                    current=state.current,
                    total=state.total,
                    status="completed",
                )
            )

        except Exception as err:
            import traceback

            traceback.print_exc()
            state.status = "failed"
            self.registry.finish(state.batch_id, LifecycleStatus.FAILED)
            await self._broadcast(
                CaptionBatchProgress(
                    batch_id=state.batch_id,
                    current=state.current,
                    total=state.total,
                    status="failed",
                    error=str(err),
                )
            )

    def cancel_batch(self, batch_id: str) -> bool:
        """Request cancellation of a queued or running batch."""
        state = self.batches.get(batch_id)
        if state is None or state.status != "running":
            return False

        record = self.registry.get(batch_id)
        if record and record.status == LifecycleStatus.QUEUED:
            # Not yet picked up — remove from the queue immediately.
            self.registry.cancel_queued(batch_id)
            state.status = "cancelled"
            return True

        state.cancel_requested = True
        return True

    def clear_batch(self, batch_id: str) -> bool:
        """Remove a completed batch from the manager."""
        state = self.batches.get(batch_id)
        if state is None:
            return False
        if state.status == "running":
            return False
        del self.batches[batch_id]
        self.registry.remove(batch_id)
        return True

    async def _broadcast(self, progress: CaptionBatchProgress) -> None:
        """Send a progress update over the caption WebSocket channel."""
        await self.ws_manager.broadcast(
            {"channel": "caption", **progress.model_dump()}
        )
