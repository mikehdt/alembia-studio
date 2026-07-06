import { NextResponse } from 'next/server';

import {
  connectSidecar,
  getSidecarActiveJob,
  shutdownSidecar,
} from '@/app/services/training/sidecar-manager';

/**
 * POST /api/training/sidecar/shutdown — Stop the Python sidecar without
 * re-spawning it. The next action that needs it will start it on demand.
 *
 * Guarded: refuses (409) while a training job is active unless `{ force: true }`
 * is sent — shutting down mid-run kills the training. The body is optional.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  // Only guard when the sidecar is actually reachable; if it's already down,
  // there's nothing to protect.
  const sidecar = await connectSidecar();
  if (sidecar.status === 'ready' && !force) {
    const activeJob = await getSidecarActiveJob();
    if (activeJob) {
      return NextResponse.json(
        {
          error: 'A job is currently running on the sidecar.',
          activeJob,
        },
        { status: 409 },
      );
    }
  }

  const result = await shutdownSidecar();
  return NextResponse.json(result);
}
