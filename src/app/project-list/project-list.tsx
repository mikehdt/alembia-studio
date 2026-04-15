'use client';

import {
  BoxesIcon,
  FolderClosedIcon,
  FolderOpenIcon,
  FolderXIcon,
  PencilIcon,
  SettingsIcon,
  StarIcon,
} from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/app/shared/button';
import { Checkbox } from '@/app/shared/checkbox';
import { MenuProjectsFolder } from '@/app/shared/menu-projects-folder';
import { MenuThemeSwitcher } from '@/app/shared/menu-theme-switcher';
import { Popup, usePopup } from '@/app/shared/popup';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { openModelManagerModal } from '@/app/store/model-manager';
import { selectTheme, setTheme, type ThemeMode } from '@/app/store/preferences';

import { useProjectList } from './hooks/use-project-list';
import { ProjectItem, type ProjectItemActions } from './project-item';

export const ProjectList = () => {
  const dispatch = useAppDispatch();
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const { openPopup, closePopup, getPopupState } = usePopup();
  const settingsPopupId = useId();

  const {
    loading,
    error,
    projects,
    featuredProjects,
    regularProjects,
    showHidden,
    setShowHidden,
    projectsFolder,
    handleSaveProjectsFolder,
    handleProjectSelect,
    loadProjects,
    editingProject,
    editTitle,
    editColor,
    editHidden,
    setEditTitle,
    setEditColor,
    setEditHidden,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleToggleFeatured,
    handleThumbnailSelect,
    handleThumbnailRemove,
  } = useProjectList();

  const theme = useAppSelector(selectTheme);
  const isSettingsOpen = getPopupState(settingsPopupId).isOpen;

  const handleSetTheme = useCallback(
    (mode: ThemeMode) => {
      dispatch(setTheme(mode));
    },
    [dispatch],
  );

  const handleOpenModelManager = useCallback(() => {
    closePopup(settingsPopupId);
    dispatch(openModelManagerModal(undefined));
  }, [dispatch, closePopup, settingsPopupId]);

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      closePopup(settingsPopupId);
    } else {
      openPopup(settingsPopupId, {
        position: 'top-right',
        triggerRef: settingsButtonRef,
      });
    }
  }, [isSettingsOpen, closePopup, openPopup, settingsPopupId]);

  const isAnyEditing = editingProject !== null;

  const itemActions: ProjectItemActions = useMemo(
    () => ({
      editColor,
      editTitle,
      editHidden,
      showHidden,
      onSelect: handleProjectSelect,
      onStartEdit: handleStartEdit,
      onCancelEdit: handleCancelEdit,
      onSaveEdit: handleSaveEdit,
      onTitleChange: setEditTitle,
      onColorChange: setEditColor,
      onHiddenChange: setEditHidden,
      onToggleFeatured: handleToggleFeatured,
      onThumbnailSelect: handleThumbnailSelect,
      onThumbnailRemove: handleThumbnailRemove,
    }),
    [
      editColor,
      editTitle,
      editHidden,
      showHidden,
      handleProjectSelect,
      handleStartEdit,
      handleCancelEdit,
      handleSaveEdit,
      setEditTitle,
      setEditColor,
      setEditHidden,
      handleToggleFeatured,
      handleThumbnailSelect,
      handleThumbnailRemove,
    ],
  );

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-120 min-w-80 flex-wrap justify-center px-4 text-center">
        <FolderClosedIcon
          size={320}
          className="max-w-80 text-slate-500 dark:text-slate-400"
        />
        <h1 className="mt-4 w-full text-xl text-slate-500 dark:text-slate-400">
          Loading projects&hellip;
        </h1>
      </div>
    );
  } else if (error) {
    return (
      <div className="mx-auto flex w-full max-w-120 min-w-80 flex-wrap justify-center px-4 text-center">
        <FolderClosedIcon
          size={320}
          className="max-w-80 text-slate-500 dark:text-slate-400"
        />
        <h1 className="mt-4 mb-4 w-full text-xl text-slate-500 dark:text-slate-400">
          Error loading projects
        </h1>
        <p className="mt-4 w-full text-rose-500 dark:text-rose-400">{error}</p>
        <ProjectsFolderInline
          folder={projectsFolder}
          onSave={handleSaveProjectsFolder}
        />
        <p className="mt-4 flex w-full justify-center">
          <Button onClick={loadProjects} size="md" width="xl">
            Refresh
          </Button>
        </p>
      </div>
    );
  } else if (projects.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-120 min-w-80 flex-wrap justify-center px-4 text-center">
        <FolderXIcon
          size={320}
          className="max-w-80 text-slate-500 dark:text-slate-400"
        />
        <h1 className="mt-4 mb-4 w-full text-xl text-slate-500 dark:text-slate-400">
          No projects found
        </h1>
        <p className="mt-4 w-full text-slate-600 dark:text-slate-400">
          No project folders were found in the configured projects directory
        </p>
        <ProjectsFolderInline
          folder={projectsFolder}
          onSave={handleSaveProjectsFolder}
        />
        <p className="mt-4 flex w-full justify-center">
          <Button onClick={loadProjects} size="md" width="xl">
            Refresh
          </Button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-120 min-w-80 flex-col items-center px-4 pt-16 pb-24">
      <FolderClosedIcon className="mb-6 h-24 w-24 text-slate-500 dark:text-slate-400" />

      <h1 className="mb-8 text-2xl text-slate-700 dark:text-slate-200">
        Select a Project
      </h1>

      <div className="w-full max-w-md">
        {featuredProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 flex items-center border-b border-b-slate-200 pb-1 text-lg font-semibold text-slate-700 dark:border-b-slate-600 dark:text-slate-200">
              <span className="mr-2 flex items-center justify-center rounded-full border border-amber-300 bg-amber-200 p-2.5 text-amber-700 inset-shadow-sm inset-shadow-amber-50 dark:border-amber-500 dark:bg-amber-700 dark:text-amber-200 dark:inset-shadow-amber-900">
                <StarIcon className="h-5 w-5" />
              </span>
              Favourite Projects
            </h2>
            <div className="flex flex-wrap gap-3">
              {featuredProjects.map((project) => (
                <ProjectItem
                  key={project.path}
                  project={project}
                  isEditing={editingProject === project.name}
                  isDisabled={isAnyEditing && editingProject !== project.name}
                  actions={itemActions}
                />
              ))}
            </div>
          </div>
        )}

        {regularProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-2 flex items-center border-b border-b-slate-200 pb-1 text-lg font-semibold text-slate-700 dark:border-b-slate-600 dark:text-slate-200">
              <span className="mr-2 flex items-center justify-center rounded-full border border-slate-300 bg-slate-200 p-2.5 text-slate-700 inset-shadow-sm inset-shadow-slate-50 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-200 dark:inset-shadow-slate-800">
                <FolderClosedIcon className="h-5 w-5" />
              </span>
              {featuredProjects.length > 0 ? 'Other Projects' : 'All Projects'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {regularProjects.map((project) => (
                <ProjectItem
                  key={project.path}
                  project={project}
                  isEditing={editingProject === project.name}
                  isDisabled={isAnyEditing && editingProject !== project.name}
                  actions={itemActions}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 mb-4 flex items-center gap-6">
        <Checkbox
          isSelected={showHidden}
          onChange={() => setShowHidden(!showHidden)}
          label="Show hidden projects"
          size="sm"
        />

        <div className="relative">
          <Button
            ref={settingsButtonRef}
            onClick={handleToggleSettings}
            title="Settings"
            size="sm"
            width="lg"
            variant="ghost"
          >
            <SettingsIcon />
            Settings
          </Button>

          <Popup
            id={settingsPopupId}
            triggerRef={settingsButtonRef}
            className="min-w-48 rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-600/50 dark:border-slate-600 dark:bg-slate-800 dark:shadow-slate-950/50"
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <MenuThemeSwitcher theme={theme} setTheme={handleSetTheme} />

              <button
                type="button"
                onClick={handleOpenModelManager}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span className="h-5 w-5">
                  <BoxesIcon className="h-5 w-5" />
                </span>
                Model Manager
              </button>

              <MenuProjectsFolder
                folder={projectsFolder}
                onSave={handleSaveProjectsFolder}
              />
            </div>
          </Popup>
        </div>
      </div>

      <Button onClick={loadProjects} size="md" width="xl">
        Refresh Project List
      </Button>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Note: project folders with no images are not shown
      </p>
    </div>
  );
};

// Inline folder picker for empty/error states
type ProjectsFolderInlineProps = {
  folder: string;
  onSave: (folder: string) => Promise<{ error?: string }>;
};

const ProjectsFolderInline = ({
  folder,
  onSave,
}: ProjectsFolderInlineProps) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({
        title: 'Select projects folder',
        mode: 'folder',
      });
      const res = await fetch(`/api/filesystem/browse?${params}`);
      const data = await res.json();

      if (data.cancelled || !data.path) return;

      setSaving(true);
      const result = await onSave(data.path);
      setSaving(false);

      if (result.error) {
        setError(result.error);
      }
    } catch {
      setSaving(false);
      setError('Failed to open folder picker');
    }
  }, [onSave]);

  return (
    <div className="mt-4 flex flex-col justify-center">
      <h2 className="mb-2 font-medium">Projects Folder</h2>

      <Button
        onClick={handleBrowse}
        disabled={saving}
        variant="ghost"
        size="md"
        width="lg"
      >
        <FolderOpenIcon />

        <span className="max-w-64 truncate">
          {saving ? 'Saving\u2026' : folder || 'No folder configured'}
        </span>

        <PencilIcon className="ml-2" />
      </Button>

      {error && (
        <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
};
