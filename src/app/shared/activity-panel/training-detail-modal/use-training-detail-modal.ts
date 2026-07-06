import { useCallback, useEffect, useMemo, useRef } from 'react';

import { buildLrScheduleCurve } from '@/app/services/training/lr-schedule';
import { useAppSelector } from '@/app/store/hooks';
import { selectJobById, type TrainingJob } from '@/app/store/jobs';

/**
 * Drives the training detail modal. Reads the job straight from Redux by ID
 * rather than accepting it as a prop, so the modal keeps live-updating (and
 * stays mounted) even while the activity panel that would otherwise pass it
 * down has hidden itself for having a modal open.
 */
export function useTrainingDetailModal(
  jobId: string | null,
  onClose: () => void,
) {
  const job = useAppSelector((state): TrainingJob | null => {
    if (!jobId) return null;
    const found = selectJobById(jobId)(state);
    return found && found.type === 'training' ? found : null;
  });

  // If the job disappears from the list while the modal is open (cleared,
  // or dropped on refresh), close rather than show stale/empty content.
  useEffect(() => {
    if (jobId && !job) onClose();
  }, [jobId, job, onClose]);

  const progress = job?.progress ?? null;
  const config = job?.config ?? null;

  const totalSteps = progress?.totalSteps ?? 0;
  const lrCurve = useMemo(() => {
    const hp = config?.hyperparameters;
    if (!hp) return null;
    return buildLrScheduleCurve({
      scheduler: hp.scheduler,
      totalSteps,
      warmupSteps: hp.warmupSteps ?? 0,
      numRestarts: Number(hp.extra?.numRestarts ?? 1) || 1,
    });
  }, [config, totalSteps]);

  // Auto-scroll the log panel to the bottom while training runs, unless the
  // user has scrolled up to read earlier lines.
  const logRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);

  const handleLogScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < 24;
  }, []);

  useEffect(() => {
    if (!pinnedToBottomRef.current) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [progress?.logLines]);

  return { job, progress, config, lrCurve, logRef, handleLogScroll };
}
