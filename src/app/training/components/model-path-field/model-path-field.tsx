'use client';

import { DownloadIcon, FolderOpenIcon, RotateCcwIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { getTrainingDownloadable } from '@/app/services/model-manager/registries/training-models';
import { startModelDownload } from '@/app/services/model-manager/start-download';
import { Button } from '@/app/shared/button';
import { Dropdown } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';
import { InputTray } from '@/app/shared/input-tray/input-tray';
import { ToolbarDivider } from '@/app/shared/toolbar-divider';
import { useHfTokenStatus } from '@/app/shared/use-hf-token-status';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { openPanel } from '@/app/store/jobs';
import { selectAllModelStatuses } from '@/app/store/model-manager';

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
  const hasHfToken = useHfTokenStatus();
  const [variantId, setVariantId] = useState<string | undefined>(undefined);

  const downloadable = useMemo(
    () => (downloadId ? getTrainingDownloadable(downloadId) : undefined),
    [downloadId],
  );
  const variants = downloadable?.variants;
  const selectedVariant = variantId ?? variants?.[0]?.id;

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
  // Gate downloads of gated models until a HF token is configured.
  const needsToken = !!downloadable?.requiresLicense && hasHfToken === false;

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

  const handleDownload = useCallback(() => {
    if (!downloadable) return;
    dispatch(openPanel());
    startModelDownload({
      modelId: downloadable.id,
      modelName: downloadable.name,
      variantId: selectedVariant,
      dispatch,
    });
  }, [downloadable, selectedVariant, dispatch]);

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
        <>
          {variants && variants.length > 1 && (
            <Dropdown
              variant="ghost"
              items={variants.map((v) => ({ value: v.id, label: v.label }))}
              selectedValue={selectedVariant ?? ''}
              onChange={setVariantId}
              selectedValueRenderer={(item) => (
                <span className="text-xs">{item.value.toUpperCase()}</span>
              )}
              size="md"
              aria-label={`${browseTitle} precision`}
            />
          )}
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="md"
            color="indigo"
            disabled={needsToken}
            title={
              needsToken
                ? `Set a HuggingFace token in the Model Manager Settings tab to download ${browseTitle}`
                : `Download ${browseTitle}…`
            }
          >
            <DownloadIcon />
          </Button>
        </>
      )}
    </InputTray>
  );
}
