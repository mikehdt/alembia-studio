'use client';

import { ExternalLinkIcon, InfoIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import {
  getDownloadablesForArchitecture,
  SHARED_COMPONENTS,
} from '@/app/services/model-manager/registries/training-models';
import type { DownloadableModel } from '@/app/services/model-manager/types';
import {
  ARCHITECTURE_LABELS,
  type ModelArchitecture,
} from '@/app/services/training/models';
import { useAppSelector } from '@/app/store/hooks';
import { selectDownloadJobByModelId } from '@/app/store/jobs';
import {
  selectAllModelStatuses,
  selectIsScanningModels,
} from '@/app/store/model-manager';
import type { ModelEntry } from '@/app/store/model-manager/types';

import { useDownloadActions } from '../activity-panel/use-download-actions';
import { Dropdown, type DropdownItem } from '../dropdown';
import { DeleteInstalledButton } from './delete-installed-button';
import { DownloadRowButton, DownloadRowStatus } from './download-row-status';
import { getModelStatus } from './use-model-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

type TrainingModelGroup = {
  architecture: ModelArchitecture;
  label: string;
  checkpoints: DownloadableModel[];
  dependencies: DownloadableModel[];
};

function getTrainingModelGroups(): TrainingModelGroup[] {
  const archOrder: ModelArchitecture[] = [
    'flux',
    'sdxl',
    'zimage',
    'wan',
    'ltx',
  ];

  return archOrder
    .map((arch) => {
      const { checkpoints, dependencies } =
        getDownloadablesForArchitecture(arch);
      if (checkpoints.length === 0) return null;
      return {
        architecture: arch,
        label: ARCHITECTURE_LABELS[arch],
        checkpoints,
        dependencies,
      };
    })
    .filter((g): g is TrainingModelGroup => g !== null);
}

// ---------------------------------------------------------------------------
// Training tab
// ---------------------------------------------------------------------------

export function TrainingTab() {
  const statuses = useAppSelector(selectAllModelStatuses);
  const loading = useAppSelector(selectIsScanningModels);

  const groups = useMemo(() => getTrainingModelGroups(), []);

  // Find which shared components are used by any model
  const usedSharedComponents = useMemo(() => {
    const usedSharedIds = new Set<string>();
    for (const group of groups) {
      for (const cp of group.checkpoints) {
        for (const dep of cp.dependencies ?? []) {
          usedSharedIds.add(dep);
        }
      }
    }
    return SHARED_COMPONENTS.filter(
      (c) => c.sharedId && usedSharedIds.has(c.sharedId),
    );
  }, [groups]);

  if (loading && Object.keys(statuses).length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-400">
        Checking model status...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-1">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Download base models and shared components for training.
      </p>

      {/* Model groups by architecture */}
      {groups.map((group) => (
        <div key={group.architecture}>
          <div className="mb-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {group.label}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {group.checkpoints.map((cp) => (
              <DownloadableModelRow
                key={cp.id}
                model={cp}
                status={getModelStatus(statuses, cp.id)}
                dependencies={cp.dependencies}
                sharedStatuses={statuses}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Shared components section */}
      {usedSharedComponents.length > 0 && (
        <div>
          <div className="mb-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Shared Components
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Shared across multiple models. Download once, use everywhere.
              Components not yet needed are faded out.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {usedSharedComponents.map((comp) => {
              // Fade if no checkpoint that depends on this component is installed
              const hasInstalledDependent = groups.some((g) =>
                g.checkpoints.some(
                  (cp) =>
                    cp.dependencies?.includes(comp.sharedId!) &&
                    getModelStatus(statuses, cp.id) === 'ready',
                ),
              );
              return (
                <DownloadableModelRow
                  key={comp.id}
                  model={comp}
                  status={getModelStatus(statuses, comp.id)}
                  faded={!hasInstalledDependent}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Downloadable model row
// ---------------------------------------------------------------------------

function DownloadableModelRow({
  model,
  status,
  dependencies,
  sharedStatuses,
  faded,
}: {
  model: DownloadableModel;
  status: string;
  dependencies?: string[];
  sharedStatuses?: Record<string, ModelEntry>;
  /** Fade the row when no dependent model needs this component */
  faded?: boolean;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    model.variants?.[0]?.id ?? 'default',
  );

  const variantItems = useMemo<DropdownItem<string>[]>(
    () => model.variants?.map((v) => ({ value: v.id, label: v.label })) ?? [],
    [model.variants],
  );

  const job = useAppSelector(selectDownloadJobByModelId(model.id));
  const { start, retry, cancel, remove, uninstall } = useDownloadActions();
  const hasLiveJob = job && job.status !== 'completed';

  const isReady = status === 'ready';
  const isPartial = status === 'partial';

  const activeFiles =
    model.variants?.find((v) => v.id === selectedVariantId)?.files ??
    model.files;
  const totalSize = activeFiles.reduce((sum, f) => sum + f.size, 0);

  // Check dependency status
  const missingDeps =
    dependencies?.filter((depId) => {
      const sharedModelId = `shared-${depId}`;
      return getModelStatus(sharedStatuses ?? {}, sharedModelId) !== 'ready';
    }) ?? [];

  const handleDownload = useCallback(() => {
    const variant = model.variants?.find((v) => v.id === selectedVariantId);
    start(model, variant);
  }, [start, model, selectedVariantId]);

  const handleUninstall = useCallback(() => {
    uninstall(model.id);
  }, [uninstall, model.id]);

  return (
    <div
      className={`rounded-md border p-3 transition-colors ${
        isReady
          ? 'border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      } ${faded ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {model.name}
            </span>
            {isReady && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                Installed
              </span>
            )}
            {isPartial && !hasLiveJob && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Incomplete
              </span>
            )}
            {model.requiresLicense && !isReady && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Gated
              </span>
            )}
          </div>
          {model.description && (
            <p className="mt-1 text-sm text-slate-500">{model.description}</p>
          )}
          {model.requiresLicense && !isReady && (
            <div className="mt-1 flex w-full gap-2 text-amber-700 dark:text-amber-400">
              <InfoIcon className="-mt-0.5 inline h-5 w-5" />
              <p className="text-xs">
                Requires accepting the{' '}
                {model.requiresLicense.name ?? 'repository'} license to
                download.{' '}
                <a
                  href={model.requiresLicense.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline hover:text-amber-800 dark:hover:text-amber-300"
                >
                  Accept on HuggingFace
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </p>
            </div>
          )}
          {dependencies && dependencies.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Also requires: {dependencies.join(', ')}
              {missingDeps.length > 0 && (
                <span className="text-amber-500">
                  {' '}
                  ({missingDeps.length} not yet downloaded)
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          {!hasLiveJob && (
            <span className="text-right text-xs text-slate-400 tabular-nums">
              {formatBytes(totalSize)}
            </span>
          )}

          {/* Variant selector — only when no job is in flight */}
          {!hasLiveJob &&
            model.variants &&
            model.variants.length > 1 &&
            !isReady && (
              <Dropdown
                items={variantItems}
                selectedValue={selectedVariantId}
                onChange={setSelectedVariantId}
                selectedValueRenderer={(item) => (
                  <span className="text-sm">{item.value.toUpperCase()}</span>
                )}
                aria-label={`${model.name} precision`}
                size="sm"
              />
            )}

          {hasLiveJob ? (
            <DownloadRowStatus
              job={job}
              onRetry={retry}
              onCancel={cancel}
              onDelete={remove}
            />
          ) : isReady ? (
            <DeleteInstalledButton
              sizeBytes={totalSize}
              onConfirm={handleUninstall}
            />
          ) : (
            <DownloadRowButton
              onClick={handleDownload}
              label={isPartial ? 'Resume' : 'Download'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
