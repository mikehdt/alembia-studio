/**
 * API Route: POST /api/auto-tagger/batch/cancel
 *
 * Explicitly cancel a running batch. Since a client abort no longer cancels
 * the run (batches survive tab closes for reattach), this is the only way a
 * user cancel reaches the runner — sidecar-side for VLM, the in-process batch
 * store for ONNX.
 */

import { NextRequest, NextResponse } from 'next/server';

import { cancelCaptionBatch } from '@/app/services/auto-tagger/providers/vlm/client';
import { requestOnnxCancel } from '@/app/services/auto-tagger/providers/wd14/batch-store';

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();
    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 },
      );
    }

    // ONNX batches live in this process; the id alone tells us which store
    // owns the run, so the client cancels without knowing the provider.
    // An ONNX cancel lands at the next image boundary — there's no way to
    // interrupt an in-flight inference.
    if (requestOnnxCancel(batchId)) {
      return NextResponse.json({ status: 'cancelling' });
    }

    // Best-effort: a 404 on the sidecar just means the batch already ended.
    await cancelCaptionBatch(batchId);
    return NextResponse.json({ status: 'cancelling' });
  } catch {
    return NextResponse.json(
      { error: 'Failed to cancel batch' },
      { status: 500 },
    );
  }
}
