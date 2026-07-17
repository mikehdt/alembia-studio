import {
  ExternalLinkIcon,
  Maximize2Icon,
  ScanSearchIcon,
  XIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useConfirmAction } from '@/app/shared/use-confirm-action';
import { useAppDispatch } from '@/app/store/hooks';
import { removeJob, type TaggingJob } from '@/app/store/jobs';

import { ProgressBar } from '../progress-bar/progress-bar';
import { ActionButton } from './action-button';
import { deriveTaggingBar, deriveTaggingStatusLabel } from './helpers';

export function TaggingJobCard({
  job,
  onCancel,
  onEnlarge,
}: {
  job: TaggingJob;
  onCancel?: (job: TaggingJob) => void;
  onEnlarge: (jobId: string) => void;
}) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();

  // Two-step confirm, as on the training card — the button sits right beside
  // Enlarge in a cramped row, so a stray click shouldn't kill a batch.
  const { armed: confirmingCancel, trigger: handleCancelClick } =
    useConfirmAction(() => onCancel?.(job));

  // Only show the link when the user isn't already viewing this project's tagging page
  const projectHref = `/tagging/${encodeURIComponent(job.projectFolderName)}/1`;
  const isOnProjectPage = pathname.startsWith(
    `/tagging/${encodeURIComponent(job.projectFolderName)}`,
  );

  const isRunning = job.status === 'running' || job.status === 'preparing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';
  const isDone = !isRunning;

  const progress = job.progress;
  const summary = job.summary;

  // A completed batch may still have per-image errors — treat it as partial
  // success so the card colour reflects what actually happened.
  const errorCount = summary?.errorCount ?? 0;
  const hasPartialErrors = isCompleted && errorCount > 0;

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const bar = deriveTaggingBar(job);

  const iconColour = isRunning
    ? 'text-indigo-500'
    : hasPartialErrors
      ? 'text-amber-500'
      : isCompleted
        ? 'text-green-500'
        : isFailed
          ? 'text-red-500'
          : 'text-slate-400';

  return (
    <div className="border-b border-(--border-subtle) px-3 py-2.5 last:border-b-0">
      {/* Header — project on the first line with the actions, model beneath,
          so the action row lands in the same place as the training card's. */}
      <div className="flex items-center gap-2">
        <ScanSearchIcon className={`h-3.5 w-3.5 shrink-0 ${iconColour}`} />
        {isOnProjectPage ? (
          <span className="truncate text-xs font-medium text-(--foreground)">
            {job.projectName}
          </span>
        ) : (
          <Link
            href={projectHref}
            className="group flex min-w-0 items-center gap-1 truncate text-xs font-medium text-(--foreground) hover:text-sky-500"
            title={`Open project: ${job.projectName}`}
          >
            <span className="truncate">{job.projectName}</span>
            <ExternalLinkIcon className="h-2.5 w-2.5 shrink-0 text-slate-400 group-hover:text-sky-500" />
          </Link>
        )}

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ActionButton onClick={() => onEnlarge(job.id)} title="Enlarge">
            <Maximize2Icon className="h-2.5 w-2.5" />
            Enlarge
          </ActionButton>
          {isRunning && onCancel && (
            <ActionButton
              onClick={handleCancelClick}
              title={
                confirmingCancel
                  ? 'Click again to confirm cancellation'
                  : 'Cancel tagging'
              }
              variant="danger"
            >
              <XIcon className="h-2.5 w-2.5" />
              {confirmingCancel ? 'Confirm?' : 'Cancel'}
            </ActionButton>
          )}
          {isDone && (
            <ActionButton
              onClick={() => dispatch(removeJob(job.id))}
              title="Clear from list"
            >
              <XIcon className="h-2.5 w-2.5" />
              Clear
            </ActionButton>
          )}
        </div>
      </div>

      <span className="mt-0.5 block truncate pl-5.5 text-xs text-slate-400">
        {job.modelName}
      </span>

      {/* Progress */}
      <div className="mt-2">
        <ProgressBar
          value={bar.value}
          max={bar.max}
          size="xs"
          color={
            hasPartialErrors
              ? 'amber'
              : isCompleted
                ? 'green'
                : isFailed || isCancelled
                  ? 'amber'
                  : 'indigo'
          }
          indeterminate={bar.indeterminate}
          className="mb-1"
        />
        <div className="flex justify-between text-xs text-slate-500 tabular-nums">
          <span className="truncate">{deriveTaggingStatusLabel(job)}</span>
          {isRunning && progress && (
            <span className="shrink-0 pl-2 text-right">
              {progress.current} / {progress.total} · {pct}%
            </span>
          )}
        </div>
      </div>

      {isFailed && job.error && (
        <p className="mt-1 text-xs text-red-500">{job.error}</p>
      )}
    </div>
  );
}
