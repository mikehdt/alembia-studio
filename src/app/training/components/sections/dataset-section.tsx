import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FolderOpenIcon,
  HomeIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useMemo, useState } from 'react';

import { Button } from '@/app/shared/button';
import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Input } from '@/app/shared/input/input';

import { ProjectPicker } from '../project-picker/project-picker';
import type {
  DatasetFolder,
  DatasetSource,
  ExtraFolder,
  FolderAugmentation,
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type DatasetSectionProps = {
  datasets: DatasetSource[];
  extraFolders: ExtraFolder[];
  hasChanges: boolean;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onAddDataset: (
    folderName: string,
    displayName: string,
    folders: Omit<DatasetFolder, keyof FolderAugmentation>[],
    thumbnail?: string,
    thumbnailVersion?: number,
    dimensionHistogram?: Record<string, number>,
  ) => void;
  onRemoveDataset: (index: number) => void;
  onSetFolderRepeats: (
    datasetIndex: number | null,
    folderName: string,
    repeats: number | null,
  ) => void;
  onUpdateFolderAugment: (
    datasetIndex: number | null,
    folderName: string,
    updates: Partial<FolderAugmentation>,
  ) => void;
  onAddExtraFolder: (path: string) => void;
  onRemoveExtraFolder: (index: number) => void;
  onReset: (section: SectionName) => void;
};

const DatasetSectionComponent = ({
  datasets,
  extraFolders,
  hasChanges,
  visibleFields,
  hiddenChangesCount,
  onAddDataset,
  onRemoveDataset,
  onSetFolderRepeats,
  onUpdateFolderAugment,
  onAddExtraFolder,
  onRemoveExtraFolder,
  onReset,
}: DatasetSectionProps) => {
  const excludeFolders = useMemo(
    () => datasets.map((ds) => ds.folderName),
    [datasets],
  );

  // Total folder count across projects + extras — drives whether the
  // repeats column is worth showing. A single folder has nothing to weight
  // against, so repeats is just a gussied-up "train N× as many steps".
  const totalFolderCount = useMemo(
    () =>
      datasets.reduce((sum, ds) => sum + ds.folders.length, 0) +
      extraFolders.length,
    [datasets, extraFolders],
  );
  const showRepeats = totalFolderCount > 1;

  // Track which folders have their augmentation panel expanded.
  // Keyed by "datasetIndex|folderName" (datasetIndex=-1 for extras).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleBrowseFolder = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        title: 'Select image folder',
        mode: 'folder',
      });
      const res = await fetch(`/api/filesystem/browse?${params}`);
      const data = await res.json();
      if (data.path) {
        onAddExtraFolder(data.path);
      }
    } catch {
      // Dialog failed — ignore
    }
  }, [onAddExtraFolder]);

  return (
    <CollapsibleSection
      title="Dataset"
      headerExtra={
        <>
          {hasChanges && (
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          )}
          {hiddenChangesCount ? (
            <span className="text-xs text-amber-500/70">
              {hiddenChangesCount} hidden{' '}
              {hiddenChangesCount === 1 ? 'setting' : 'settings'} customised
            </span>
          ) : undefined}
        </>
      }
      headerActions={(expanded) =>
        hasChanges && expanded ? (
          <SectionResetButton onClick={() => onReset('dataset')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {datasets.length === 0 && extraFolders.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-600">
            <p className="text-sm text-slate-400">
              No dataset sources added yet
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Add a tagging project
              {visibleFields.has('extraFolders' satisfies keyof FormState) &&
                ' or folder of images'}{' '}
              to begin
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <ProjectPicker
                onSelect={onAddDataset}
                excludeFolders={excludeFolders}
              >
                <PlusIcon />
                Add Project
              </ProjectPicker>

              {visibleFields.has('extraFolders' satisfies keyof FormState) && (
                <Button variant="ghost" onClick={handleBrowseFolder}>
                  <FolderOpenIcon />
                  Add Folder
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {datasets.map((ds, dsIndex) => (
              <div
                key={ds.folderName}
                className="rounded border border-(--border-subtle) bg-(--surface)/30 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ds.thumbnail ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-600">
                        <Image
                          src={`/tagging-projects/${ds.thumbnail}${ds.thumbnailVersion ? `?v=${ds.thumbnailVersion}` : ''}`}
                          alt={ds.projectName}
                          width={24}
                          height={24}
                          className="h-full w-full object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-600">
                        <FolderIcon className="h-3.5 w-3.5 text-slate-400" />
                      </span>
                    )}
                    <span className="text-sm font-medium text-(--foreground)">
                      {ds.projectName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDataset(dsIndex)}
                    className="cursor-pointer rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                    title="Remove dataset source"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-slate-400 dark:divide-slate-600">
                  {ds.folders.map((folder) => (
                    <FolderRow
                      key={folder.name}
                      datasetIndex={dsIndex}
                      folderName={folder.name}
                      detectedRepeats={folder.detectedRepeats}
                      effectiveRepeats={
                        folder.overrideRepeats ?? folder.detectedRepeats
                      }
                      imageCount={folder.imageCount}
                      augmentation={folder}
                      showRepeats={showRepeats}
                      isExpanded={expanded.has(`${dsIndex}|${folder.name}`)}
                      onToggleExpanded={() =>
                        toggleExpanded(`${dsIndex}|${folder.name}`)
                      }
                      onSetRepeats={onSetFolderRepeats}
                      onUpdateAugment={onUpdateFolderAugment}
                      displayName={
                        folder.name === 'Root' ? ds.folderName : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <ProjectPicker
                onSelect={onAddDataset}
                excludeFolders={excludeFolders}
                buttonSize="sm"
                buttonVariant="ghost"
              >
                <PlusIcon />
                Add Project
              </ProjectPicker>

              {visibleFields.has('extraFolders' satisfies keyof FormState) && (
                <Button
                  onClick={handleBrowseFolder}
                  variant="ghost"
                  size="sm"
                  width="md"
                >
                  <FolderOpenIcon />
                  Add Folder
                </Button>
              )}
            </div>
          </>
        )}

        {/* Extra folders (intermediate+) — rendered with same per-folder
            treatment as dataset folders. */}
        {extraFolders.length > 0 && (
          <div className="rounded border border-(--border-subtle) bg-(--surface)/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <FolderIcon className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm font-medium text-(--foreground)">
                Extra Folders
              </span>
            </div>
            <div className="divide-y divide-slate-400 dark:divide-slate-600">
              {extraFolders.map((ef, i) => (
                <FolderRow
                  key={ef.path}
                  datasetIndex={null}
                  folderName={ef.path}
                  detectedRepeats={1}
                  effectiveRepeats={ef.overrideRepeats ?? 1}
                  imageCount={ef.imageCount}
                  augmentation={ef}
                  showRepeats={showRepeats}
                  isExpanded={expanded.has(`extra|${ef.path}`)}
                  onToggleExpanded={() => toggleExpanded(`extra|${ef.path}`)}
                  onSetRepeats={onSetFolderRepeats}
                  onUpdateAugment={onUpdateFolderAugment}
                  onRemove={() => onRemoveExtraFolder(i)}
                  displayName={ef.path.split(/[\\/]/).pop() ?? ef.path}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

type FolderRowProps = {
  datasetIndex: number | null; // null = extra folder
  folderName: string;
  detectedRepeats: number;
  effectiveRepeats: number;
  imageCount?: number;
  augmentation: FolderAugmentation;
  showRepeats: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSetRepeats: (
    datasetIndex: number | null,
    folderName: string,
    repeats: number | null,
  ) => void;
  onUpdateAugment: (
    datasetIndex: number | null,
    folderName: string,
    updates: Partial<FolderAugmentation>,
  ) => void;
  /** Extra folders get a remove button; dataset folders don't (remove the parent project instead). */
  onRemove?: () => void;
  /** Display label override (e.g. basename of an extras path). */
  displayName?: string;
};

function FolderRow({
  datasetIndex,
  folderName,
  detectedRepeats,
  effectiveRepeats,
  imageCount,
  augmentation,
  showRepeats,
  isExpanded,
  onToggleExpanded,
  onSetRepeats,
  onUpdateAugment,
  onRemove,
  displayName,
}: FolderRowProps) {
  const isDisabled = effectiveRepeats === 0;
  const label = displayName ?? folderName;
  const isRoot = folderName === 'Root';

  return (
    <div className={isDisabled ? 'opacity-40' : undefined}>
      <div className="flex items-center justify-between py-1.5 text-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <Button
            onClick={onToggleExpanded}
            variant="ghost"
            size="sm"
            width="xs"
            title={isExpanded ? 'Hide folder settings' : 'Folder settings'}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-3 w-3" />
            ) : (
              <ChevronRightIcon className="h-3 w-3" />
            )}
          </Button>
          <Button
            onClick={() =>
              onSetRepeats(
                datasetIndex,
                folderName,
                isDisabled ? null : 0,
              )
            }
            variant="toggle"
            size="sm"
            title={isDisabled ? 'Include in training' : 'Exclude from training'}
          >
            {isDisabled ? (
              <EyeOffIcon className="h-3 w-3" />
            ) : (
              <EyeIcon className="h-3 w-3" />
            )}
          </Button>
          <span
            className="flex min-w-0 items-center truncate"
            title={label}
          >
            {isRoot ? (
              <HomeIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
            ) : (
              <FolderOpenIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
            )}
            <span className="truncate">{label}</span>
          </span>
        </div>

        {!isDisabled && (
          <div className="flex items-center gap-2">
            {imageCount !== undefined && (
              <span className="text-slate-400 tabular-nums">
                {imageCount === 1
                  ? `${imageCount} image`
                  : `${imageCount} images`}
              </span>
            )}
            {showRepeats && (
              <>
                <span className="text-slate-400">&times;</span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={effectiveRepeats}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0) {
                      onSetRepeats(
                        datasetIndex,
                        folderName,
                        val === detectedRepeats ? null : val,
                      );
                    }
                  }}
                  size="sm"
                  className="w-14 text-center"
                />
                <span className="text-slate-400">repeats</span>
              </>
            )}
            {onRemove && (
              <Button
                onClick={onRemove}
                variant="ghost"
                size="sm"
                width="xs"
                title="Remove folder"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mb-2 ml-8 grid grid-cols-1 gap-3 rounded border border-(--border-subtle) bg-(--surface)/30 p-3 md:grid-cols-2">
          <div className="flex items-center gap-2 md:col-span-2">
            <Checkbox
              isSelected={augmentation.captionShuffling}
              onChange={() =>
                onUpdateAugment(datasetIndex, folderName, {
                  captionShuffling: !augmentation.captionShuffling,
                })
              }
              label="Shuffle captions"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Randomise tag order during training
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Keep Tokens
            </label>
            <Input
              type="number"
              min={0}
              value={augmentation.keepTokens}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                  onUpdateAugment(datasetIndex, folderName, {
                    keepTokens: val,
                  });
                }
              }}
              className="w-20 tabular-nums"
              size="sm"
            />
            <p className="mt-0.5 text-xs text-slate-400">
              Protects first N tags from shuffling
              {!augmentation.captionShuffling &&
                ' (requires Shuffle Captions)'}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Caption Dropout
            </label>
            <Input
              type="text"
              value={augmentation.captionDropoutRate}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 1) {
                  onUpdateAugment(datasetIndex, folderName, {
                    captionDropoutRate: val,
                  });
                }
              }}
              className="w-20 tabular-nums"
              size="sm"
            />
            <p className="mt-0.5 text-xs text-slate-400">
              Probability of dropping captions (0 = disabled)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={augmentation.flipAugment}
              onChange={() =>
                onUpdateAugment(datasetIndex, folderName, {
                  flipAugment: !augmentation.flipAugment,
                })
              }
              label="Flip horizontally"
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={augmentation.flipVAugment}
              onChange={() =>
                onUpdateAugment(datasetIndex, folderName, {
                  flipVAugment: !augmentation.flipVAugment,
                })
              }
              label="Flip vertically"
              size="sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              LoRA Weight
            </label>
            <Input
              type="text"
              value={augmentation.loraWeight}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  onUpdateAugment(datasetIndex, folderName, {
                    loraWeight: val,
                  });
                }
              }}
              className="w-20 tabular-nums"
              size="sm"
            />
            <p className="mt-0.5 text-xs text-slate-400">
              Scales this folder&apos;s contribution (1 = standard)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={augmentation.isRegularization}
              onChange={() =>
                onUpdateAugment(datasetIndex, folderName, {
                  isRegularization: !augmentation.isRegularization,
                })
              }
              label="Regularisation set"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Treat as class/regularisation data, not training data
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const DatasetSection = memo(DatasetSectionComponent);
