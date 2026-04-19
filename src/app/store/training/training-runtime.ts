/**
 * Training runtime thunks: start, cancel, hydrate.
 *
 * Talks to `/api/training/*` and opens a direct WebSocket to the sidecar
 * on `ws/progress` to stream live progress into Redux.
 */

import type {
  TrainingJobConfig,
  TrainingJobStatus,
  TrainingProgress,
  TrainingProvider,
} from '@/app/services/training/types';

import type { AppThunk, RootState } from '../index';

// WebSocket handlers need a dispatch function that accepts thunks + actions.
// Inside a thunk, `dispatch` is typed with an `unknown` extra-arg slot while
// the exported AppDispatch resolves with `undefined`, so the two aren't
// assignment-compatible. Accept a loose dispatch here — we only use it to
// forward known action creators.
type ThunkDispatch = (action: unknown) => unknown;
import {
  addJob,
  openPanel,
  removeJob,
  updateTrainingProgress,
} from '../jobs';
import type { TrainingJob } from '../jobs/types';
import { addToast } from '../toasts/reducers';

// ---------------------------------------------------------------------------
// Sidecar progress payload (snake_case — matches training-sidecar/models.py)
// ---------------------------------------------------------------------------

type SidecarJobStatus =
  | 'pending'
  | 'preparing'
  | 'training'
  | 'completed'
  | 'failed'
  | 'cancelled';

type SidecarJobProgress = {
  job_id: string;
  status: SidecarJobStatus;
  current_step?: number;
  total_steps?: number;
  current_epoch?: number;
  total_epochs?: number;
  loss?: number | null;
  learning_rate?: number | null;
  eta_seconds?: number | null;
  sample_image_paths?: string[];
  log_lines?: string[];
  error?: string | null;
};

// ---------------------------------------------------------------------------
// WebSocket singleton
// ---------------------------------------------------------------------------

type WsState = {
  socket: WebSocket | null;
  /** Job ID we're currently streaming progress for. */
  jobId: string | null;
  /** Checkpoint step positions pre-computed from the form config. */
  allCheckpointSteps: number[];
  /** When the job was seeded locally — used for progress.startedAt. */
  startedAt: number;
};

const ws: WsState = {
  socket: null,
  jobId: null,
  allCheckpointSteps: [],
  startedAt: 0,
};

function closeSocket() {
  if (ws.socket) {
    try {
      ws.socket.close();
    } catch {
      // Ignore close errors — we're tearing down anyway.
    }
  }
  ws.socket = null;
}

function mapStatus(s: SidecarJobStatus): TrainingJobStatus {
  // Types are identical but keep the indirection explicit in case they
  // drift in future.
  return s;
}

function buildProgress(
  jobId: string,
  msg: SidecarJobProgress,
): TrainingProgress {
  const currentStep = msg.current_step ?? 0;
  const checkpointSteps = ws.allCheckpointSteps.filter((s) => s <= currentStep);
  const status = mapStatus(msg.status);
  const terminal =
    status === 'completed' || status === 'failed' || status === 'cancelled';

  return {
    jobId,
    status,
    startedAt: ws.startedAt || Date.now(),
    completedAt: terminal ? Date.now() : null,
    currentStep,
    totalSteps: msg.total_steps ?? 0,
    currentEpoch: msg.current_epoch ?? 0,
    totalEpochs: msg.total_epochs ?? 0,
    loss: msg.loss ?? null,
    learningRate: msg.learning_rate ?? null,
    etaSeconds: msg.eta_seconds ?? null,
    sampleImagePaths: msg.sample_image_paths ?? [],
    checkpointSteps,
    logLines: msg.log_lines ?? [],
    error: msg.error ?? null,
  };
}

function openProgressSocket(
  dispatch: ThunkDispatch,
  jobId: string,
  port: number,
) {
  closeSocket();
  ws.jobId = jobId;

  const url = `ws://127.0.0.1:${port}/ws/progress`;
  const socket = new WebSocket(url);
  ws.socket = socket;

  socket.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data as string) as SidecarJobProgress;
      // The sidecar currently broadcasts a single active job at a time,
      // but filter defensively in case that changes.
      if (ws.jobId && msg.job_id && msg.job_id !== ws.jobId) return;

      const progress = buildProgress(jobId, msg);
      dispatch(updateTrainingProgress({ id: jobId, progress }));

      if (
        progress.status === 'completed' ||
        progress.status === 'failed' ||
        progress.status === 'cancelled'
      ) {
        closeSocket();
      }
    } catch (err) {
      console.warn('[training-ws] Failed to parse message:', err);
    }
  });

  socket.addEventListener('close', () => {
    if (ws.socket === socket) {
      ws.socket = null;
    }
  });

  socket.addEventListener('error', () => {
    // Error handling: the sidecar may restart; we'll leave the job in its
    // current Redux state and let the next hydrate call recover.
    console.warn('[training-ws] Socket error — progress streaming stopped');
  });
}

// ---------------------------------------------------------------------------
// Checkpoint step derivation (UI-only — sidecar doesn't report these)
// ---------------------------------------------------------------------------

function deriveCheckpointSteps(config: Record<string, unknown>): number[] {
  const saveEnabled = (config.saveEnabled as boolean) ?? false;
  if (!saveEnabled) return [];

  const totalSteps = (config.steps as number) || 0;
  const epochs = (config.epochs as number) || 0;
  const saveMode = (config.saveMode as string) ?? 'epochs';
  const saveEveryEpochs = (config.saveEveryEpochs as number) ?? 1;
  const saveEverySteps = (config.saveEverySteps as number) ?? 100;

  const out: number[] = [];
  if (saveMode === 'epochs' && saveEveryEpochs > 0 && epochs > 0) {
    const stepsPerEpoch = Math.max(1, Math.ceil(totalSteps / epochs));
    for (let e = saveEveryEpochs; e <= epochs; e += saveEveryEpochs) {
      out.push(Math.min(e * stepsPerEpoch, totalSteps));
    }
  } else if (saveMode === 'steps' && saveEverySteps > 0) {
    for (let s = saveEverySteps; s <= totalSteps; s += saveEverySteps) {
      out.push(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Config snapshot for the Redux TrainingJob
// ---------------------------------------------------------------------------

function snapshotClientConfig(
  config: Record<string, unknown>,
): TrainingJobConfig {
  return {
    projectPath: '',
    provider: (config.provider as TrainingProvider) ?? 'ai-toolkit',
    baseModel: (config.modelId as string) ?? '',
    modelPaths: (config.modelPaths as Record<string, string>) ?? {},
    outputPath: '',
    outputName: (config.outputName as string) ?? 'unnamed-lora',
    datasets: [],
    hyperparameters: {
      learningRate: (config.learningRate as number) ?? 1e-4,
      epochs: (config.epochs as number) ?? 20,
      batchSize: (config.batchSize as number) ?? 1,
      resolution: Array.isArray(config.resolution)
        ? ((config.resolution as number[])[0] ?? 1024)
        : ((config.resolution as number) ?? 1024),
      networkDim: (config.networkDim as number) ?? 16,
      networkAlpha: (config.networkAlpha as number) ?? 16,
      optimizer: (config.optimizer as string) ?? 'adamw8bit',
      scheduler: (config.scheduler as string) ?? 'constant',
      warmupSteps: (config.warmupSteps as number) ?? 0,
      saveEveryNEpochs: (config.saveEveryEpochs as number) ?? 1,
      sampleEveryNSteps: (config.sampleEverySteps as number) ?? 250,
      gradientAccumulationSteps:
        (config.gradientAccumulationSteps as number) ?? 1,
      mixedPrecision: (config.mixedPrecision as 'bf16' | 'fp16') ?? 'bf16',
      extra: {},
    },
    samplePrompts: (config.samplePrompts as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// startTraining — replaces the old mock thunk.
// ---------------------------------------------------------------------------

export function startTraining(config: Record<string, unknown>): AppThunk {
  return async (dispatch) => {
    // No client-side GPU-busy gate — the sidecar owns a shared queue
    // across training + tagging, so additional jobs enqueue behind whatever
    // is currently running rather than being rejected.

    // Ensure the sidecar is running before we POST /api/training/start.
    let sidecarPort = 9733;
    try {
      const res = await fetch('/api/training/sidecar', { method: 'POST' });
      const data = (await res.json()) as {
        status: string;
        port: number;
        error: string | null;
      };
      if (data.status !== 'ready') {
        dispatch(
          addToast({
            variant: 'error',
            children: `Training sidecar failed to start: ${data.error ?? 'unknown error'}`,
          }),
        );
        return;
      }
      sidecarPort = data.port;
    } catch (err) {
      dispatch(
        addToast({
          variant: 'error',
          children: `Could not reach training sidecar: ${err}`,
        }),
      );
      return;
    }

    // POST /api/training/start — server translates to sidecar shape.
    let jobId: string;
    try {
      const res = await fetch('/api/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = (await res.json()) as {
        job_id?: string;
        error?: string;
        sidecar_port?: number;
      };
      if (!res.ok || !data.job_id) {
        dispatch(
          addToast({
            variant: 'error',
            children: `Training failed to start: ${data.error ?? 'unknown error'}`,
          }),
        );
        return;
      }
      jobId = data.job_id;
      if (data.sidecar_port) sidecarPort = data.sidecar_port;
    } catch (err) {
      dispatch(
        addToast({
          variant: 'error',
          children: `Failed to start training: ${err}`,
        }),
      );
      return;
    }

    // Seed Redux and open the progress socket.
    ws.allCheckpointSteps = deriveCheckpointSteps(config);
    ws.startedAt = Date.now();

    const job: TrainingJob = {
      id: jobId,
      type: 'training',
      status: 'pending',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
      config: snapshotClientConfig(config),
      progress: null,
    };
    dispatch(addJob(job));
    dispatch(openPanel());

    openProgressSocket(dispatch, jobId, sidecarPort);
  };
}

// ---------------------------------------------------------------------------
// cancelTraining
// ---------------------------------------------------------------------------

export function cancelTraining(jobId: string): AppThunk {
  return async (dispatch) => {
    try {
      await fetch('/api/training/cancel', { method: 'POST' });
    } catch (err) {
      console.warn('[training] cancel failed:', err);
    }
    // The sidecar will broadcast a final 'cancelled' progress event, which
    // updates job state. If the WS is dead, remove the job optimistically.
    if (!ws.socket) {
      dispatch(removeJob(jobId));
    }
  };
}

// ---------------------------------------------------------------------------
// clearTrainingJob — remove a terminal job locally AND tell the sidecar to
// drop it from `active_job` so it doesn't reappear on the next hydrate.
// ---------------------------------------------------------------------------

export function clearTrainingJob(jobId: string): AppThunk {
  return async (dispatch) => {
    dispatch(removeJob(jobId));
    try {
      await fetch('/api/training/clear', { method: 'POST' });
    } catch (err) {
      console.warn('[training] clear failed:', err);
    }
  };
}

// ---------------------------------------------------------------------------
// hydrateActiveTraining — recover an in-flight job after page refresh.
// ---------------------------------------------------------------------------

export function hydrateActiveTraining(): AppThunk {
  return async (dispatch, getState) => {
    // If we already have a socket open, nothing to do.
    if (ws.socket && ws.socket.readyState <= WebSocket.OPEN) return;

    let active: {
      job_id: string;
      status: SidecarJobStatus;
      config?: Record<string, unknown>;
      progress?: SidecarJobProgress;
      started_at?: string;
    } | null = null;
    let sidecarPort = 9733;

    try {
      const [statusRes, sidecarRes] = await Promise.all([
        fetch('/api/training/status'),
        fetch('/api/training/sidecar'),
      ]);
      const statusData = (await statusRes.json()) as {
        active: boolean;
        job_id?: string;
        status?: SidecarJobStatus;
        config?: Record<string, unknown>;
        progress?: SidecarJobProgress;
        started_at?: string;
      };
      const sidecarData = (await sidecarRes.json()) as { port?: number };
      if (sidecarData.port) sidecarPort = sidecarData.port;

      if (statusData.active && statusData.job_id && statusData.status) {
        active = {
          job_id: statusData.job_id,
          status: statusData.status,
          config: statusData.config,
          progress: statusData.progress,
          started_at: statusData.started_at,
        };
      }
    } catch (err) {
      console.warn('[training] hydrate failed:', err);
      return;
    }

    if (!active) return;

    // Don't re-seed if this job is already in Redux — the middleware may
    // have persisted it, in which case we only need to reattach the WS.
    const existing = (getState() as RootState).jobs.jobs[active.job_id];
    if (!existing) {
      ws.startedAt = active.started_at
        ? Date.parse(active.started_at)
        : Date.now();
      // Reconstruct a minimal TrainingJob. Sidecar config is snake_case —
      // pick out the fields used for rendering the job card.
      const cfg = active.config ?? {};
      const provider =
        (cfg.provider as TrainingProvider) ??
        (cfg.provider_type as TrainingProvider) ??
        'ai-toolkit';
      const job: TrainingJob = {
        id: active.job_id,
        type: 'training',
        status:
          active.status === 'training' || active.status === 'preparing'
            ? 'running'
            : active.status,
        createdAt: ws.startedAt,
        startedAt: ws.startedAt,
        completedAt: null,
        error: active.progress?.error ?? null,
        config: {
          projectPath: (cfg.project_path as string) ?? '',
          provider,
          baseModel: (cfg.base_model as string) ?? '',
          modelPaths: {},
          outputPath: (cfg.output_path as string) ?? '',
          outputName: (cfg.output_name as string) ?? 'unnamed-lora',
          datasets: [],
          hyperparameters: {
            learningRate:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.lr as number) ?? 1e-4,
            epochs:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.epochs as number) ?? 0,
            batchSize:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.batch_size as number) ?? 1,
            resolution: 1024,
            networkDim:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.network_dim as number) ?? 16,
            networkAlpha:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.network_alpha as number) ?? 16,
            optimizer:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.optimizer as string) ?? 'adamw8bit',
            scheduler:
              ((cfg.hyperparameters as Record<string, unknown>)
                ?.scheduler as string) ?? 'constant',
            warmupSteps: 0,
            saveEveryNEpochs: 1,
            sampleEveryNSteps: 250,
            gradientAccumulationSteps: 1,
            mixedPrecision: 'bf16',
            extra: {},
          },
          samplePrompts: [],
        },
        progress: active.progress
          ? buildProgress(active.job_id, active.progress)
          : null,
      };
      dispatch(addJob(job));
    } else {
      ws.startedAt = existing.startedAt ?? Date.now();
    }

    // Only attach a WS if the job is still in-flight.
    if (active.status === 'training' || active.status === 'preparing') {
      openProgressSocket(dispatch, active.job_id, sidecarPort);
      // Surface the activity panel so the refresh doesn't silently drop it.
      dispatch(openPanel());
    }
  };
}
