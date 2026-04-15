import { Loader } from '@/app/shared/loader';
import { ProgressBar } from '@/app/shared/progress-bar/progress-bar';
import { IoState, LoadProgress, SaveProgress } from '@/app/store/assets';

interface LoadingStatusProps {
  ioState: IoState;
  saveProgress: SaveProgress | null;
  loadProgress: LoadProgress | null;
}

export const LoadingStatus = ({
  ioState,
  saveProgress,
  loadProgress,
}: LoadingStatusProps) => {
  const hasProgress =
    (saveProgress?.total && saveProgress.total > 0) ||
    (loadProgress?.total && loadProgress.total > 0);

  return (
    <>
      <div className="border border-white/0 px-1 py-0.5">
        <Loader className="h-6 w-6" />
      </div>

      <div className="ml-1 text-xs font-medium text-(--foreground) tabular-nums">
        {(ioState === IoState.SAVING || ioState === IoState.COMPLETING) &&
        saveProgress?.total ? (
          <>
            {saveProgress.completed} / {saveProgress.total}
            {saveProgress.failed > 0 &&
              ` (${saveProgress.failed} error${saveProgress.failed !== 1 ? 's' : ''})`}
          </>
        ) : null}

        {(ioState === IoState.LOADING || ioState === IoState.COMPLETING) &&
        loadProgress?.total ? (
          <>
            {loadProgress.total > 0
              ? `${loadProgress.completed} / ${loadProgress.total}`
              : ''}
            {loadProgress.failed > 0
              ? ` (${loadProgress.failed} error${loadProgress.failed !== 1 ? 's' : ''})`
              : ''}
          </>
        ) : null}

        {(ioState === IoState.SAVING ||
          ioState === IoState.LOADING ||
          ioState === IoState.COMPLETING) &&
        !saveProgress?.total &&
        !loadProgress?.total ? (
          <>Preparing...</>
        ) : null}

        {/* Mini progress bar */}
        {hasProgress ? (
          <ProgressBar
            value={
              saveProgress?.total
                ? saveProgress.completed
                : (loadProgress?.completed ?? 0)
            }
            max={
              saveProgress?.total
                ? saveProgress.total
                : (loadProgress?.total ?? 1)
            }
            size="sm"
            color="teal"
            className="mt-1 w-24"
          />
        ) : null}
      </div>
    </>
  );
};
