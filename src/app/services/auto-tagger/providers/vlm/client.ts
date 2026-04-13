/**
 * Node-side client for the Python sidecar's captioning endpoints.
 *
 * Spins up the sidecar if needed, calls /caption or /caption/batch,
 * and streams batch progress via the /ws/caption WebSocket.
 */

import { ensureSidecar } from '@/app/services/training/sidecar-manager';

import { getModelDir, getModelFilePath } from '../../model-manager';
import type { TaggerModel, VlmOptions, VlmRuntime } from '../../types';

type CaptionResult = {
  imagePath: string;
  caption: string;
};

/** Model loading status yielded while the sidecar loads weights. */
type LoadingStatus = {
  loading: true;
  message: string;
  current: number;
  total: number;
};

/**
 * Emitted once when the sidecar transitions from "loading" to "running"
 * after a successful model load. The route translates this into a
 * progress event with current=0 so the UI clears its loading overlay
 * before the first image finishes captioning.
 */
type LoadingCompleteStatus = {
  loadingComplete: true;
};

type BatchStatus = 'loading' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Shape as sent by the Python sidecar (snake_case fields from Pydantic). */
type RawBatchProgressEvent = {
  channel?: string;
  batch_id: string;
  current: number;
  total: number;
  image_path?: string | null;
  caption?: string | null;
  status: BatchStatus;
  error?: string | null;
  message?: string | null;
};

/** Normalized shape used by the rest of the Node code (camelCase). */
type BatchProgressEvent = {
  batchId: string;
  current: number;
  total: number;
  imagePath?: string;
  caption?: string;
  status: BatchStatus;
  error?: string;
  message?: string;
};

function normalizeEvent(raw: RawBatchProgressEvent): BatchProgressEvent {
  return {
    batchId: raw.batch_id,
    current: raw.current,
    total: raw.total,
    imagePath: raw.image_path ?? undefined,
    caption: raw.caption ?? undefined,
    status: raw.status,
    error: raw.error ?? undefined,
    message: raw.message ?? undefined,
  };
}

/**
 * Resolve the path the sidecar should load.
 *
 * - llama-cpp runtime: GGUF models have a single primary weights file; we
 *   return its absolute path. The sidecar opens that file directly.
 * - transformers runtime: safetensors releases are a *directory* of files
 *   (config.json, tokenizer, weight shards). We return the model directory
 *   so `from_pretrained(dir)` picks up everything.
 */
function getVlmModelPath(model: TaggerModel): string {
  if (model.files.length === 0) {
    throw new Error(`VLM model ${model.id} has no files defined`);
  }
  if (model.runtime === 'transformers') {
    return getModelDir(model);
  }
  return getModelFilePath(model, model.files[0].name);
}

/** The runtime the sidecar should use to load this model. */
function getRuntime(model: TaggerModel): VlmRuntime {
  return model.runtime ?? 'llama-cpp';
}

/**
 * Caption a single image via the sidecar.
 * Synchronous-ish: waits for the result and returns it.
 */
async function captionImageViaSidecar(
  model: TaggerModel,
  imagePath: string,
  options: VlmOptions,
): Promise<string> {
  const sidecar = await ensureSidecar();
  if (sidecar.status !== 'ready') {
    throw new Error(`Sidecar not ready: ${sidecar.error ?? 'unknown error'}`);
  }

  const modelPath = getVlmModelPath(model);
  const runtime = getRuntime(model);

  const res = await fetch(`http://127.0.0.1:${sidecar.port}/caption`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_path: imagePath,
      model_path: modelPath,
      runtime,
      prompt: options.prompt,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Sidecar caption failed: ${res.status}`);
  }

  const body = (await res.json()) as { image_path: string; caption: string };
  return body.caption;
}

/**
 * Start a batch caption run on the sidecar and stream progress back.
 * Returns an async generator yielding per-image results.
 *
 * The sidecar streams progress via WebSocket, which we consume and
 * yield as structured events to the caller. The caller (API route)
 * translates them into SSE events for the browser.
 */
export async function* captionBatchViaSidecar(
  model: TaggerModel,
  imagePaths: string[],
  options: VlmOptions,
  batchId: string,
): AsyncGenerator<
  | CaptionResult
  | { error: string; imagePath?: string }
  | LoadingStatus
  | LoadingCompleteStatus
> {
  const sidecar = await ensureSidecar();
  if (sidecar.status !== 'ready') {
    throw new Error(`Sidecar not ready: ${sidecar.error ?? 'unknown error'}`);
  }

  const modelPath = getVlmModelPath(model);
  const runtime = getRuntime(model);

  // Open the WebSocket first so we don't miss early progress events
  const ws = new WebSocket(`ws://127.0.0.1:${sidecar.port}/ws/caption`);

  const progressQueue: BatchProgressEvent[] = [];
  let resolveNext: ((value: BatchProgressEvent | null) => void) | null = null;
  let wsOpen = false;
  let wsError: Error | null = null;

  ws.addEventListener('open', () => {
    wsOpen = true;
  });

  ws.addEventListener('message', (event) => {
    const raw =
      typeof event.data === 'string'
        ? event.data
        : // Coerce Buffer/ArrayBuffer/Blob to string as a safety net
          String(event.data);
    try {
      const parsed = JSON.parse(raw) as RawBatchProgressEvent;
      if (parsed.channel !== 'caption') return;
      const data = normalizeEvent(parsed);
      if (resolveNext) {
        resolveNext(data);
        resolveNext = null;
      } else {
        progressQueue.push(data);
      }
    } catch (err) {
      console.warn('[vlm-client] parse error:', err);
    }
  });

  ws.addEventListener('error', () => {
    wsError = new Error('WebSocket error');
    if (resolveNext) {
      resolveNext(null);
      resolveNext = null;
    }
  });

  ws.addEventListener('close', () => {
    if (resolveNext) {
      resolveNext(null);
      resolveNext = null;
    }
  });

  // Wait for the WebSocket to open (or error out quickly)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!wsOpen) reject(new Error('WebSocket connection timed out'));
    }, 5000);
    const onOpen = () => {
      clearTimeout(timeout);
      resolve();
    };
    if (wsOpen) {
      clearTimeout(timeout);
      resolve();
    } else {
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        },
        { once: true },
      );
    }
  });

  // Kick off the batch on the sidecar
  const startRes = await fetch(
    `http://127.0.0.1:${sidecar.port}/caption/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: batchId,
        image_paths: imagePaths,
        model_path: modelPath,
        runtime,
        prompt: options.prompt,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
    },
  );

  if (!startRes.ok) {
    ws.close();
    const errBody = await startRes
      .json()
      .catch(() => ({ error: startRes.statusText }));
    throw new Error(
      errBody.error || `Sidecar batch start failed: ${startRes.status}`,
    );
  }

  // Consume progress events from the queue/WebSocket
  try {
    while (true) {
      const event: BatchProgressEvent | null =
        progressQueue.shift() ??
        (await new Promise<BatchProgressEvent | null>((resolve) => {
          resolveNext = resolve;
        }));

      if (event === null) {
        console.log('[vlm-client] consumer got null, exiting loop', {
          wsError,
        });
        if (wsError) throw wsError;
        break;
      }
      console.log('[vlm-client] consumer got event', {
        status: event.status,
        imagePath: event.imagePath,
        hasCaption: !!event.caption,
        hasError: !!event.error,
      });

      // Loading progress — yield a discriminated shape the route can
      // forward as an SSE `loading` event without confusing with results.
      if (event.status === 'loading') {
        yield {
          loading: true,
          message: event.message ?? 'Loading model',
          current: event.current,
          total: event.total,
        };
        continue;
      }

      // "Running" transition with no image payload: sent by the sidecar
      // immediately after model load completes, before the first image is
      // captioned. Signals the UI to drop its loading overlay.
      if (
        event.status === 'running' &&
        !event.imagePath &&
        !event.caption &&
        !event.error
      ) {
        yield { loadingComplete: true };
        continue;
      }

      // Per-image errors
      if (event.error && event.status === 'running') {
        yield { error: event.error, imagePath: event.imagePath };
        continue;
      }

      // Per-image success
      if (event.imagePath && event.caption && event.status === 'running') {
        yield { imagePath: event.imagePath, caption: event.caption };
      }

      // Terminal states
      if (
        event.status === 'completed' ||
        event.status === 'failed' ||
        event.status === 'cancelled'
      ) {
        if (event.status === 'failed' && event.error) {
          throw new Error(event.error);
        }
        break;
      }
    }
  } finally {
    ws.close();
  }
}

/**
 * Cancel an in-progress caption batch on the sidecar.
 */
export async function cancelCaptionBatch(batchId: string): Promise<void> {
  const sidecar = await ensureSidecar();
  if (sidecar.status !== 'ready') return;

  await fetch(
    `http://127.0.0.1:${sidecar.port}/caption/batch/${encodeURIComponent(batchId)}/cancel`,
    { method: 'POST' },
  ).catch(() => {
    // best-effort
  });
}
