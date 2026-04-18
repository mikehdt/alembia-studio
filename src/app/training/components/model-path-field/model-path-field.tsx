'use client';

import { DownloadIcon, FolderOpenIcon, RotateCcwIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { getTrainingDownloadable } from '@/app/services/model-manager/registries/training-models';
import { Button } from '@/app/shared/button';
import { Input } from '@/app/shared/input/input';
import { InputTray } from '@/app/shared/input-tray/input-tray';
import { ToolbarDivider } from '@/app/shared/toolbar-divider';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { openModelManagerModal } from '@/app/store/model-manager';
import { selectAllModelStatuses } from '@/app/store/model-manager';

import { useModelDefaultsModal } from '../model-defaults-modal/use-model-defaults-modal';

import { resolveDownloadedPath } from './resolve-downloaded-path';

const MODEL_FILE_FILTER = 'safetensors,ckpt,bin,pt,pth';

type ModelPathFieldProps = {
  value: string;
  onChange: (path: string) => void;
  /** Human-readable component name used in browse dialog titles and tooltips (e.g. "T5-XXL Text Encoder"). */
  browseTitle: string;
  placeholder?: string;
  /** Registry ID of the downloadable model backing this component (if any). */
  downloadId?: string;
  /**
   * Explicit path the reset button should restore. Typically the last
   * saved default for this component. When omitted, the component falls
   * back to the system-downloaded path (if the download status is ready).
   */
  resetTo?: string;
  className?: string;
};

export function ModelPathField({
  value,
  onChange,
  browseTitle,
  placeholder,
  downloadId,
  resetTo,
  className,
}: ModelPathFieldProps) {
  const dispatch = useAppDispatch();
  const statuses = useAppSelector(selectAllModelStatuses);
  const { closeModal: closeDefaultsModal } = useModelDefaultsModal();

  const downloadable = useMemo(
    () => (downloadId ? getTrainingDownloadable(downloadId) : undefined),
    [downloadId],
  );

  const entry = downloadId ? statuses[downloadId] : undefined;

  const downloadedPath = useMemo(() => {
    if (
      !downloadable ||
      !entry ||
      entry.status !== 'ready' ||
      !entry.localPath
    ) {
      return null;
    }
    return resolveDownloadedPath(entry.localPath, downloadable);
  }, [downloadable, entry]);

  const trimmedValue = value.trim();
  const trimmedResetTo = resetTo?.trim() ?? '';
  // Explicit resetTo wins; fall back to the system-downloaded path
  // so the button still works for downloadable models with no saved default.
  const resetTarget = trimmedResetTo !== '' ? trimmedResetTo : downloadedPath;
  const canReset =
    resetTarget !== null && resetTarget !== '' && trimmedValue !== resetTarget;
  const canDownload =
    downloadable !== undefined &&
    downloadedPath === null &&
    trimmedValue === '' &&
    !canReset;
  const isDownloading = entry?.status === 'downloading';

  const handleBrowse = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        title: `Select ${browseTitle}`,
        filter: MODEL_FILE_FILTER,
      });
      const res = await fetch(`/api/filesystem/browse?${params}`);
      const data = await res.json();
      if (data.path) onChange(data.path);
    } catch {
      // Dialog failed — user can still type the path manually
    }
  }, [browseTitle, onChange]);

  const handleReset = useCallback(() => {
    if (resetTarget) onChange(resetTarget);
  }, [resetTarget, onChange]);

  // Hand download off to the Model Manager rather than kicking off the
  // download inline — gives the user variant/precision choice, progress
  // visibility, and a single canonical place to reason about downloads.
  // The defaults modal closes since both are full-screen modals; the user
  // can reopen it to set paths once the download finishes.
  const handleOpenManager = useCallback(() => {
    closeDefaultsModal();
    dispatch(openModelManagerModal('training'));
  }, [closeDefaultsModal, dispatch]);

  const hasExtra = canReset || (canDownload && !isDownloading);

  return (
    <InputTray size="md" className={className}>
      <Input
        type="text"
        size="md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? `Path to ${browseTitle.toLowerCase()}…`}
        className="min-w-0 flex-1"
      />
      <Button
        onClick={handleBrowse}
        variant="ghost"
        size="md"
        width="md"
        title="Browse…"
      >
        <FolderOpenIcon />
      </Button>

      {hasExtra && (
        <div className="mx-1">
          <ToolbarDivider />
        </div>
      )}

      {canReset && (
        <Button
          onClick={handleReset}
          variant="ghost"
          size="md"
          width="md"
          color="indigo"
          title={`Reset to default (${resetTarget})`}
        >
          <RotateCcwIcon />
        </Button>
      )}

      {canDownload && !isDownloading && (
        <Button
          onClick={handleOpenManager}
          variant="ghost"
          size="md"
          color="indigo"
          title={`Download ${browseTitle} in Model Manager`}
        >
          <DownloadIcon />
          Download…
        </Button>
      )}
    </InputTray>
  );
}
