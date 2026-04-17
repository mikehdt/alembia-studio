'use client';

import { ListIcon, SaveIcon } from 'lucide-react';
import { memo, useCallback, useSyncExternalStore } from 'react';

import { Button } from '@/app/shared/button';
import { Dropdown } from '@/app/shared/dropdown';
import { SegmentedControl } from '@/app/shared/segmented-control/segmented-control';
import { ToolbarDivider } from '@/app/shared/toolbar-divider';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  selectActiveTrainingJob,
  selectPanelOpen,
  togglePanel,
} from '@/app/store/jobs';
import {
  setTrainingViewMode,
  type TrainingViewMode,
} from '@/app/store/preferences';

import { useTrainingViewMode } from './use-training-view-mode';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const VIEW_MODE_OPTIONS: { value: TrainingViewMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const VERSION_ITEMS = [{ value: 'v1', label: 'v1 — current' }];

const TrainingToolbarComponent = () => {
  const dispatch = useAppDispatch();
  const viewMode = useTrainingViewMode();
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const activeTrainingJob = useAppSelector(selectActiveTrainingJob);
  const panelOpen = useAppSelector(selectPanelOpen);

  // Mirror the TrainingBottomShelf fix: pick a default that makes SSR emit
  // no `disabled` attribute, then settle on the real value post-hydration.
  // React 19/Turbopack flags any `disabled` mismatch as a hydration error,
  // so we have to avoid rendering `disabled={true}` during SSR.
  const hasActiveJob = isClient ? activeTrainingJob !== null : true;
  const isRunning = isClient && activeTrainingJob !== null;

  const handleViewModeChange = useCallback(
    (mode: TrainingViewMode) => {
      dispatch(setTrainingViewMode(mode));
    },
    [dispatch],
  );

  return (
    <>
      {/* Left: version management (placeholders) */}
      <Dropdown
        items={VERSION_ITEMS}
        selectedValue="v1"
        onChange={() => console.log('Version selector (placeholder)')}
        aria-label="Configuration version"
      />

      <ToolbarDivider />

      <Button
        size="sm"
        variant="ghost"
        onClick={() => console.log('Save (placeholder)')}
      >
        <SaveIcon className="mr-1 h-3.5 w-3.5" />
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => console.log('Save As (placeholder)')}
      >
        Save As
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => console.log('Rename (placeholder)')}
      >
        Rename
      </Button>

      {/* Spacer */}
      <div className="mr-auto!" />

      {/* Right: queue button + view mode toggle */}
      <Button
        size="sm"
        variant="ghost"
        disabled={!hasActiveJob}
        isPressed={panelOpen}
        onClick={() => dispatch(togglePanel())}
        className="relative"
      >
        <ListIcon className="mr-1 h-3.5 w-3.5" />
        Queue
        {isRunning && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
            1
          </span>
        )}
      </Button>

      <ToolbarDivider />

      <SegmentedControl
        options={VIEW_MODE_OPTIONS}
        value={viewMode}
        onChange={handleViewModeChange}
        size="toolbar"
      />
    </>
  );
};

export const TrainingToolbar = memo(TrainingToolbarComponent);
