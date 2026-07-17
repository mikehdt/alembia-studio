/**
 * API Route: POST /api/auto-tagger/batch/clear
 *
 * Drop a terminal batch (and its stored results) once the client has flushed
 * the results — from the sidecar for VLM, from the in-process batch store for
 * ONNX. Keeps the batch lists from accumulating forever and stops
 * /batch/active re-surfacing batches the client already collected.
 */

import { NextRequest, NextResponse } from 'next/server';

import { clearCaptionBatch } from '@/app/services/auto-tagger/providers/vlm/client';
import { clearOnnxBatch } from '@/app/services/auto-tagger/providers/wd14/batch-store';

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();
    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json(
        { error: 'batchId is required' },
        { status: 400 },
      );
    }

    // The id only ever exists in one store, and clearing an unknown id is a
    // no-op. A still-running ONNX batch refuses to clear — the caller cancels
    // first and retries once it goes terminal.
    if (!clearOnnxBatch(batchId)) {
      return NextResponse.json({ status: 'still-running' }, { status: 409 });
    }
    await clearCaptionBatch(batchId);
    return NextResponse.json({ status: 'cleared' });
  } catch {
    return NextResponse.json(
      { error: 'Failed to clear batch' },
      { status: 500 },
    );
  }
}
