'use client';

import { ListIcon, RotateCcwIcon, SaveIcon } from 'lucide-react';
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
  selectCanReset,
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
  // Defer Redux-derived values until after hydration so server + initial
  // client render always agree on the `disabled` shape. Explicit Boolean()
  // coercion guarantees the prop is a concrete boolean — never null — so
  // the hydration diff can't flag shape drift on the button element.
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const activeTrainingJob = useAppSelector(selectActiveTrainingJob);
  const panelOpen = useAppSelector(selectPanelOpen);
  const loadedProject = useAppSelector(selectLoadedProject);
  const isDirty = useAppSelector(selectIsDirty);
  const canReset = useAppSelector(selectCanReset);
  const form = useAppSelector(selectForm);

  const hasActiveJob = isClient ? activeTrainingJob !== null : true;
  const isRunning = isClient && activeTrainingJob !== null;
  const effectiveCanReset = isClient ? Boolean(canReset) : false;
  const effectiveIsDirty = isClient ? Boolean(isDirty) : false;

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

  const resetLabel = loadedProject ? 'Reset to saved' : 'Reset to defaults';

  return (
    <>
      {/* Left: project menu + save + reset */}
      <ProjectSelector
        onRequestLoad={() => setLoadOpen(true)}
        onRequestSaveAs={() => setSaveAsOpen(true)}
        onRequestDelete={() => setDeleteOpen(true)}
      />

      <ToolbarDivider />

      {loadedProject && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={effectiveIsDirty === false}
          title={
            effectiveIsDirty
              ? `Save changes to v${loadedProject.version}`
              : 'No unsaved changes'
          }
        >
          <SaveIcon className="mr-1 h-3.5 w-3.5" />
          Save
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={handleReset}
        disabled={effectiveCanReset === false}
        title={
          effectiveCanReset
            ? resetLabel
            : loadedProject
              ? 'No unsaved changes to reset'
              : 'Already at defaults'
        }
      >
        <RotateCcwIcon className="mr-1 h-3.5 w-3.5" />
        {resetLabel}
      </Button>

      {/* Spacer */}
      <div className="mr-auto!" />

      {/* Right: queue button + view mode toggle */}
      <Button
        size="sm"
        variant="ghost"
        disabled={hasActiveJob === false}
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
