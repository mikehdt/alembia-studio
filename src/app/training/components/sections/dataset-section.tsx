import {
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import Image from 'next/image';
import { memo, useCallback, useMemo } from 'react';

import { Button } from '@/app/shared/button';
import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Input } from '@/app/shared/input/input';

import { ProjectPicker } from '../project-picker/project-picker';
import type {
  DatasetFolder,
  DatasetSource,
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type DatasetSectionProps = {
  datasets: DatasetSource[];
  extraFolders: string[];
  captionDropoutRate: number;
  captionShuffling: boolean;
  flipAugment: boolean;
  flipVAugment: boolean;
  hasChanges: boolean;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onAddDataset: (
    folderName: string,
    displayName: string,
    folders: DatasetFolder[],
    thumbnail?: string,
    thumbnailVersion?: number,
    dimensionHistogram?: Record<string, number>,
  ) => void;
  onRemoveDataset: (index: number) => void;
  onSetFolderRepeats: (
    datasetIndex: number,
    folderName: string,
    repeats: number | null,
  ) => void;
  onAddExtraFolder: (path: string) => void;
  onRemoveExtraFolder: (index: number) => void;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onReset: (section: SectionName) => void;
};

const DatasetSectionComponent = ({
  datasets,
  extraFolders,
  captionDropoutRate,
  captionShuffling,
  flipAugment,
  flipVAugment,
  hasChanges,
  visibleFields,
  hiddenChangesCount,
  onAddDataset,
  onRemoveDataset,
  onSetFolderRepeats,
  onAddExtraFolder,
  onRemoveExtraFolder,
  onFieldChange,
  onReset,
}: DatasetSectionProps) => {
  const excludeFolders = useMemo(
    () => datasets.map((ds) => ds.folderName),
    [datasets],
  );

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
                  {ds.folders.map((folder) => {
                    const effectiveRepeats =
                      folder.overrideRepeats ?? folder.detectedRepeats;
                    const isDisabled = effectiveRepeats === 0;
                    return (
                      <div
                        key={folder.name}
                        className={`flex items-center justify-between border-dotted py-1.5 text-sm ${isDisabled ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-center gap-2 text-slate-500">
                          <Button
                            onClick={() =>
                              onSetFolderRepeats(
                                dsIndex,
                                folder.name,
                                isDisabled ? null : 0,
                              )
                            }
                            variant="toggle"
                            size="sm"
                            title={
                              isDisabled
                                ? 'Include in training'
                                : 'Exclude from training'
                            }
                          >
                            {isDisabled ? (
                              <EyeOffIcon className="h-3 w-3" />
                            ) : (
                              <EyeIcon className="h-3 w-3" />
                            )}
                          </Button>
                          <span className="flex items-center">
                            <FolderOpenIcon className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-600" />{' '}
                            {folder.name}
                          </span>
                        </div>

                        {!isDisabled && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 tabular-nums">
                              {folder.imageCount === 1
                                ? `${folder.imageCount} image`
                                : `${folder.imageCount} images`}
                            </span>
                            <span className="text-slate-400">&times;</span>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={effectiveRepeats}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (val > 0) {
                                  onSetFolderRepeats(
                                    dsIndex,
                                    folder.name,
                                    val === folder.detectedRepeats ? null : val,
                                  );
                                }
                              }}
                              size="sm"
                              className="w-14 text-center"
                            />
                            <span className="text-slate-400">repeats</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

        {/* Extra folders (intermediate+) */}
        {visibleFields.has('extraFolders' satisfies keyof FormState) &&
          extraFolders.length > 0 && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-(--foreground)/70">
                Extra Folders
              </label>
              {extraFolders.map((folder, i) => (
                <div key={folder} className="flex items-center gap-1.5 text-xs">
                  <FolderIcon className="h-3 w-3 shrink-0 text-slate-400" />
                  <span
                    className="min-w-0 flex-1 truncate text-slate-500"
                    title={folder}
                  >
                    {folder}
                  </span>
                  <Button
                    onClick={() => onRemoveExtraFolder(i)}
                    title="Remove folder"
                  >
                    <XIcon />
                  </Button>
                </div>
              ))}
            </div>
          )}

        {/* Caption Shuffling */}
        {visibleFields.has('captionShuffling' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={captionShuffling}
              onChange={() =>
                onFieldChange('captionShuffling', !captionShuffling)
              }
              label="Caption Shuffling"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Randomise tag order during training
            </span>
          </div>
        )}

        {/* Flip H Augment */}
        {visibleFields.has('flipAugment' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={flipAugment}
              onChange={() => onFieldChange('flipAugment', !flipAugment)}
              label="Flip Horizontal"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Randomly flip images horizontally
            </span>
          </div>
        )}

        {/* Flip V Augment */}
        {visibleFields.has('flipVAugment' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={flipVAugment}
              onChange={() => onFieldChange('flipVAugment', !flipVAugment)}
              label="Flip Vertical"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Randomly flip images vertically (unusual)
            </span>
          </div>
        )}

        {/* Caption Dropout Rate */}
        {visibleFields.has('captionDropoutRate' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Caption Dropout Rate
            </label>
            <Input
              type="text"
              value={captionDropoutRate}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0 && val <= 1) {
                  onFieldChange('captionDropoutRate', val);
                }
              }}
              className="w-20 tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-400">
              Probability of dropping captions during training (0 = disabled)
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export const DatasetSection = memo(DatasetSectionComponent);
