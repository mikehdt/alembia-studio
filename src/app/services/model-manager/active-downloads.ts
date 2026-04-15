/**
 * Server-side registry of model downloads currently in flight.
 *
 * Each Node process keeps a single Set of modelIds that are being actively
 * fetched to disk. The download route marks the id before starting the
 * stream and clears it on completion, error, or client abort. The status
 * route consults this set so other browser tabs can distinguish a real
 * partial/interrupted download from bytes that are landing right now —
 * and suppress Delete / Resume actions that would collide with the live
 * write.
 *
 * Server-only — do not import from client components.
 */

const active = new Set<string>();

export function markDownloadActive(modelId: string): void {
  active.add(modelId);
}

export function markDownloadInactive(modelId: string): void {
  active.delete(modelId);
}

export function isDownloadActive(modelId: string): boolean {
  return active.has(modelId);
}
