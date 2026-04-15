import { memo, useMemo } from 'react';

import { Checkbox } from '@/app/shared/checkbox';
import { CollapsibleSection } from '@/app/shared/collapsible-section';
import { Dropdown, type DropdownItem } from '@/app/shared/dropdown';
import { Input } from '@/app/shared/input/input';
import {
  calculateKohyaBucket,
  generateBucketList,
} from '@/app/utils/image-utils';

import type {
  DatasetSource,
  FormState,
  SectionName,
} from '../training-config-form/use-training-config-form';
import { SectionResetButton } from './section-reset-button';

type PerformanceSectionProps = {
  /** Read-only, for effective batch size display in gradient accumulation */
  batchSize: number;
  resolution: number[];
  availableResolutions: number[];
  provider: 'ai-toolkit' | 'kohya';
  datasets: DatasetSource[];
  mixedPrecision: 'bf16' | 'fp16' | 'fp8';
  gradientAccumulationSteps: number;
  gradientCheckpointing: boolean;
  cacheLatents: boolean;
  hasChanges: boolean;
  visibleFields: Set<string>;
  hiddenChangesCount?: number;
  onFieldChange: <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => void;
  onReset: (section: SectionName) => void;
};

const PRECISION_ITEMS: DropdownItem<string>[] = [
  { value: 'bf16', label: 'bfloat16' },
  { value: 'fp16', label: 'float16' },
  { value: 'fp8', label: 'float8 (lower VRAM)' },
];

const PerformanceSectionComponent = ({
  batchSize,
  resolution,
  availableResolutions,
  provider,
  datasets,
  mixedPrecision,
  gradientAccumulationSteps,
  gradientCheckpointing,
  cacheLatents,
  hasChanges,
  visibleFields,
  hiddenChangesCount,
  onFieldChange,
  onReset,
}: PerformanceSectionProps) => {
  const isKohya = provider === 'kohya';

  const hasVisibleFields =
    visibleFields.has('resolution') ||
    visibleFields.has('mixedPrecision') ||
    visibleFields.has('gradientAccumulationSteps') ||
    visibleFields.has('gradientCheckpointing') ||
    visibleFields.has('cacheLatents');

  if (!hasVisibleFields) return null;

  const handleToggleResolution = (res: number) => {
    if (isKohya) {
      // Kohya: single-select — replace the entire array
      onFieldChange('resolution', [res]);
      return;
    }
    // ai-toolkit: multi-select toggle
    if (resolution.includes(res)) {
      if (resolution.length > 1) {
        onFieldChange(
          'resolution',
          resolution.filter((r) => r !== res),
        );
      }
    } else {
      onFieldChange(
        'resolution',
        [...resolution, res].sort((a, b) => a - b),
      );
    }
  };

  return (
    <CollapsibleSection
      title="Performance"
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
          <SectionResetButton onClick={() => onReset('performance')} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Mixed Precision */}
        {visibleFields.has('mixedPrecision' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Training Precision
            </label>
            <Dropdown
              items={PRECISION_ITEMS}
              selectedValue={mixedPrecision}
              onChange={(val) =>
                onFieldChange(
                  'mixedPrecision',
                  val as FormState['mixedPrecision'],
                )
              }
              aria-label="Training precision"
            />
            <p className="mt-1 text-xs text-slate-400">
              Independent of the base model&apos;s format. BF16 is more stable
              on modern GPUs (RTX 3000+)
            </p>
          </div>
        )}

        {/* Resolution */}
        {visibleFields.has('resolution' satisfies keyof FormState) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              {isKohya ? 'Base Resolution' : 'Training Resolutions'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableResolutions.map((res) => {
                const isActive = resolution.includes(res);
                return (
                  <button
                    key={res}
                    type="button"
                    onClick={() => handleToggleResolution(res)}
                    className={`cursor-pointer rounded-sm border px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
                      isActive
                        ? 'border-sky-400 bg-sky-100 text-sky-700 dark:border-sky-600 dark:bg-sky-900/40 dark:text-sky-300'
                        : 'border-(--border-subtle) text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:hover:border-slate-500 dark:hover:text-slate-300'
                    }`}
                  >
                    {res}
                  </button>
                );
              })}
            </div>
            {isKohya && resolution.length > 0 && datasets.length > 0 && (
              <KohyaBucketPreview
                baseResolution={resolution[0]}
                datasets={datasets}
              />
            )}
          </div>
        )}

        {/* Gradient Accumulation */}
        {visibleFields.has(
          'gradientAccumulationSteps' satisfies keyof FormState,
        ) && (
          <div>
            <label className="mb-1 block text-xs font-medium text-(--foreground)/70">
              Gradient Accumulation Steps
            </label>
            <Input
              type="number"
              min={1}
              max={16}
              value={gradientAccumulationSteps}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onFieldChange('gradientAccumulationSteps', val);
              }}
              className="w-20"
            />
            {gradientAccumulationSteps > 1 && (
              <p className="mt-1 text-xs text-slate-400">
                Effective batch size:{' '}
                <span className="font-medium">
                  {batchSize * gradientAccumulationSteps}
                </span>{' '}
                ({batchSize} &times; {gradientAccumulationSteps})
              </p>
            )}
          </div>
        )}

        {/* Gradient Checkpointing */}
        {visibleFields.has(
          'gradientCheckpointing' satisfies keyof FormState,
        ) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={gradientCheckpointing}
              onChange={() =>
                onFieldChange('gradientCheckpointing', !gradientCheckpointing)
              }
              label="Gradient Checkpointing"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Reduces VRAM at cost of speed
            </span>
          </div>
        )}

        {/* Cache Latents */}
        {visibleFields.has('cacheLatents' satisfies keyof FormState) && (
          <div className="flex items-center gap-2">
            <Checkbox
              isSelected={cacheLatents}
              onChange={() => onFieldChange('cacheLatents', !cacheLatents)}
              label="Cache Latents"
              size="sm"
            />
            <span className="text-xs text-slate-400">
              Caches VAE outputs for faster training
            </span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

/** Informational preview of Kohya bucketing for a given base resolution. */
const KohyaBucketPreview = memo(
  ({
    baseResolution,
    datasets,
  }: {
    baseResolution: number;
    datasets: DatasetSource[];
  }) => {
    const buckets = useMemo(
      () => generateBucketList(baseResolution),
      [baseResolution],
    );

    // Assign images from dimension histograms to buckets
    const bucketCounts = useMemo(() => {
      const counts = new Map<string, number>();

      // Aggregate histograms across all datasets
      for (const ds of datasets) {
        if (!ds.dimensionHistogram) continue;
        for (const [dimKey, count] of Object.entries(ds.dimensionHistogram)) {
          const [w, h] = dimKey.split('x').map(Number);
          if (!w || !h) continue;
          const bucket = calculateKohyaBucket(w, h, {
            targetResolution: baseResolution,
            stepSize: 64,
            minSize: 256,
            maxSize: baseResolution * 2,
          });
          const key = `${bucket.width}x${bucket.height}`;
          counts.set(key, (counts.get(key) ?? 0) + count);
        }
      }
      return counts;
    }, [datasets, baseResolution]);

    if (buckets.length === 0) return null;

    const hasImageData = bucketCounts.size > 0;
    const squareCount = buckets.filter((b) => b.width === b.height).length;
    const totalBuckets = buckets.length + (buckets.length - squareCount);

    return (
      <div className="mt-1.5">
        <p className="text-xs text-slate-400">
          {totalBuckets} buckets ({buckets.length} unique ratios + portrait
          mirrors)
        </p>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400 tabular-nums">
          {buckets.map((b) => {
            const key = `${b.width}x${b.height}`;
            const portraitKey = `${b.height}x${b.width}`;
            const count =
              (bucketCounts.get(key) ?? 0) +
              (b.width !== b.height ? (bucketCounts.get(portraitKey) ?? 0) : 0);
            // When we have image data, only show buckets that have images
            if (hasImageData && count === 0) return null;
            return (
              <span key={key}>
                {b.width}&times;{b.height}
                {hasImageData && (
                  <span className="ml-0.5 text-sky-500">({count})</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  },
);
KohyaBucketPreview.displayName = 'KohyaBucketPreview';

export const PerformanceSection = memo(PerformanceSectionComponent);
