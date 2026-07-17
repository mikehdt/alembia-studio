/**
 * API Route: GET /api/auto-tagger/batch/active?project=<folderName>
 *
 * List tagging batches this machine knows about for a project — running,
 * queued, and terminal-but-uncollected — across both providers. VLM batches
 * live in the Python sidecar; ONNX batches live in this process's batch store.
 * A client that lost its connection (page refresh, closed tab) calls this on
 * mount to discover batches it should reattach to via
 * /api/auto-tagger/batch/attach.
 *
 * Entries are normalized to one shape so the client needs no per-provider
 * branching, and ordered so in-flight batches come before terminal ones —
 * a caller taking the first entry gets the run still worth watching.
 */

import { NextRequest, NextResponse } from 'next/server';

import { listCaptionBatches } from '@/app/services/auto-tagger/providers/vlm/client';
import { listOnnxBatches } from '@/app/services/auto-tagger/providers/wd14/batch-store';

type ActiveBatch = {
  batchId: string;
  status: string;
  current: number;
  total: number;
  project: string | null;
  providerType: 'vlm' | 'onnx';
  /** Display name for the job card — the original request isn't recoverable. */
  modelName: string;
  queuePosition: number;
  resultCount: number;
};

/** In-flight batches sort ahead of terminal ones; stable within each group. */
const IN_FLIGHT = new Set(['queued', 'loading', 'running']);

export async function GET(request: NextRequest) {
  const project = request.nextUrl.searchParams.get('project') ?? undefined;

  const captionBatches = await listCaptionBatches(project);
  const onnxBatches = listOnnxBatches(project);

  const batches: ActiveBatch[] = [
    ...captionBatches.map((b) => ({
      batchId: b.batch_id,
      status: b.status,
      current: b.current,
      total: b.total,
      project: b.project,
      providerType: 'vlm' as const,
      modelName:
        b.model_path?.split(/[\\/]/).filter(Boolean).pop() ?? 'VLM captioner',
      queuePosition: b.queue_position,
      resultCount: b.result_count,
    })),
    ...onnxBatches.map((b) => ({
      batchId: b.batchId,
      status: b.status,
      current: b.current,
      total: b.total,
      project: b.project ?? null,
      providerType: 'onnx' as const,
      modelName: b.modelName ?? 'Auto-tagger',
      // ONNX runs in-process and never enters the sidecar's GPU queue.
      queuePosition: 0,
      resultCount: b.resultCount,
    })),
  ];

  batches.sort((a, b) => {
    const aLive = IN_FLIGHT.has(a.status) ? 0 : 1;
    const bLive = IN_FLIGHT.has(b.status) ? 0 : 1;
    return aLive - bLive;
  });

  return NextResponse.json({ batches });
}
