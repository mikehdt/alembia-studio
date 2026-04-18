'use client';

import {
  ListIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react';
import { memo, useCallback, useState, useSyncExternalStore } from 'react';

import { Button } from '@/app/shared/button';
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
import {
  resetToSuggestedDefaults,
  revertToBaseline,
  selectForm,
  selectIsDirty,
  selectLoadedProject,
} from '@/app/store/training-config';
import { saveCurrentVersion } from '@/app/store/training-config/thunks';

import { DeleteProjectModal } from './project-toolbar/delete-project-modal';
import { LoadProjectModal } from './project-toolbar/load-project-modal';
import { ProjectSelector } from './project-toolbar/project-selector';
import { SaveAsModal } from './project-toolbar/save-as-modal';
import { useTrainingViewMode } from './use-training-view-mode';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const VIEW_MODE_OPTIONS: { value: TrainingViewMode; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

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
  const loadedProject = useAppSelector(selectLoadedProject);
  const isDirty = useAppSelector(selectIsDirty);
  const form = useAppSelector(selectForm);

  const hasActiveJob = isClient ? activeTrainingJob !== null : true;
  const isRunning = isClient && activeTrainingJob !== null;

  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleViewModeChange = useCallback(
    (mode: TrainingViewMode) => {
      dispatch(setTrainingViewMode(mode));
    },
    [dispatch],
  );

  const handleSave = useCallback(() => {
    if (!loadedProject) return;
    void dispatch(saveCurrentVersion(form));
  }, [dispatch, form, loadedProject]);

  const handleReset = useCallback(() => {
    if (loadedProject && isDirty) {
      dispatch(revertToBaseline());
    } else {
      dispatch(resetToSuggestedDefaults());
    }
  }, [dispatch, isDirty, loadedProject]);

  const resetLabel =
    loadedProject && isDirty ? 'Reset changes' : 'Reset to defaults';

  return (
    <>
      {/* Left: project + save/save-as/reset/delete */}
      <ProjectSelector onRequestLoad={() => setLoadOpen(true)} />

      <ToolbarDivider />

      {loadedProject && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={!isDirty}
          title={isDirty ? `Save changes to v${loadedProject.version}` : 'No unsaved changes'}
        >
          <SaveIcon className="mr-1 h-3.5 w-3.5" />
          Save
        </Button>
      )}

      <Button size="sm" variant="ghost" onClick={() => setSaveAsOpen(true)}>
        <SaveIcon className="mr-1 h-3.5 w-3.5" />
        Save As…
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={handleReset}
        title={resetLabel}
      >
        <RotateCcwIcon className="mr-1 h-3.5 w-3.5" />
        {resetLabel}
      </Button>

      {loadedProject && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleteOpen(true)}
          title="Delete project or version"
          aria-label="Delete"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </Button>
      )}

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

      <SaveAsModal isOpen={saveAsOpen} onClose={() => setSaveAsOpen(false)} />
      <LoadProjectModal isOpen={loadOpen} onClose={() => setLoadOpen(false)} />
      <DeleteProjectModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
};

export const TrainingToolbar = memo(TrainingToolbarComponent);
