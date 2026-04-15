import { DownloadIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react';

import { useAppDispatch } from '@/app/store/hooks';
import { type DownloadJob, removeJob } from '@/app/store/jobs';

import { ProgressBar } from '../progress-bar/progress-bar';
import { ActionButton } from './action-button';
import { formatBytes } from './helpers';

export function DownloadJobCard({
  job,
  onRetry,
  onCancel,
  onDelete,
}: {
  job: DownloadJob;
  onRetry?: (job: DownloadJob) => void;
  onCancel?: (job: DownloadJob) => void;
  onDelete?: (job: DownloadJob) => void;
}) {
  const dispatch = useAppDispatch();

  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isInterrupted = job.status === 'interrupted';
  const isCancelled = job.status === 'cancelled';
  const canRetry = isFailed || isInterrupted || isCancelled;
  const isDone = !isRunning;

  const iconColour = isRunning
    ? 'text-indigo-500'
    : isCompleted
      ? 'text-green-500'
      : isFailed || isInterrupted
        ? 'text-amber-500'
        : 'text-slate-400';

  const currentFileLabel = job.progress?.currentFile || 'Preparing...';
  const multiFile =
    job.progress?.totalFiles !== undefined && job.progress.totalFiles > 1;
  const fileCountLabel = multiFile
    ? `File ${job.progress?.fileIndex ?? 1} of ${job.progress?.totalFiles}`
    : null;

  const statusLabel = isInterrupted
    ? 'Interrupted'
    : isCancelled
      ? 'Cancelled'
      : isFailed
        ? 'Failed'
        : isCompleted
          ? 'Done'
          : currentFileLabel;

  return (
    <div className="border-b border-(--border-subtle) px-3 py-2.5 last:border-b-0">
      {/* Header */}
      <div className="flex items-center gap-2">
        <DownloadIcon className={`h-3.5 w-3.5 shrink-0 ${iconColour}`} />
        <span className="text-xs font-medium text-(--foreground)">
          {job.modelName}
        </span>
      </div>

      {/* Progress bar */}
      {(isRunning || isCompleted || canRetry) && (
        <div className="mt-2">
          <ProgressBar
            value={isCompleted ? 1 : (job.progress?.bytesDownloaded ?? 0)}
            max={isCompleted ? 1 : (job.progress?.totalBytes ?? 1)}
            size="xs"
            color={isCompleted ? 'green' : canRetry ? 'amber' : 'indigo'}
            indeterminate={isRunning && !job.progress}
            className="mb-1"
          />
          {isRunning && fileCountLabel && (
            <p className="text-xs text-slate-400">{fileCountLabel}</p>
          )}
          <div className="flex justify-between text-xs text-slate-500 tabular-nums">
            <span className="truncate">{statusLabel}</span>
            <span className="shrink-0 pl-2 text-right">
              {job.progress
                ? `${formatBytes(job.progress.bytesDownloaded)} / ${formatBytes(job.progress.totalBytes)}`
                : ''}
            </span>
          </div>
        </div>
      )}

      {isFailed && job.error && (
        <p className="mt-1 text-xs text-red-500">{job.error}</p>
      )}

      {/* Actions */}
      <div className="mt-1.5 flex items-center justify-end gap-1">
        {isRunning && onCancel && (
          <ActionButton
            onClick={() => onCancel(job)}
            title="Cancel download"
            variant="danger"
          >
            <XIcon className="h-2.5 w-2.5" />
            Cancel
          </ActionButton>
        )}
        {canRetry && onRetry && (
          <ActionButton onClick={() => onRetry(job)} title="Retry download">
            <RefreshCwIcon className="h-2.5 w-2.5" />
            Retry
          </ActionButton>
        )}
        {canRetry && onDelete && (
          <ActionButton
            onClick={() => onDelete(job)}
            title="Delete partial files and remove"
            variant="danger"
          >
            <Trash2Icon className="h-2.5 w-2.5" />
            Delete
          </ActionButton>
        )}
        {isDone && (
          <>
            <div className="mr-auto" />
            <ActionButton
              onClick={() => dispatch(removeJob(job.id))}
              title="Clear from list"
            >
              <XIcon className="h-2.5 w-2.5" />
              Clear
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
}
