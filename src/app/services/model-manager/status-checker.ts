/**
 * Check whether a model's files are fully downloaded and ready.
 *
 * Server-only — do not import from client components.
 */

import fs from 'fs';
import path from 'path';

import type { ModelFile, ModelStatus } from './types';

type Manifest = {
  files: { name: string; size: number }[];
};

const MANIFEST_FILE = 'manifest.json';
// Tolerance for size estimate mismatch when no manifest exists (5%).
// GGUF downloads from HF can differ meaningfully from hand-declared sizes.
const SIZE_TOLERANCE = 0.05;

/** Load the manifest.json written by the download engine, if present. */
function loadManifest(modelDir: string): Manifest | null {
  const manifestPath = path.join(modelDir, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed.files || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write a manifest from actual on-disk sizes. Self-heals for pre-manifest downloads. */
function writeManifest(modelDir: string, files: ModelFile[]): void {
  try {
    const manifest: Manifest = { files: [] };
    for (const file of files) {
      const filePath = path.join(modelDir, file.name);
      if (fs.existsSync(filePath)) {
        manifest.files.push({
          name: file.name,
          size: fs.statSync(filePath).size,
        });
      }
    }
    fs.writeFileSync(
      path.join(modelDir, MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
  } catch {
    // best-effort
  }
}

/**
 * Check if a model is fully downloaded in `modelDir`.
 *
 * If a `manifest.json` exists it's treated as the source of truth for
 * both the file list and sizes — this matters for multi-variant models
 * where the on-disk file names differ per variant (e.g. Z-Image's int4
 * variant ships a single transformer safetensors, the bf16 variant
 * ships three sharded ones). The passed-in `files` array is only used
 * when no manifest is present (pre-manifest downloads or hand-placed
 * files), and sizes fall back to tolerance-matching.
 *
 * Returns:
 * - 'ready' if every expected file is present and matches its expected size
 * - 'partial' if some files exist but at least one is missing or wrong
 * - 'not_installed' if no files are present
 */
export function checkModelFiles(
  modelDir: string,
  files: ModelFile[],
): ModelStatus {
  if (!fs.existsSync(modelDir)) {
    return 'not_installed';
  }

  const manifest = loadManifest(modelDir);

  // Manifest wins. It records exactly what was downloaded, which may be
  // a variant with a different file layout than the registry default.
  if (manifest) {
    let anyExists = false;
    let allComplete = true;
    for (const entry of manifest.files) {
      const filePath = path.join(modelDir, entry.name);
      if (!fs.existsSync(filePath)) {
        allComplete = false;
        continue;
      }
      anyExists = true;
      try {
        const stats = fs.statSync(filePath);
        if (stats.size !== entry.size) allComplete = false;
      } catch {
        allComplete = false;
      }
    }
    if (allComplete && anyExists) return 'ready';
    if (anyExists) return 'partial';
    return 'not_installed';
  }

  // No manifest — fall back to the registry's declared file list with
  // size tolerance. Declared sizes for GGUF/HF downloads are often
  // estimates, so we allow a small delta rather than hard-failing.
  let anyExists = false;
  let allComplete = true;
  let inferredComplete = false;

  for (const file of files) {
    const filePath = path.join(modelDir, file.name);

    if (!fs.existsSync(filePath)) {
      allComplete = false;
      continue;
    }

    anyExists = true;

    if (file.size > 0) {
      try {
        const stats = fs.statSync(filePath);
        const delta = Math.abs(stats.size - file.size);
        const within = delta / file.size <= SIZE_TOLERANCE;
        if (!within) {
          allComplete = false;
        } else {
          inferredComplete = true;
        }
      } catch {
        allComplete = false;
      }
    }
  }

  if (allComplete && anyExists) {
    // Self-heal: persist a manifest so future checks are exact and
    // don't depend on the estimate.
    if (inferredComplete) {
      writeManifest(modelDir, files);
    }
    return 'ready';
  }
  if (anyExists) return 'partial';
  return 'not_installed';
}
