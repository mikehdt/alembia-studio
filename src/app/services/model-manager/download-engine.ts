/**
 * Download engine for fetching model files from HuggingFace.
 *
 * This is the core download logic extracted from the auto-tagger service.
 * It accepts a target directory so callers control where files are stored.
 *
 * Server-only — do not import from client components.
 */

import fs from 'fs';
import path from 'path';

import type { DownloadProgress, ModelFile } from './types';

/**
 * Download model files from HuggingFace into `targetDir`.
 * Yields progress updates as an async generator.
 *
 * - Skips files that already exist with the correct size.
 * - Resumes partial files using HTTP Range requests when the server
 *   supports them; falls back to a fresh download otherwise.
 * - Leaves partial files in place on cancel/error so the next attempt
 *   can resume from where it left off. Use the modal's Delete action to
 *   wipe partials explicitly.
 * - Yields progress approximately every 1 MB.
 */
export async function* downloadModelFiles(
  opts: {
    modelId: string;
    downloadId: string;
    repoId: string;
    files: ModelFile[];
    targetDir: string;
    /** Optional HuggingFace API token for gated repos. */
    hfToken?: string | null;
  },
  signal?: AbortSignal,
): AsyncGenerator<DownloadProgress> {
  const { modelId, downloadId, repoId, files, targetDir, hfToken } = opts;
  const authHeaders: Record<string, string> = hfToken
    ? { Authorization: `Bearer ${hfToken}` }
    : {};

  fs.mkdirSync(targetDir, { recursive: true });

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalFiles = files.length;
  let bytesDownloaded = 0;

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const fileIndex = fileIdx + 1; // 1-based for display
    const filePath = path.join(targetDir, file.name);
    // file.name may contain subdirectories (e.g. "transformer/shard.safetensors"
    // for diffusers pipeline repos). createWriteStream won't mkdir for us.
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Inspect any existing file on disk to decide whether to skip,
    // resume, or restart this file.
    let existingSize = 0;
    if (fs.existsSync(filePath)) {
      try {
        existingSize = fs.statSync(filePath).size;
      } catch {
        existingSize = 0;
      }
    }

    // Already complete — skip and credit toward overall progress.
    if (existingSize > 0 && file.size > 0 && existingSize === file.size) {
      bytesDownloaded += existingSize;
      yield {
        downloadId,
        modelId,
        status: 'downloading',
        currentFile: file.name,
        fileIndex,
        totalFiles,
        bytesDownloaded,
        totalBytes,
      };
      continue;
    }

    // Larger than expected (corrupted / wrong file) — start fresh.
    if (file.size > 0 && existingSize > file.size) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort; createWriteStream below will overwrite anyway.
      }
      existingSize = 0;
    }

    // If file.size is 0 the manifest doesn't know the expected size,
    // so we can't safely resume — start fresh.
    const canResume = file.size > 0 && existingSize > 0;

    // Construct HuggingFace download URL
    const url = `https://huggingface.co/${repoId}/resolve/main/${file.name}`;

    // Account already-on-disk bytes toward progress before we start writing
    bytesDownloaded += existingSize;

    yield {
      downloadId,
      modelId,
      status: 'downloading',
      currentFile: file.name,
      fileIndex,
      totalFiles,
      bytesDownloaded,
      totalBytes,
    };

    let fileStream: fs.WriteStream | null = null;
    try {
      const response = await fetch(url, {
        signal,
        headers: {
          ...authHeaders,
          ...(canResume ? { Range: `bytes=${existingSize}-` } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const hint = hfToken
            ? `Access denied (${response.status}). This repo is gated — accept the license at https://huggingface.co/${repoId}`
            : `Access denied (${response.status}). This repo may be gated. Set a HuggingFace token in Model Manager → Settings, and accept the license at https://huggingface.co/${repoId}`;
          throw new Error(hint);
        }
        // 416 = range not satisfiable; treat the partial as garbage and retry fresh next time.
        if (response.status === 416) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // ignore
          }
          throw new Error('Existing partial file is unusable. Try again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 206 Partial Content = server honoured the range; append to the file.
      // 200 OK with a range header = server ignored the range; rewrite from scratch.
      const isResuming = canResume && response.status === 206;
      if (canResume && !isResuming) {
        // Server returned the full file — undo our optimistic credit and overwrite.
        bytesDownloaded -= existingSize;
        existingSize = 0;
      }

      fileStream = fs.createWriteStream(filePath, {
        flags: isResuming ? 'a' : 'w',
      });
      const reader = response.body.getReader();

      // fileBytes tracks bytes written *this attempt*, not the total file size.
      let fileBytes = 0;
      const startBytes = bytesDownloaded;

      while (true) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const { done, value } = await reader.read();

        if (done) break;

        // Wait for the chunk to be accepted by the writer before
        // counting it. This keeps `fileBytes` tightly aligned with
        // bytes actually flushed to the kernel — so the progress UI
        // matches what's on disk if the user cancels mid-download.
        const chunk = Buffer.from(value);
        const writer = fileStream;
        await new Promise<void>((resolve, reject) => {
          writer.write(chunk, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        fileBytes += chunk.length;
        bytesDownloaded = startBytes + fileBytes;

        // Yield progress every ~1MB
        if (fileBytes % (1024 * 1024) < chunk.length) {
          yield {
            downloadId,
            modelId,
            status: 'downloading',
            currentFile: file.name,
            fileIndex,
            totalFiles,
            bytesDownloaded,
            totalBytes,
          };
        }
      }

      // Wait for the writer to flush, the fd to close, and the file to
      // be visible at its final size before we either continue to the
      // next file or yield 'ready'. Using 'close' (rather than 'finish')
      // guarantees the fd has been released, so a subsequent stat sees
      // the final on-disk size.
      const completedStream = fileStream;
      fileStream = null;
      await new Promise<void>((resolve, reject) => {
        completedStream.once('close', () => resolve());
        completedStream.once('error', reject);
        completedStream.end();
      });
    } catch (error) {
      // Drain any open write stream and *await* its close before returning.
      // This is critical: if we returned while writes were still queued,
      // a fast Resume click could open a second writer on the same file
      // before the dying one finished flushing, and the two writers would
      // interleave their bytes — corrupting the partial.
      if (fileStream) {
        const dyingStream = fileStream;
        fileStream = null;
        try {
          await new Promise<void>((resolve) => {
            // 'close' fires after the fd is released, which is what we
            // need before any subsequent attempt opens the same path.
            dyingStream.once('close', () => resolve());
            dyingStream.once('error', () => resolve());
            dyingStream.end();
          });
        } catch {
          // ignore — best-effort
        }
      }

      // Aborts (user clicked Cancel, or client disconnected) are intentional —
      // don't surface them as errors. Just stop iterating; the route's
      // outer SSE handler decides whether to enqueue a final event.
      const isAbort =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError') ||
        signal?.aborted === true;
      if (isAbort) {
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      yield {
        downloadId,
        modelId,
        status: 'error',
        currentFile: file.name,
        fileIndex,
        totalFiles,
        bytesDownloaded,
        totalBytes,
        error: `Failed to download ${file.name}: ${message}`,
      };
      return;
    }
  }

  // Write a per-model manifest recording actual on-disk sizes. This is the
  // source of truth for the status checker — the declared sizes in the model
  // registry are often estimates (especially for GGUF models from HuggingFace)
  // and won't match byte-for-byte. Keyed by modelId because multiple models
  // can share a targetDir (e.g. every SDXL checkpoint lives under
  // public/models/sdxl/), and a shared manifest would make each model
  // report its neighbour's files as its own.
  try {
    const manifest: { files: { name: string; size: number }[] } = { files: [] };
    for (const file of files) {
      const filePath = path.join(targetDir, file.name);
      if (fs.existsSync(filePath)) {
        manifest.files.push({
          name: file.name,
          size: fs.statSync(filePath).size,
        });
      }
    }
    fs.writeFileSync(
      path.join(targetDir, `${modelId}.manifest.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
  } catch {
    // Manifest write is best-effort; status check falls back to declared sizes
  }

  yield {
    downloadId,
    modelId,
    status: 'ready',
    bytesDownloaded: totalBytes,
    totalBytes,
  };
}
