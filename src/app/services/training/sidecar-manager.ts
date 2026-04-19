/**
 * Sidecar process manager — spawns and monitors the Python FastAPI training server.
 *
 * This module is server-only (uses child_process, fs). Do not import from client code.
 */

import { type ChildProcess, execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SIDECAR_PORT = 9733;
const HEALTH_TIMEOUT_MS = 5000;
const READY_TIMEOUT_MS = 30000;

type SidecarState = {
  process: ChildProcess | null;
  port: number;
  status: 'stopped' | 'starting' | 'ready' | 'error';
  error: string | null;
};

// Module-level singleton — persists across API route invocations
const state: SidecarState = {
  process: null,
  port: SIDECAR_PORT,
  status: 'stopped',
  error: null,
};

function getAppRoot(): string {
  return process.cwd();
}

function getTrainingDir(): string {
  return path.join(getAppRoot(), '.training');
}

function getPidPath(): string {
  return path.join(getTrainingDir(), 'sidecar.pid');
}

function getSidecarDir(): string {
  return path.join(getAppRoot(), 'training-sidecar');
}

/**
 * Check whether `uv` is available on PATH.
 * Cached since PATH won't change mid-session.
 */
let uvAvailable: boolean | null = null;
function hasUv(): boolean {
  if (uvAvailable !== null) return uvAvailable;
  try {
    execSync('uv --version', { stdio: 'ignore' });
    uvAvailable = true;
  } catch {
    uvAvailable = false;
  }
  return uvAvailable;
}

/**
 * Read the Python executable path from config.json.
 * Falls back to the venv inside training-sidecar/ if not configured.
 * Only used when uv is not available.
 */
function getPythonPath(): string {
  try {
    const configPath = path.join(getAppRoot(), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.pythonPath) return config.pythonPath;
    }
  } catch {
    // Fall through to default
  }

  // Default: venv inside training-sidecar/
  const venvPython = path.join(
    getSidecarDir(),
    '.venv',
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python',
  );
  if (fs.existsSync(venvPython)) return venvPython;

  // Last resort
  return 'python';
}

/**
 * Resolve the command to spawn the sidecar.
 * Prefers `uv run` (which auto-manages the venv from pyproject.toml),
 * falls back to invoking the venv's python directly.
 */
function getSpawnCommand(): { command: string; args: string[] } {
  const appRoot = getAppRoot();
  const mainArgs = ['main.py', '--app-root', appRoot];

  if (hasUv()) {
    // uv run auto-creates the venv and installs dependencies from pyproject.toml
    // on first invocation — no manual setup required.
    return {
      command: 'uv',
      args: ['run', 'python', '-u', ...mainArgs],
    };
  }

  // Fall back to direct python invocation (requires manual venv setup)
  return {
    command: getPythonPath(),
    args: ['-u', ...mainArgs],
  };
}

/**
 * Check if a process with the given PID is still running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = check existence
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to reconnect to an existing sidecar (e.g. after Node.js restart).
 */
async function tryReconnect(): Promise<boolean> {
  const pidPath = getPidPath();
  if (!fs.existsSync(pidPath)) return false;

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    if (!isProcessAlive(pid)) {
      fs.unlinkSync(pidPath);
      return false;
    }

    // Process is alive — check health
    const healthy = await checkHealth();
    if (healthy) {
      state.status = 'ready';
      state.error = null;
      return true;
    }
  } catch {
    // Stale PID file
  }

  return false;
}

/**
 * Check if the sidecar is responding to health requests.
 */
async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const res = await fetch(`http://127.0.0.1:${state.port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Spawn the Python sidecar process.
 */
async function spawnSidecar(): Promise<void> {
  if (state.status === 'starting') return;
  state.status = 'starting';
  state.error = null;

  const sidecarDir = getSidecarDir();
  const { command, args } = getSpawnCommand();

  // Ensure .training directory exists
  const trainingDir = getTrainingDir();
  if (!fs.existsSync(trainingDir)) {
    fs.mkdirSync(trainingDir, { recursive: true });
  }

  console.log(`[sidecar] Spawning: ${command} ${args.join(' ')}`);

  const proc = spawn(command, args, {
    cwd: sidecarDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
    // On Windows, detach so the process survives Node.js HMR restarts
    detached: process.platform !== 'win32',
    // Use shell on Windows so `uv` resolves via PATH (uv is a .exe/.cmd shim)
    shell: process.platform === 'win32' && command === 'uv',
    // Prevent a console window flashing/stealing focus on Windows when we
    // spawn through a .cmd shim — stdio pipes still work without a console.
    windowsHide: true,
  });

  state.process = proc;

  // Wait for the SIDECAR_READY signal on stdout
  const ready = await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, READY_TIMEOUT_MS);

    let stdoutBuffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutBuffer += text;

      if (stdoutBuffer.includes('SIDECAR_READY')) {
        clearTimeout(timeout);
        // Parse port from the ready message
        const match = stdoutBuffer.match(/SIDECAR_READY port=(\d+)/);
        if (match) {
          state.port = parseInt(match[1], 10);
        }
        resolve(true);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr but don't treat it as fatal (uvicorn logs to stderr)
      const text = chunk.toString().trim();
      if (text) {
        console.log(`[sidecar] ${text}`);
      }
    });

    proc.on('exit', (code, signal) => {
      clearTimeout(timeout);
      console.log(`[sidecar] Process exited (code=${code}, signal=${signal})`);
      state.process = null;
      if (state.status !== 'ready') {
        state.status = 'error';
        state.error = `Sidecar exited with code ${code}`;
        resolve(false);
      } else {
        state.status = 'stopped';
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[sidecar] Failed to spawn: ${err.message}`);
      state.process = null;
      state.status = 'error';
      state.error = err.message;
      resolve(false);
    });
  });

  if (ready) {
    state.status = 'ready';
    state.error = null;
  } else if (state.status === 'starting') {
    state.status = 'error';
    state.error = state.error || 'Sidecar failed to start within timeout';
  }
}

/**
 * Ensure the sidecar is running, starting it if necessary.
 */
export async function ensureSidecar(): Promise<{
  status: 'ready' | 'error';
  port: number;
  error: string | null;
}> {
  // Already running?
  if (state.status === 'ready') {
    const healthy = await checkHealth();
    if (healthy) {
      return { status: 'ready', port: state.port, error: null };
    }
    // Stale state — reset
    state.status = 'stopped';
    state.process = null;
  }

  // Try reconnecting to an orphaned sidecar
  if (await tryReconnect()) {
    return { status: 'ready', port: state.port, error: null };
  }

  // Spawn fresh
  await spawnSidecar();

  // Re-read state after spawn (spawnSidecar mutates it)
  const currentStatus = state.status as string;
  return {
    status: currentStatus === 'ready' ? ('ready' as const) : ('error' as const),
    port: state.port,
    error: state.error,
  };
}

/**
 * Get the current sidecar status without starting it.
 */
export function getSidecarStatus(): {
  status: string;
  port: number;
  error: string | null;
} {
  return {
    status: state.status,
    port: state.port,
    error: state.error,
  };
}

/**
 * Shut down the sidecar process gracefully.
 */
function shutdownSidecar(): void {
  if (!state.process) return;

  if (process.platform === 'win32') {
    // On Windows, taskkill is the reliable way to kill a process tree
    spawn('taskkill', ['/F', '/T', '/PID', String(state.process.pid)]);
  } else {
    state.process.kill('SIGTERM');
  }

  state.process = null;
  state.status = 'stopped';
}
