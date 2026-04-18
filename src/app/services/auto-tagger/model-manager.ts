/**
 * Auto-tagger Model Manager
 *
 * Computes auto-tagger-specific storage paths and exposes status checks.
 * Downloading goes through the unified model-manager download flow
 * (`/api/model-manager/download`), so this file no longer wraps it.
 */

import path from 'path';

import { checkModelFiles } from '../model-manager/status-checker';
import type { ModelStatus } from '../model-manager/types';
import type { TaggerModel } from './types';

// Models are stored in a .auto-tagger directory in the project root
const MODELS_DIR = path.join(process.cwd(), '.auto-tagger', 'models');

/**
 * Get the local directory path for a model.
 * For multi-file models (e.g. transformers safetensors releases) this is
 * also the path passed to `from_pretrained` in the sidecar.
 */
export function getModelDir(model: TaggerModel): string {
  return path.join(MODELS_DIR, model.provider, model.id);
}

/**
 * Get the path to a specific model file
 */
export function getModelFilePath(model: TaggerModel, fileName: string): string {
  return path.join(getModelDir(model), fileName);
}

/**
 * Check if a model is fully downloaded and ready
 */
export function checkModelStatus(model: TaggerModel): ModelStatus {
  return checkModelFiles(getModelDir(model), model.id, model.files);
}
