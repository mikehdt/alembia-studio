import path from 'path';

import { isSupportedVideoExtension } from '@/app/constants';

/**
 * The name a client can render the processed file under, given the path the
 * batch runner resolved. Poster frames and plain images come back as-is; a raw
 * video (passed whole to a video-capable model, so no poster was extracted)
 * returns undefined, as no <img> can display it. Derived from the resolved
 * path rather than rebuilt from the asset so the poster naming convention
 * lives in one place — `ensureVideoPoster`.
 *
 * Shared by the live batch stream and the reattach replay so both produce the
 * same thumbnail name for the same image.
 */
export function displayName(resolvedPath: string): string | undefined {
  return isSupportedVideoExtension(path.extname(resolvedPath))
    ? undefined
    : path.basename(resolvedPath);
}
