'use client';

import { ActivityIcon, ChevronDownIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { memo, useCallback, useEffect, useRef } from 'react';

import { abortTagging } from '@/app/services/auto-tagger/tagging-controllers';
import { useIsAnyModalOpen } from '@/app/shared/modal';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  cancelTagging,
  clearCompletedJobs,
  closePanel,
  openPanel,
  restoreJobs,
  selectActiveJobs,
  selectCompletedJobs,
  selectHasJobs,
  selectPanelOpen,
  selectPendingJobs,
  type TaggingJob,
} from '@/app/store/jobs';
import { loadPersistedDownloads } from '@/app/store/jobs/persistence';

import { DownloadJobCard } from './download-job-card';
import { PendingJobsList } from './pending-jobs-list';
import { TaggingJobCard } from './tagging-job-card';
import { TrainingJobCard } from './training-job-card';
import { useDownloadActions } from './use-download-actions';

const ActivityPanelComponent = () => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const isAnyModalOpen = useIsAnyModalOpen();
  const panelOpen = useAppSelector(selectPanelOpen);
  const hasJobs = useAppSelector(selectHasJobs);
  const activeJobs = useAppSelector(selectActiveJobs);
  const pendingJobs = useAppSelector(selectPendingJobs);
  const completedJobs = useAppSelector(selectCompletedJobs);

  // Push up above the bottom shelf on views that have one
  const hasBottomShelf =
    pathname.startsWith('/tagging') || pathname.startsWith('/training');
  const bottomClass = hasBottomShelf ? 'bottom-16' : 'bottom-4';

  // Restore persisted downloads from localStorage on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const persisted = loadPersistedDownloads();
    if (persisted.length > 0) {
      dispatch(restoreJobs(persisted));
      if (persisted.some((j) => j.status === 'interrupted')) {
        dispatch(openPanel());
      }
    }
  }, [dispatch]);

  const handleOpen = useCallback(() => {
    dispatch(openPanel());
  }, [dispatch]);

  const handleClose = useCallback(() => {
    dispatch(closePanel());
  }, [dispatch]);

  const {
    retry: handleRetryDownload,
    cancel: handleCancelDownload,
    remove: handleDeleteDownload,
  } = useDownloadActions();

  const handleCancelTagging = useCallback(
    (job: TaggingJob) => {
      abortTagging(job.id);
      dispatch(cancelTagging(job.id));
    },
    [dispatch],
  );

  const handleClearAll = useCallback(() => {
    dispatch(clearCompletedJobs());
  }, [dispatch]);

  if (!hasJobs || isAnyModalOpen) return null;

  const activeCount = activeJobs.length;
  const hasActive = activeCount > 0;
  const hasClearable = completedJobs.length > 0;

  // Minimised: floating icon button
  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className={`fixed right-4 ${bottomClass} z-50 flex cursor-pointer items-center justify-center rounded-full border border-(--border-subtle) bg-(--surface) p-2.5 shadow-lg shadow-slate-800/20 transition-colors hover:bg-(--surface-hover)`}
        title="Show activity"
      >
        <ActivityIcon
          className={`h-4.5 w-4.5 ${hasActive ? 'text-sky-500' : 'text-(--foreground)/50'}`}
        />
        {hasActive && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
    );
  }

  // Expanded: full panel
  return (
    <div
      className={`fixed right-4 ${bottomClass} z-50 w-80 overflow-hidden rounded-lg border border-slate-300 bg-(--surface) shadow-lg shadow-slate-800/20 dark:border-slate-600`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-(--border-subtle) bg-slate-200 px-3 py-2 inset-shadow-sm inset-shadow-white dark:bg-slate-700 dark:inset-shadow-slate-600">
        <span className="text-sm text-(--foreground)">
          Activity
          {hasActive && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Minimise"
        >
          <ChevronDownIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Jobs list */}
      <div className="max-h-96 overflow-y-auto">
        {/* Pending jobs */}
        {pendingJobs.length > 0 && <PendingJobsList jobs={pendingJobs} />}

        {/* Active jobs */}
        {activeJobs.map((job) =>
          job.type === 'training' ? (
            <TrainingJobCard key={job.id} job={job} />
          ) : job.type === 'tagging' ? (
            <TaggingJobCard
              key={job.id}
              job={job}
              onCancel={handleCancelTagging}
            />
          ) : (
            <DownloadJobCard
              key={job.id}
              job={job}
              onRetry={handleRetryDownload}
              onCancel={handleCancelDownload}
              onDelete={handleDeleteDownload}
            />
          ),
        )}

        {/* Completed/failed/interrupted jobs */}
        {completedJobs.map((job) =>
          job.type === 'training' ? (
            <TrainingJobCard key={job.id} job={job} />
          ) : job.type === 'tagging' ? (
            <TaggingJobCard key={job.id} job={job} />
          ) : (
            <DownloadJobCard
              key={job.id}
              job={job}
              onRetry={handleRetryDownload}
              onCancel={handleCancelDownload}
              onDelete={handleDeleteDownload}
            />
          ),
        )}
      </div>

      {/* Footer with Clear All */}
      {hasClearable && (
        <div className="flex justify-end border-t border-(--border-subtle) px-3 py-1.5">
          <button
            type="button"
            onClick={handleClearAll}
            className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export const ActivityPanel = memo(ActivityPanelComponent);
