"""Cumulative training-time markers that survive a stop → resume.

Neither sd-scripts nor ai-toolkit reports a cumulative, resume-aware "time
actually spent training" figure — their tqdm bars only expose a per-process
`elapsed<remaining` bracket that resets to zero whenever a run is resumed from
a saved state (and covers only the training loop, not caching/loading). So the
JobManager accumulates active-training wall-time itself (summing the gaps
between TRAINING-status progress ticks) and, so that figure carries across a
stop → resume, drops a small marker file next to the trainer's saved state.
When a later run resumes from that state, the marker is read back to seed the
accumulator instead of starting the training clock at zero.

Marker placement is backend-specific because the two backends persist state
differently:

- **kohya / sd-scripts** writes a *fresh directory per checkpoint* —
  `{output_name}-step{N:08d}-state/`, `{output_name}-{epoch:06d}-state/`, and a
  final `{output_name}-state/`, all under `output_dir`
  (library/checkpoint_io.py STEP_STATE_NAME / EPOCH_STATE_NAME /
  LAST_STATE_NAME). Each is an independent snapshot, so we write the marker
  once per new state dir, capturing the training time *as of that checkpoint* —
  a run resumed from it then continues from exactly that figure.

- **ai-toolkit** keeps a *single evolving* `optimizer.pt` in
  `save_root = {output_path}/{output_name}/` (BaseSDTrainProcess), overwritten
  on every save and auto-loaded on the next same-folder run. There's only ever
  one state, so we overwrite one marker there with the latest training time.

Every filesystem operation here is best-effort: a marker that can't be written
or read just means a future resume starts its training clock fresh, which is a
cosmetic regression, never a training failure.
"""

import json
from pathlib import Path
from typing import Optional

MARKER_NAME = "img-tagger-training-time.json"


def _read_marker(path: Path) -> Optional[float]:
    """Return the training-seconds stored in a marker file, or None."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        value = float(data.get("training_seconds", 0))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None
    return value if value >= 0 else None


def _write_marker(
    state_dir: Path, training_seconds: float, step: int, job_id: str
) -> None:
    try:
        payload = {
            "training_seconds": round(float(training_seconds), 3),
            "step": int(step),
            "job_id": job_id,
        }
        (state_dir / MARKER_NAME).write_text(
            json.dumps(payload), encoding="utf-8"
        )
    except (OSError, ValueError, TypeError):
        # Best-effort — a missing marker only costs a fresh clock on resume.
        pass


def _state_dir_step(dir_name: str, output_name: str) -> Optional[int]:
    """Parse the training step encoded in a kohya state-dir name, or None.

    sd-scripts names step-based states `{output_name}-step{N:08d}-state` and
    epoch-based ones `{output_name}-{epoch:06d}-state`, with a suffix-less final
    `{output_name}-state` (library/checkpoint_io.py). Only the step form carries
    a step we can look up in the ledger; the epoch and final forms return None
    (their marker falls back to the latest training-seconds).
    """
    middle = dir_name
    if middle.startswith(output_name):
        middle = middle[len(output_name) :]
    middle = middle.strip("-")
    if middle.endswith("-state"):
        middle = middle[: -len("-state")]
    middle = middle.strip("-")
    if middle.startswith("step"):
        digits = middle[len("step") :]
        if digits.isdigit():
            return int(digits)
    return None


def read_carryforward_seconds(resume_state: Optional[str]) -> float:
    """Training-seconds to continue from, given a user-selected resume path.

    `resume_state` may point at a state directory (kohya's `*-state`, or
    ai-toolkit's `save_root`) or at a file inside one — so we check the dir
    itself and, when a file was given, its parent. Returns 0.0 when there's
    nothing to carry (no path, no marker, unreadable) so a resume without a
    prior marker simply starts its training clock fresh.
    """
    if not resume_state:
        return 0.0
    p = Path(resume_state)
    marker = (p if p.is_dir() else p.parent) / MARKER_NAME
    value = _read_marker(marker)
    return value if value is not None else 0.0


def record_time_markers(
    provider: str,
    output_path: str,
    output_name: str,
    training_seconds: float,
    step: int,
    job_id: str,
    seconds_by_step: Optional[dict] = None,
) -> None:
    """Drop/refresh training-time markers next to the trainer's saved state.

    Called when a checkpoint is confirmed written, and again at run end. The
    write policy differs per backend (see the module docstring): kohya gets a
    write-once snapshot per `*-state` dir; every other backend (ai-toolkit) gets
    one overwrite-latest marker in its single `save_root`.

    `seconds_by_step` maps a step to the training-seconds recorded when that
    step's checkpoint was saved. A kohya `*-step{N}-state` dir isn't guaranteed
    to be on disk at the instant we parse its save log line (sd-scripts writes
    the safetensors first, then the state dir), so we may only find it on a
    later scan — looking its value up by the step *encoded in the dir name*,
    rather than using the current (by-then larger) total, keeps the marker
    correct for the checkpoint it belongs to. Falls back to `training_seconds`
    for dirs whose step isn't in the ledger (epoch/final states).
    """
    ledger = seconds_by_step or {}
    try:
        out = Path(output_path)
    except (TypeError, ValueError):
        return

    if provider == "kohya":
        # Snapshot into each state dir that doesn't yet carry a marker. Match by
        # plain string ops rather than a glob — `output_name` is user free text
        # and may contain glob metacharacters like `[v2]` (mirrors the reasoning
        # in providers/ai_toolkit_ui._scan_checkpoints).
        if not out.is_dir():
            return
        try:
            entries = list(out.iterdir())
        except OSError:
            return
        for d in entries:
            if (
                d.is_dir()
                and d.name.startswith(output_name)
                and d.name.endswith("-state")
                and not (d / MARKER_NAME).exists()
            ):
                dir_step = _state_dir_step(d.name, output_name)
                value = ledger.get(dir_step, training_seconds)
                _write_marker(d, value, dir_step or step, job_id)
    else:
        # ai-toolkit (and any single-save_root backend): one evolving state at
        # {output_path}/{output_name}; overwrite the marker with the latest.
        root = out / output_name
        if root.is_dir():
            _write_marker(root, training_seconds, step, job_id)
