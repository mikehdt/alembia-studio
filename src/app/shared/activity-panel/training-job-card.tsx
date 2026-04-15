import { XIcon } from 'lucide-react';
import { useMemo } from 'react';

import { SCHEDULER_OPTIONS } from '@/app/services/training/models';
import { useAppDispatch } from '@/app/store/hooks';
import { removeJob, type TrainingJob } from '@/app/store/jobs';
import { cancelMockTraining } from '@/app/store/training/mock-training';
import { SchedulerSparkline } from '@/app/training/components/scheduler-sparkline';

import { ProgressBar } from '../progress-bar/progress-bar';
import { ActionButton } from './action-button';
import { formatDuration } from './helpers';

export function TrainingJobCard({ job }: { job: TrainingJob }) {
  const dispatch = useAppDispatch();

  const isRunning = job.status === 'running' || job.status === 'preparing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isDone = !isRunning;

  const progress = job.progress;
  const config = job.config;

  const pct =
    progress && progress.totalSteps > 0
      ? Math.round((progress.currentStep / progress.totalSteps) * 100)
      : 0;

  const elapsed =
    progress?.completedAt != null && progress.startedAt != null
      ? progress.completedAt - progress.startedAt
      : null;

  const checkpointPositions = progress?.checkpointSteps ?? [];
  const savedCount = checkpointPositions.length;

  const schedulerCurve = useMemo(() => {
    const schedulerName = config?.hyperparameters?.scheduler;
    if (!schedulerName) return null;
    return (
      SCHEDULER_OPTIONS.find((s) => s.value === schedulerName)?.curve ?? null
    );
  }, [config]);

  return (
    <div className="border-b border-(--border-subtle) inset-shadow-sm inset-shadow-slate-100 last:border-b-0 dark:inset-shadow-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isRunning
                ? 'animate-pulse bg-sky-500'
                : isCompleted
                  ? 'bg-green-500'
                  : isFailed
                    ? 'bg-red-500'
                    : 'bg-slate-400'
            }`}
          />
          <span className="text-xs font-medium text-(--foreground)">
            {config?.outputName || 'Training'}
          </span>
        </div>
      </div>

      {/* Scheduler curve */}
      {schedulerCurve && isRunning && (
        <div className="border-t border-dashed border-(--border-subtle) px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase">
              LR Schedule
            </span>
            {progress?.learningRate != null && (
              <span className="text-xs text-slate-400 tabular-nums">
                LR {progress.learningRate}
              </span>
            )}
          </div>
          <div className="mt-1 rounded bg-slate-100 p-1 dark:bg-slate-800">
            <SchedulerSparkline
              curve={schedulerCurve}
              width={264}
              height={40}
              className="w-full text-sky-500"
            />
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="px-3 pb-2.5">
        <ProgressBar
          value={progress?.currentStep ?? 0}
          max={progress?.totalSteps ?? 1}
          color={isCompleted ? 'green' : isFailed ? 'red' : 'sky'}
          indeterminate={!progress}
          marks={checkpointPositions}
          className="mb-2"
        />

        <div className="flex items-baseline justify-between text-xs tabular-nums">
          <span className="text-slate-500">
            {progress
              ? `Step ${progress.currentStep.toLocaleString()} / ${progress.totalSteps.toLocaleString()}`
              : 'Preparing...'}
          </span>
          <span className="font-medium text-(--foreground)">{pct}%</span>
        </div>

        {progress && progress.loss !== null && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
            <span>
              Loss{' '}
              <span className="font-medium text-(--foreground)">
                {progress.loss}
              </span>
            </span>
            {progress.etaSeconds !== null && progress.etaSeconds > 0 && (
              <span>
                ETA{' '}
                <span className="font-medium text-(--foreground)">
                  {progress.etaSeconds}s
                </span>
              </span>
            )}
            {savedCount > 0 && (
              <span>
                {savedCount} checkpoint{savedCount !== 1 ? 's' : ''} saved
              </span>
            )}
          </div>
        )}

        {isCompleted && (
          <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
            Complete{elapsed != null ? ` in ${formatDuration(elapsed)}` : ''}
            {savedCount > 0 &&
              ` · ${savedCount} checkpoint${savedCount !== 1 ? 's' : ''}`}
          </p>
        )}
        {isFailed && progress?.error && (
          <p className="mt-1.5 text-xs text-red-500">{progress.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-dashed border-(--border-subtle) px-3 py-1.5">
        {isRunning && (
          <ActionButton
            onClick={() => dispatch(cancelMockTraining(job.id))}
            title="Cancel training"
            variant="danger"
          >
            <XIcon className="h-2.5 w-2.5" />
            Cancel
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
