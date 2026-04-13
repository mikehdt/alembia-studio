/**
 * API Route: POST /api/auto-tagger/batch
 * Tag multiple images with streaming progress updates via SSE
 */

import fs from 'fs';
import { NextRequest } from 'next/server';
import path from 'path';

import { isSupportedVideoExtension } from '@/app/constants';
import type {
  TaggerOptions,
  TagResult,
  VlmOptions,
} from '@/app/services/auto-tagger';
import {
  DEFAULT_TAGGER_OPTIONS,
  DEFAULT_VLM_OPTIONS,
  getModel,
  getProviderTypeForModel,
} from '@/app/services/auto-tagger';
import { checkModelStatus } from '@/app/services/auto-tagger/model-manager';
import {
  cancelCaptionBatch,
  captionBatchViaSidecar,
} from '@/app/services/auto-tagger/providers/vlm/client';
import { tagImageInWorker } from '@/app/services/auto-tagger/providers/wd14/worker-manager';
import { ensureVideoPoster } from '@/app/utils/asset-actions';

// Server-side config reading function
const getServerConfig = () => {
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      return {
        projectsFolder: config.projectsFolder || 'public/assets',
      };
    }
  } catch (error) {
    console.warn('Failed to read server config:', error);
  }
  return {
    projectsFolder: 'public/assets',
  };
};

type BatchTagRequest = {
  modelId: string;
  projectPath: string;
  assets: { fileId: string; fileExtension: string }[];
  /** ONNX (WD14) options — threshold, includeCharacterTags, etc. */
  options?: Partial<TaggerOptions>;
  /** VLM (NL captioner) options — prompt, temperature, max tokens */
  vlmOptions?: Partial<VlmOptions>;
  /**
   * Project trigger phrases — injected into the VLM prompt when
   * `vlmOptions.injectTriggerPhrases` is true. Ignored by ONNX batches.
   */
  triggerPhrases?: string[];
};

type BatchProgressEvent = {
  type: 'progress' | 'result' | 'complete' | 'error' | 'loading';
  current?: number;
  total?: number;
  fileId?: string;
  /** ONNX tagger result — comma-separated tags for the image */
  tags?: string[];
  /** VLM captioner result — natural-language caption for the image */
  caption?: string;
  error?: string;
  /** Free-form status text for `loading` events (e.g. "Loading checkpoint shards") */
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body: BatchTagRequest = await request.json();
    const {
      modelId,
      projectPath: rawProjectPath,
      assets,
      options: userOptions,
      vlmOptions: userVlmOptions,
      triggerPhrases = [],
    } = body;

    // Resolve to absolute path
    // The projectPath from client could be:
    // 1. An absolute path (e.g., "C:\images\project")
    // 2. A path relative to cwd (e.g., "public/assets/project")
    // 3. Just the project folder name if config uses an absolute projectsFolder
    let projectPath: string;
    if (path.isAbsolute(rawProjectPath)) {
      projectPath = rawProjectPath;
    } else {
      // Check if the path exists as-is (relative to cwd)
      const resolvedPath = path.resolve(rawProjectPath);
      if (fs.existsSync(resolvedPath)) {
        projectPath = resolvedPath;
      } else {
        // Try with the configured projects folder
        const config = getServerConfig();
        projectPath = path.resolve(
          path.join(config.projectsFolder, rawProjectPath),
        );
      }
    }

    // Validation
    if (!modelId) {
      return new Response(JSON.stringify({ error: 'modelId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!rawProjectPath) {
      return new Response(
        JSON.stringify({ error: 'projectPath is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: 'assets array is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const model = getModel(modelId);
    if (!model) {
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = checkModelStatus(model);
    if (status !== 'ready') {
      return new Response(
        JSON.stringify({ error: 'Model is not installed', status }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const options: TaggerOptions = {
      ...DEFAULT_TAGGER_OPTIONS,
      ...userOptions,
    };

    const vlmOptions: VlmOptions = {
      ...DEFAULT_VLM_OPTIONS,
      ...userVlmOptions,
    };

    // If the user wants trigger phrases injected, append a must-include
    // instruction to the end of the prompt. Done here rather than in the
    // sidecar so the sidecar stays agnostic about project-level concepts.
    // Trailing position matters: VLMs weight the last line of the prompt
    // more heavily than earlier context when deciding what to produce.
    //
    // We use ` | ` as a separator (with surrounding spaces) rather than
    // commas, because trigger phrases can be multi-word or even full
    // sentences with punctuation inside — commas would be ambiguous, and
    // the pipe is rare enough in natural prose to act as a clean delimiter.
    if (
      vlmOptions.injectTriggerPhrases &&
      triggerPhrases.length > 0 &&
      getProviderTypeForModel(modelId) === 'vlm'
    ) {
      const phraseList = triggerPhrases
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .join(' | ');
      if (phraseList.length > 0) {
        vlmOptions.prompt = `${vlmOptions.prompt.trimEnd()}\n\nYou must reproduce each of the following phrases verbatim — word for word, including any punctuation — at least once in the caption. Phrases are separated by a pipe character (|):\n${phraseList}`;
      }
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const total = assets.length;
    const providerType = getProviderTypeForModel(modelId);
    // Capture narrowed model so nested helpers don't lose the non-null type
    const resolvedModel = model;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: BatchProgressEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        };

        try {
          if (providerType === 'vlm') {
            await runVlmBatch(sendEvent);
          } else {
            await runOnnxBatch(sendEvent);
          }

          sendEvent({ type: 'complete', total });
          controller.close();
        } catch (err) {
          sendEvent({
            type: 'error',
            error:
              err instanceof Error ? err.message : 'Batch processing failed',
          });
          controller.close();
        }
      },
    });

    // --- ONNX (WD14 worker) batch runner ---
    //
    // Semantics for `progress.current`: number of images COMPLETED so far.
    // - At the start, current=0 (from the hook's initial job state).
    // - After each image finishes, current increments.
    // - Final emit guarantees current=total so the progress bar reaches 100%.
    // The display converts `current` to a 1-based label via `min(current+1, total)`.
    async function runOnnxBatch(
      sendEvent: (event: BatchProgressEvent) => void,
    ) {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const sourcePath = path.join(
          projectPath,
          `${asset.fileId}.${asset.fileExtension}`,
        );

        // For video assets, tag the extracted poster frame instead of the
        // raw video file (the WD14 worker only knows how to load images).
        let imagePath: string | null = sourcePath;
        if (isSupportedVideoExtension(`.${asset.fileExtension}`)) {
          imagePath = await ensureVideoPoster(sourcePath);
        }

        if (!imagePath) {
          sendEvent({
            type: 'error',
            fileId: asset.fileId,
            error: 'Failed to extract poster frame from video',
          });
          const completed = i + 1;
          const nextFileId = assets[i + 1]?.fileId ?? asset.fileId;
          sendEvent({
            type: 'progress',
            current: completed,
            total,
            fileId: nextFileId,
          });
          continue;
        }

        try {
          const output = await tagImageInWorker(
            resolvedModel,
            imagePath,
            options,
          );

          const allTags: TagResult[] = [];
          allTags.push(...output.general);
          if (options.includeCharacterTags) allTags.push(...output.character);
          if (options.includeRatingTags && output.rating.length > 0) {
            allTags.push(output.rating[0]);
          }
          const includedTags = (options.includeTags || []).map((tag) => ({
            tag,
            confidence: 1.0,
          }));
          allTags.push(...includedTags);

          allTags.sort((a, b) => b.confidence - a.confidence);
          let tagNames = allTags.map((t) => t.tag);
          tagNames = [...new Set(tagNames)];

          sendEvent({
            type: 'result',
            fileId: asset.fileId,
            tags: tagNames,
          });
        } catch (err) {
          sendEvent({
            type: 'error',
            fileId: asset.fileId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }

        // Emit completion of this image. `current` = images completed so far.
        // The UI derives the "currently processing" label as min(current+1, total).
        const completed = i + 1;
        const nextFileId = assets[i + 1]?.fileId ?? asset.fileId;
        sendEvent({
          type: 'progress',
          current: completed,
          total,
          fileId: nextFileId,
        });
      }
    }

    // --- VLM (sidecar) batch runner ---
    async function runVlmBatch(sendEvent: (event: BatchProgressEvent) => void) {
      // Build ordered list of image paths. The sidecar processes them in order
      // and yields one event per image, so we match results back to assets by
      // their sequence index rather than by path string — this avoids subtle
      // path-normalisation mismatches between Node and Python.
      const imagePaths = assets.map((a) =>
        path.join(projectPath, `${a.fileId}.${a.fileExtension}`),
      );

      const batchId = `batch-${Date.now()}`;

      // When the client aborts the fetch (user hit Cancel), forward the cancel
      // to the sidecar so it stops mid-inference instead of grinding through
      // the rest of the batch. The sidecar's cancel_check closure flips inside
      // the running generate loop, aborts the current image, and marks the
      // batch as cancelled. Fire-and-forget — the sidecar endpoint is idempotent.
      const onAbort = () => {
        cancelCaptionBatch(batchId).catch(() => {
          /* best-effort */
        });
      };
      request.signal.addEventListener('abort', onAbort, { once: true });

      // Same semantics as runOnnxBatch: `current` = images completed so far.
      // Starts at 0 (set by the hook's initial job state), hits `total` at the end.
      let completed = 0;

      const generator = captionBatchViaSidecar(
        resolvedModel,
        imagePaths,
        vlmOptions,
        batchId,
      );

      try {
        for await (const event of generator) {
          // Loading progress from the sidecar — forwarded as-is so the UI
          // can show "Loading checkpoint shards 1/2" during the first-use
          // model load. No completion-count bump; loading is a side-channel.
          if ('loading' in event) {
            sendEvent({
              type: 'loading',
              message: event.message,
              current: event.current,
              total: event.total,
            });
            continue;
          }

          // Load complete — emit a progress event at 0/total (with no
          // `loading` sub-state) so the client clears the loading overlay
          // and switches to the "Captioning 1 of N" view before the first
          // image finishes. Without this, the UI would sit on the last
          // loading tick for the full duration of the first inference.
          if ('loadingComplete' in event) {
            sendEvent({
              type: 'progress',
              current: 0,
              total,
              fileId: assets[0]?.fileId,
            });
            continue;
          }

          const asset = assets[completed];
          if ('error' in event) {
            sendEvent({
              type: 'error',
              fileId: asset?.fileId,
              error: event.error,
            });
          } else if (asset) {
            sendEvent({
              type: 'result',
              fileId: asset.fileId,
              caption: event.caption,
            });
          }

          // Advance completion count after each event (success or error).
          completed++;
          const nextFileId =
            assets[completed]?.fileId ?? assets[completed - 1]?.fileId;
          sendEvent({
            type: 'progress',
            current: completed,
            total,
            fileId: nextFileId,
          });
        }
      } finally {
        request.signal.removeEventListener('abort', onAbort);
      }
    }

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Batch tagging error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to start batch tagging' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
