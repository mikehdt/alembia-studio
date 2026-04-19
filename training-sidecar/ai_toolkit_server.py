"""Lifecycle manager for ai-toolkit's bundled web UI / API server.

ai-toolkit ships a Next.js + cron-worker app under `<toolkit>/ui` that
exposes the HTTP API we use to drive training (POST /api/jobs, etc.).
Rather than depend on the user starting it manually, this module
ensures it's running whenever we need it — detecting an existing
instance on the configured port, otherwise spawning `npm run start`
from the ui directory and waiting for readiness.

We track only servers we spawned ourselves so we don't kill a user's
manually-started instance on shutdown.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

import httpx


class AiToolkitServer:
    """Manages a (possibly external) ai-toolkit web server on `localhost:port`."""

    def __init__(
        self,
        toolkit_path: Path,
        port: int = 8675,
        log_path: Optional[Path] = None,
    ):
        self._toolkit_path = Path(toolkit_path)
        self._port = port
        self._process: Optional[asyncio.subprocess.Process] = None
        # True if we spawned the server (we own its lifecycle); False if
        # we attached to a pre-existing one (don't kill it on shutdown).
        self._owns_process = False
        self._log_path = log_path
        self._log_handle = None

    @property
    def port(self) -> int:
        return self._port

    @property
    def base_url(self) -> str:
        return f"http://localhost:{self._port}"

    async def ensure_running(self, timeout: float = 180.0) -> None:
        """Make sure the ai-toolkit server is responding. Spawns one if needed.

        Raises RuntimeError on failure.
        """
        if await self._is_responding():
            return

        ui_dir = self._toolkit_path / "ui"
        if not ui_dir.exists():
            raise RuntimeError(
                f"ai-toolkit ui directory not found at {ui_dir}. "
                "Make sure the trainingBackends['ai-toolkit'] path in config.json "
                "points at the AI-Toolkit folder (not its parent)."
            )

        npm = shutil.which("npm")
        if npm is None:
            raise RuntimeError(
                "`npm` not found on PATH. ai-toolkit's UI server is a Node app "
                "and needs Node.js installed to run."
            )

        env = self._build_clean_env()

        # Open a log file we can tail so the user can actually see what
        # ai-toolkit's worker / Next server is doing — silent failures
        # in the worker process were previously invisible (the queue
        # would just sit "stopped" with no clue why).
        if self._log_path is not None:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            self._log_handle = open(self._log_path, "w", encoding="utf-8")
            print(
                f"[aitk-server] Starting ai-toolkit UI server in {ui_dir} "
                f"(log: {self._log_path})"
            )
        else:
            print(
                f"[aitk-server] Starting ai-toolkit UI server in {ui_dir} "
                f"(this may take a moment on first run)..."
            )

        # Prevent npm.cmd from opening a visible console that steals focus
        # on Windows; stdio is piped to our log file either way.
        creationflags = 0
        if sys.platform == "win32":
            import subprocess

            creationflags = subprocess.CREATE_NO_WINDOW

        self._process = await asyncio.create_subprocess_exec(
            npm,
            "run",
            "start",
            cwd=str(ui_dir),
            env=env,
            stdout=self._log_handle if self._log_handle else asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.STDOUT
            if self._log_handle
            else asyncio.subprocess.DEVNULL,
            creationflags=creationflags,
        )
        self._owns_process = True

        await self._wait_for_ready(timeout)
        print(f"[aitk-server] ai-toolkit UI ready at {self.base_url}")

    async def stop(self) -> None:
        """Shut down the server — only if we spawned it."""
        if not self._owns_process or self._process is None:
            return

        try:
            if sys.platform == "win32":
                # Kill the npm process tree (npm spawns workers + Next).
                os.system(f"taskkill /F /T /PID {self._process.pid} >nul 2>&1")
            else:
                self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=10)
            except asyncio.TimeoutError:
                self._process.kill()
        except ProcessLookupError:
            pass

        self._process = None
        self._owns_process = False

        if self._log_handle is not None:
            try:
                self._log_handle.close()
            except OSError:
                pass
            self._log_handle = None

    # ----- internals -----

    async def _is_responding(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                # /api/jobs is cheap (just a SELECT * FROM Job) and exists
                # in every recent ai-toolkit build.
                res = await client.get(f"{self.base_url}/api/jobs")
                return res.status_code < 500
        except (httpx.HTTPError, OSError):
            return False

    async def _wait_for_ready(self, timeout: float) -> None:
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            if await self._is_responding():
                return
            # If our subprocess died early, fail fast
            if self._process and self._process.returncode is not None:
                raise RuntimeError(
                    f"ai-toolkit UI server exited unexpectedly with code "
                    f"{self._process.returncode}. Try running "
                    f"`npm run start` from {self._toolkit_path / 'ui'} manually "
                    "to see the error."
                )
            await asyncio.sleep(1.0)
        raise RuntimeError(
            f"ai-toolkit UI server did not become ready on {self.base_url} "
            f"within {timeout:.0f}s."
        )

    def _build_clean_env(self) -> dict[str, str]:
        """Match the env-clearing the upstream Start-AI-Toolkit.bat does.

        These vars can confuse the embedded Python the UI's child workers
        use when invoking run.py.
        """
        env = dict(os.environ)
        env["GIT_LFS_SKIP_SMUDGE"] = "1"
        for key in (
            "PYTHONPATH",
            "PYTHONHOME",
            "PYTHON",
            "PYTHONSTARTUP",
            "PYTHONUSERBASE",
            "PIP_CONFIG_FILE",
            "PIP_REQUIRE_VIRTUALENV",
            "VIRTUAL_ENV",
            "CONDA_PREFIX",
            "CONDA_DEFAULT_ENV",
            "PYENV_ROOT",
            "PYENV_VERSION",
        ):
            env.pop(key, None)

        # Prepend python_embeded so the UI's worker can find its own python.
        embed = self._toolkit_path.parent / "python_embeded"
        if embed.exists():
            scripts = embed / "Scripts"
            extra = f"{embed};{scripts}" if sys.platform == "win32" else str(embed)
            env["PATH"] = extra + os.pathsep + env.get("PATH", "")

        return env
